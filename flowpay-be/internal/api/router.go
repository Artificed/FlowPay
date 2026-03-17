package api

import (
	"flowpay-be/internal/api/handler"
	"flowpay-be/internal/api/middleware"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

type Handlers struct {
	Auth     *handler.AuthHandler
	Wallet   *handler.WalletHandler
	Transfer *handler.TransferHandler
}

func NewRouter(handlers Handlers, jwtSecret string) *gin.Engine {
	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173", "http://localhost:80"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
	}))

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

		protected := v1.Group("/", middleware.Auth(jwtSecret))
		{
			protected.GET("/wallet", handlers.Wallet.GetWallet)

			protected.POST("/transfers", handlers.Transfer.CreateTransfer)
			protected.GET("/transfers", handlers.Transfer.ListTransfers)
			protected.GET("/transfers/:id", handlers.Transfer.GetTransfer)
		}
	}

	return r
}
