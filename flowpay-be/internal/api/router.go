package api

import (
	"flowpay-be/internal/api/handler"
	"flowpay-be/internal/api/middleware"

	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

type Handlers struct {
	Auth *handler.AuthHandler
}

func NewRouter(handlers Handlers, jwtSecret string) *gin.Engine {
	r := gin.Default()

	if gin.Mode() != gin.ReleaseMode {
		r.GET("/docs/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
	}

	v1 := r.Group("/api/v1")
	{
		auth := v1.Group("/auth")
		{
			auth.POST("/register", handlers.Auth.Register)
			auth.POST("/login", handlers.Auth.Login)
		}

		_ = v1.Group("/", middleware.Auth(jwtSecret))
	}

	return r
}
