package config

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	DatabaseURL      string
	Port             string
	JWTSecret        string
	JWTExpiryHours   int
}

func Load() *Config {
	host := getEnv("DB_HOST", "localhost")
	port := getEnv("DB_PORT", "5432")
	name := getEnv("DB_NAME", "flowpay")
	user := getEnv("DB_USER", "flowpay")
	password := getEnv("DB_PASSWORD", "flowpay")

	dsn := fmt.Sprintf(
		"host=%s port=%s dbname=%s user=%s password=%s sslmode=disable TimeZone=UTC",
		host, port, name, user, password,
	)

	jwtExpiry, _ := strconv.Atoi(getEnv("JWT_EXPIRY_HOURS", "24"))

	return &Config{
		DatabaseURL:    dsn,
		Port:           getEnv("PORT", "8080"),
		JWTSecret:      getEnv("JWT_SECRET", ""),
		JWTExpiryHours: jwtExpiry,
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
