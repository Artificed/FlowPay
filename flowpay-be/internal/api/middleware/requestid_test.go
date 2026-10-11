package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func TestRequestID_OnlyKeepsUUIDsFromTheClient(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(RequestID())
	r.GET("/", func(c *gin.Context) { c.Status(http.StatusNoContent) })

	cases := []struct {
		name   string
		header string
		want   string
	}{
		{"canonical uuid", "6f1c1c3e-8f43-4c7e-9a52-1d1f3c4b5a6e", "6f1c1c3e-8f43-4c7e-9a52-1d1f3c4b5a6e"},
		{"urn form", "urn:uuid:6F1C1C3E-8F43-4C7E-9A52-1D1F3C4B5A6E", "6f1c1c3e-8f43-4c7e-9a52-1d1f3c4b5a6e"},
		{"not a uuid", "a-request-id-much-longer-than-the-correlation-id-column", ""},
		{"missing", "", ""},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			if tc.header != "" {
				req.Header.Set(RequestIDHeader, tc.header)
			}
			rec := httptest.NewRecorder()
			r.ServeHTTP(rec, req)

			got := rec.Header().Get(RequestIDHeader)
			if tc.want != "" && got != tc.want {
				t.Errorf("X-Request-ID = %q, want %q", got, tc.want)
			}
			if _, err := uuid.Parse(got); err != nil || len(got) != 36 {
				t.Errorf("X-Request-ID %q is not a canonical uuid", got)
			}
		})
	}
}
