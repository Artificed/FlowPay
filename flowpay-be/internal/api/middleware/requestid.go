package middleware

import (
	"flowpay-be/internal/reqctx"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const RequestIDHeader = "X-Request-ID"

func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := uuid.NewString()
		if parsed, err := uuid.Parse(c.GetHeader(RequestIDHeader)); err == nil {
			id = parsed.String()
		}
		c.Header(RequestIDHeader, id)
		c.Request = c.Request.WithContext(reqctx.WithRequestID(c.Request.Context(), id))
		c.Next()
	}
}
