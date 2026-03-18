package middleware

import (
	"flowpay-be/internal/reqctx"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const RequestIDHeader = "X-Request-ID"

func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.GetHeader(RequestIDHeader)
		if id == "" {
			id = uuid.NewString()
		}
		c.Header(RequestIDHeader, id)
		c.Request = c.Request.WithContext(reqctx.WithRequestID(c.Request.Context(), id))
		c.Next()
	}
}
