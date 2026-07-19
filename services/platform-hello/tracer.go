package main

import (
	"context"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.24.0"
)

// initTracer configures an OTLP/gRPC trace exporter pointed at the OTel
// Collector in the SEPARATE observability failure domain (ADR-0017 R-060).
// Endpoint + sampling come from OTEL_* env injected by the nexus-common chart.
// Returns a shutdown func. If the collector is unreachable it degrades to a
// no-op export (the service must still serve — obs is off the critical path).
func initTracer(ctx context.Context, service, version string) (func(context.Context) error, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	// otlptracegrpc reads OTEL_EXPORTER_OTLP_ENDPOINT / _PROTOCOL from the env.
	exp, err := otlptracegrpc.New(ctx, otlptracegrpc.WithInsecure())
	if err != nil {
		return nil, err
	}

	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceName(service),
			semconv.ServiceVersion(version),
		),
		resource.WithFromEnv(), // picks up OTEL_RESOURCE_ATTRIBUTES (namespace, env, pool)
	)
	if err != nil {
		return nil, err
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exp),
		sdktrace.WithResource(res),
		// Head sampling hint; the collector does authoritative tail sampling (docs/09 §11).
		sdktrace.WithSampler(sdktrace.ParentBased(sdktrace.TraceIDRatioBased(0.1))),
	)
	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{}, propagation.Baggage{},
	))
	return tp.Shutdown, nil
}
