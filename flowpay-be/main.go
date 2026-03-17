package main

import (
	"flowpay-be/internal/config"
	"flowpay-be/internal/database"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()

	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database: connect failed: %v", err)
	}

	if err := database.RunMigrations(pgURL(), "file://internal/database/migrations"); err != nil {
		log.Fatalf("database: migrations failed: %v", err)
	}

	_ = db

	router := gin.Default()
	router.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "pong"})
	})

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
