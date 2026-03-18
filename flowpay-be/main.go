// @title           FlowPay API
// @version         1.0
// @description     FlowPay payment platform API
// @host            localhost:8080
// @BasePath        /api/v1
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Enter: **Bearer &lt;your token&gt;**
package main

import (
	"context"
	"errors"
	_ "flowpay-be/docs"
	"flowpay-be/internal/api"
	"flowpay-be/internal/api/handler"
	"flowpay-be/internal/config"
	"flowpay-be/internal/database"
	"flowpay-be/internal/repository"
	"flowpay-be/internal/service"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	cfg := config.Load()

	if cfg.JWTSecret == "" {
		log.Fatal("JWT_SECRET env var is required")
	}

	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database: connect failed: %v", err)
	}

	if err := database.RunMigrations(pgURL()); err != nil {
		log.Fatalf("database: migrations failed: %v", err)
	}

	userRepo := repository.NewUserRepository(db)
	walletRepo := repository.NewWalletRepository(db)
	balanceRepo := repository.NewWalletBalanceRepository(db)
	holdRepo := repository.NewWalletHoldRepository(db)
	txRepo := repository.NewTransactionRepository(db)

	authSvc := service.NewAuthService(db, userRepo, cfg.JWTSecret, cfg.JWTExpiryHours)
	walletSvc := service.NewWalletService(db, walletRepo, balanceRepo)
	transferSvc := service.NewTransferService(db, walletRepo, balanceRepo, holdRepo, txRepo)

	router := api.NewRouter(api.Handlers{
		Auth:     handler.NewAuthHandler(authSvc),
		Wallet:   handler.NewWalletHandler(walletSvc),
		Transfer: handler.NewTransferHandler(transferSvc, walletSvc),
		Health:   handler.NewHealthHandler(db),
	}, cfg.JWTSecret)

	addr := fmt.Sprintf(":%s", cfg.Port)
	srv := &http.Server{Addr: addr, Handler: router}

	go func() {
		log.Printf("server: listening on %s", addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("server: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("server: shutting down")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("server: forced shutdown: %v", err)
	}
	log.Println("server: stopped")
}

func pgURL() string {
	return fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s?sslmode=disable",
		envOr("DB_USER", "flowpay"),
		envOr("DB_PASSWORD", "flowpay"),
		envOr("DB_HOST", "localhost"),
		envOr("DB_PORT", "5432"),
		envOr("DB_NAME", "flowpay"),
	)
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
