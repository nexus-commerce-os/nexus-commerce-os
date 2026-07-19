// Command platform-hello is the NEXUS P0.1 walking-skeleton service.
//
// It exists ONLY to prove the platform pipeline end-to-end — chart → image →
// admission → deploy → probes → metrics scrape → traces/logs into the
// observability domain. It contains NO business logic and is NOT a product
// service (see README). It exposes the org health/metrics contract from
// ADR-0010 (#5 health, #6 metrics) and docs/10 §7:
//
//	/           OTel-traced handler → "nexus platform-hello ok"
//	/healthz    liveness  — process is up
//	/readyz     readiness — dependency-check stub (gates traffic)
//	/metrics    Prometheus golden-signal metrics (separate port)
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
)

const serviceName = "platform-hello"

// version is overridden at build time via -ldflags "-X main.version=...".
var version = "dev"

var (
	httpRequests = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "platform_hello_http_requests_total",
		Help: "Total HTTP requests handled, by route and status.",
	}, []string{"route", "status"})

	httpDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "platform_hello_http_request_duration_seconds",
		Help:    "HTTP request duration in seconds, by route.",
		Buckets: prometheus.DefBuckets,
	}, []string{"route"})

	buildInfo = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "platform_hello_build_info",
		Help: "Build/version info (always 1).",
	}, []string{"version"})
)

// ready flips to 1 once dependency checks pass; readiness probe reads it.
var ready atomic.Bool

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

// instrument wraps a handler with metrics + a named route label.
func instrument(route string, h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		sw := &statusWriter{ResponseWriter: w, status: http.StatusOK}
		h(sw, r)
		httpDuration.WithLabelValues(route).Observe(time.Since(start).Seconds())
		httpRequests.WithLabelValues(route, fmt.Sprintf("%d", sw.status)).Inc()
	}
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (s *statusWriter) WriteHeader(code int) {
	s.status = code
	s.ResponseWriter.WriteHeader(code)
}

// rootHandler is the OTel-traced canary handler.
func rootHandler(w http.ResponseWriter, r *http.Request) {
	_, span := otel.Tracer(serviceName).Start(r.Context(), "root")
	defer span.End()
	span.SetAttributes(attribute.String("nexus.canary", "platform-hello"))
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("nexus platform-hello ok\n"))
}

// healthzHandler is the liveness probe: the process is running.
func healthzHandler(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok\n"))
}

// checkDependencies is the readiness STUB. A real service would verify its
// hard dependencies (DB, cache, downstream) here; the walking skeleton has
// none, so it returns nil. Readiness gates traffic + backs canary analysis
// and the Affiliate-Gateway-style failover pattern (docs/10 §7, §4.1).
func checkDependencies(_ context.Context) error {
	return nil
}

// readyzHandler is the readiness probe: dependencies healthy AND warm-up done.
func readyzHandler(w http.ResponseWriter, r *http.Request) {
	if !ready.Load() {
		http.Error(w, "starting\n", http.StatusServiceUnavailable)
		return
	}
	if err := checkDependencies(r.Context()); err != nil {
		http.Error(w, "dependency unhealthy: "+err.Error()+"\n", http.StatusServiceUnavailable)
		return
	}
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ready\n"))
}

// newAppServer builds the main app mux (exported for tests).
func newAppMux() *http.ServeMux {
	mux := http.NewServeMux()
	// OTel HTTP middleware creates a server span per request; rootHandler adds a child span.
	mux.Handle("/", otelhttp.NewHandler(instrument("/", rootHandler), "root"))
	mux.HandleFunc("/healthz", instrument("/healthz", healthzHandler))
	mux.HandleFunc("/readyz", instrument("/readyz", readyzHandler))
	return mux
}

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	version = getenv("APP_VERSION", version)
	buildInfo.WithLabelValues(version).Set(1)

	httpPort := getenv("HTTP_PORT", "8080")
	metricsPort := getenv("METRICS_PORT", "9090")

	// OTel tracer provider (OTLP export to the collector in the observability domain).
	// Wired via OTEL_EXPORTER_OTLP_ENDPOINT injected by the nexus-common chart.
	shutdown, err := initTracer(context.Background(), serviceName, version)
	if err != nil {
		logger.Warn("otel tracer init failed; continuing without export", "err", err)
	}

	appSrv := &http.Server{Addr: ":" + httpPort, Handler: newAppMux(), ReadHeaderTimeout: 5 * time.Second}

	// Metrics on a SEPARATE port/server so scrape traffic never contends with
	// app traffic and can be network-policy-scoped independently.
	metricsMux := http.NewServeMux()
	metricsMux.Handle("/metrics", promhttp.Handler())
	metricsSrv := &http.Server{Addr: ":" + metricsPort, Handler: metricsMux, ReadHeaderTimeout: 5 * time.Second}

	go func() {
		logger.Info("metrics listening", "port", metricsPort)
		if err := metricsSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("metrics server failed", "err", err)
		}
	}()

	go func() {
		logger.Info("app listening", "port", httpPort, "version", version)
		if err := appSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("app server failed", "err", err)
			os.Exit(1)
		}
	}()

	// Simulate warm-up before flipping readiness on (docs/10 §4.2 warm-up pattern, in miniature).
	ready.Store(true)
	logger.Info("readiness gate open")

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	logger.Info("shutting down")
	ready.Store(false) // fail readiness first so LBs drain us
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = appSrv.Shutdown(ctx)
	_ = metricsSrv.Shutdown(ctx)
	if shutdown != nil {
		_ = shutdown(ctx)
	}
	logger.Info("bye")
}
