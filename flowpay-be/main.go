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
	temporalworker "flowpay-be/internal/temporal"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))

	cfg := config.Load()

	if cfg.JWTSecret == "" {
		slog.Error("JWT_SECRET env var is required")
		os.Exit(1)
	}

	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		slog.Error("database: connect failed", "error", err)
		os.Exit(1)
	}

	if err := database.RunMigrations(pgURL()); err != nil {
		slog.Error("database: migrations failed", "error", err)
		os.Exit(1)
	}

	userRepo := repository.NewUserRepository(db)
	walletRepo := repository.NewWalletRepository(db)
	balanceRepo := repository.NewWalletBalanceRepository(db)
	holdRepo := repository.NewWalletHoldRepository(db)
	txRepo := repository.NewTransactionRepository(db)

	authSvc := service.NewAuthService(db, userRepo, cfg.JWTSecret, cfg.JWTExpiryHours)
	walletSvc := service.NewWalletService(db, walletRepo, balanceRepo)
	transferSvc := service.NewTransferService(db, walletRepo, balanceRepo, holdRepo, txRepo)

	temporalClient, err := temporalworker.NewClient(cfg.TemporalAddress)
	if err != nil {
		slog.Error("temporal: connect failed", "error", err)
		os.Exit(1)
	}
	defer temporalClient.Close()

	worker := temporalworker.NewWorker(temporalClient, transferSvc)
	if err := worker.Start(); err != nil {
		slog.Error("temporal: worker start failed", "error", err)
		os.Exit(1)
	}

	router := api.NewRouter(api.Handlers{
		Auth:     handler.NewAuthHandler(authSvc),
		Wallet:   handler.NewWalletHandler(walletSvc),
		Transfer: handler.NewTransferHandler(transferSvc, walletSvc, temporalClient),
		Health:   handler.NewHealthHandler(db),
	}, cfg.JWTSecret)

	addr := fmt.Sprintf(":%s", cfg.Port)
	srv := &http.Server{Addr: addr, Handler: router}

	go func() {
		slog.Info("server: listening", "addr", addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("server: listen failed", "error", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("server: shutting down")

	worker.Stop()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("server: forced shutdown", "error", err)
		os.Exit(1)
	}
	slog.Info("server: stopped")
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
