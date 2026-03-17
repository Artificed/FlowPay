package main

import (
	"flowpay-be/internal/api"
	"flowpay-be/internal/api/handler"
	"flowpay-be/internal/config"
	"flowpay-be/internal/database"
	"flowpay-be/internal/repository"
	"flowpay-be/internal/service"
	"fmt"
	"log"
	"os"
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
	authService := service.NewAuthService(db, userRepo, cfg.JWTSecret, cfg.JWTExpiryHours)
	authHandler := handler.NewAuthHandler(authService)

	router := api.NewRouter(api.Handlers{
		Auth: authHandler,
	}, cfg.JWTSecret)

	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("server: listening on %s", addr)
	if err := router.Run(addr); err != nil {
		log.Fatalf("server: %v", err)
	}
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
