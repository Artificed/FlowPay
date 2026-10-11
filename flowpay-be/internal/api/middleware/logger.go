package middleware

import (
	"flowpay-be/internal/reqctx"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"runtime/debug"
	"time"

	"github.com/gin-gonic/gin"
)

func Logger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()

		status := c.Writer.Status()
		level := slog.LevelInfo
		switch {
		case status >= http.StatusInternalServerError:
			level = slog.LevelError
		case status >= http.StatusBadRequest:
			level = slog.LevelWarn
		}

		slog.Log(c.Request.Context(), level, "http: request",
			"method", c.Request.Method,
			"path", c.Request.URL.Path,
			"status", status,
			"duration_ms", time.Since(start).Milliseconds(),
			"client_ip", c.ClientIP(),
			"request_id", reqctx.GetRequestID(c.Request.Context()),
		)
	}
}

func Recovery() gin.HandlerFunc {
	return gin.CustomRecoveryWithWriter(io.Discard, func(c *gin.Context, err any) {
		slog.ErrorContext(c.Request.Context(), "http: panic recovered",
			"error", fmt.Sprint(err),
			"stack", string(debug.Stack()),
			"request_id", reqctx.GetRequestID(c.Request.Context()),
		)
		c.AbortWithStatus(http.StatusInternalServerError)
	})
}
