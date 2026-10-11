package middleware

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func newLoggedRouter(t *testing.T) (*gin.Engine, *bytes.Buffer) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	var logs bytes.Buffer
	previous := slog.Default()
	slog.SetDefault(slog.New(slog.NewJSONHandler(&logs, nil)))
	t.Cleanup(func() { slog.SetDefault(previous) })

	r := gin.New()
	r.Use(RequestID(), Logger(), Recovery())
	r.GET("/ok", func(c *gin.Context) { c.Status(http.StatusCreated) })
	r.GET("/panic", func(c *gin.Context) { panic("boom") })
	return r, &logs
}

func logLines(t *testing.T, logs *bytes.Buffer) []map[string]any {
	t.Helper()
	var lines []map[string]any
	for _, raw := range strings.Split(strings.TrimSpace(logs.String()), "\n") {
		var line map[string]any
		if err := json.Unmarshal([]byte(raw), &line); err != nil {
			t.Fatalf("log line is not JSON: %q", raw)
		}
		lines = append(lines, line)
	}
	return lines
}

func TestLogger_WritesOneJSONLinePerRequest(t *testing.T) {
	r, logs := newLoggedRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/ok", nil)
	req.Header.Set(RequestIDHeader, "req-123")
	r.ServeHTTP(httptest.NewRecorder(), req)

	lines := logLines(t, logs)
	if len(lines) != 1 {
		t.Fatalf("expected 1 log line, got %d", len(lines))
	}
	line := lines[0]
	if line["msg"] != "http: request" || line["request_id"] != "req-123" || line["status"] != float64(http.StatusCreated) || line["path"] != "/ok" {
		t.Errorf("unexpected log line: %v", line)
	}
}

func TestRecovery_LogsThePanicAndReturns500(t *testing.T) {
	r, logs := newLoggedRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/panic", nil)
	req.Header.Set(RequestIDHeader, "req-456")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", rec.Code)
	}
	lines := logLines(t, logs)
	if len(lines) != 2 {
		t.Fatalf("expected a panic line and a request line, got %d lines", len(lines))
	}
	if lines[0]["msg"] != "http: panic recovered" || lines[0]["error"] != "boom" || lines[0]["request_id"] != "req-456" {
		t.Errorf("unexpected panic line: %v", lines[0])
	}
	if lines[1]["level"] != "ERROR" || lines[1]["status"] != float64(http.StatusInternalServerError) {
		t.Errorf("unexpected request line: %v", lines[1])
	}
}
