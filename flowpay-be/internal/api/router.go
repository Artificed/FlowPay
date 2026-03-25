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
	Auth             *handler.AuthHandler
	Wallet           *handler.WalletHandler
	Transfer         *handler.TransferHandler
	Health           *handler.HealthHandler
	ScheduledPayment *handler.ScheduledPaymentHandler
	User             *handler.UserHandler
}

func NewRouter(handlers Handlers, jwtSecret string, corsOrigins []string) *gin.Engine {
	r := gin.Default()

	r.Use(middleware.RequestID())
	r.Use(cors.New(cors.Config{
		AllowOrigins:     corsOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", middleware.RequestIDHeader, "Idempotency-Key"},
		ExposeHeaders:    []string{middleware.RequestIDHeader},
		AllowCredentials: true,
	}))

	if gin.Mode() != gin.ReleaseMode {
		r.GET("/docs/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
	}

	v1 := r.Group("/api")
	{
		v1.GET("/health", handlers.Health.Health)
		v1.GET("/currencies", handler.GetCurrencies)

		auth := v1.Group("/auth")
		{
			auth.POST("/register", handlers.Auth.Register)
			auth.POST("/login", handlers.Auth.Login)
		}

		protected := v1.Group("/", middleware.Auth(jwtSecret))
		{
			protected.GET("/wallet", handlers.Wallet.GetWallet)
			protected.POST("/wallet/deposit", handlers.Wallet.Deposit)

			protected.POST("/transfers", handlers.Transfer.CreateTransfer)
			protected.GET("/transfers", handlers.Transfer.ListTransfers)
			protected.GET("/transfers/stream", handlers.Transfer.StreamTransactions)
			protected.GET("/transfers/export", handlers.Transfer.ExportTransfers)
			protected.GET("/transfers/:id", handlers.Transfer.GetTransfer)
			protected.POST("/transfers/:id/reverse", handlers.Transfer.ReverseTransfer)

			protected.POST("/scheduled-payments", handlers.ScheduledPayment.Create)
			protected.GET("/scheduled-payments", handlers.ScheduledPayment.List)
			protected.DELETE("/scheduled-payments/:id", handlers.ScheduledPayment.Cancel)
			protected.PATCH("/scheduled-payments/:id/reactivate", handlers.ScheduledPayment.Reactivate)

			protected.PUT("/profile/avatar", handlers.User.UpdateAvatar)
			protected.DELETE("/profile/avatar", handlers.User.RemoveAvatar)
			protected.PATCH("/profile", handlers.User.UpdateProfile)
			protected.PATCH("/profile/password", handlers.User.ChangePassword)
		}
	}

	return r
}
