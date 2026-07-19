package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRootHandler(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rootHandler(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("root: got status %d, want 200", rec.Code)
	}
	body, _ := io.ReadAll(rec.Body)
	if got := strings.TrimSpace(string(body)); got != "nexus platform-hello ok" {
		t.Fatalf("root: got body %q, want %q", got, "nexus platform-hello ok")
	}
}

func TestHealthz(t *testing.T) {
	rec := httptest.NewRecorder()
	healthzHandler(rec, httptest.NewRequest(http.MethodGet, "/healthz", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("healthz: got %d, want 200", rec.Code)
	}
}

func TestReadyz(t *testing.T) {
	// Before warm-up: not ready.
	ready.Store(false)
	rec := httptest.NewRecorder()
	readyzHandler(rec, httptest.NewRequest(http.MethodGet, "/readyz", nil))
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("readyz(cold): got %d, want 503", rec.Code)
	}

	// After warm-up with healthy dependency stub: ready.
	ready.Store(true)
	rec = httptest.NewRecorder()
	readyzHandler(rec, httptest.NewRequest(http.MethodGet, "/readyz", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("readyz(warm): got %d, want 200", rec.Code)
	}
}

func TestAppMuxRoutesExist(t *testing.T) {
	ready.Store(true)
	srv := httptest.NewServer(newAppMux())
	defer srv.Close()

	for _, tc := range []struct {
		path string
		want int
	}{
		{"/", http.StatusOK},
		{"/healthz", http.StatusOK},
		{"/readyz", http.StatusOK},
	} {
		resp, err := http.Get(srv.URL + tc.path)
		if err != nil {
			t.Fatalf("GET %s: %v", tc.path, err)
		}
		_ = resp.Body.Close()
		if resp.StatusCode != tc.want {
			t.Errorf("GET %s: got %d, want %d", tc.path, resp.StatusCode, tc.want)
		}
	}
}
