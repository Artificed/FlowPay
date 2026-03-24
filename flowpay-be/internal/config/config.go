package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	DatabaseURL     string
	Port            string
	JWTSecret       string
	JWTExpiryHours  int
	TemporalAddress string
	CORSOrigins     []string
	migrationURL    string
	MinioEndpoint   string
	MinioPublicURL  string
	MinioAccessKey  string
	MinioSecretKey  string
	MinioBucket     string
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

	jwtExpiry, err := strconv.Atoi(getEnv("JWT_EXPIRY_HOURS", "24"))
	if err != nil {
		jwtExpiry = 24
	}

	corsOrigins := strings.Split(getEnv("CORS_ORIGINS", "http://localhost:5173,http://localhost"), ",")

	return &Config{
		DatabaseURL:     dsn,
		Port:            getEnv("PORT", "8080"),
		JWTSecret:       getEnv("JWT_SECRET", ""),
		JWTExpiryHours:  jwtExpiry,
		TemporalAddress: getEnv("TEMPORAL_ADDRESS", "temporal:7233"),
		CORSOrigins:     corsOrigins,
		migrationURL: fmt.Sprintf(
			"postgres://%s:%s@%s:%s/%s?sslmode=disable",
			user, password, host, port, name,
		),
		MinioEndpoint:  getEnv("MINIO_ENDPOINT", "minio:9000"),
		MinioPublicURL: getEnv("MINIO_PUBLIC_URL", "http://localhost:9000"),
		MinioAccessKey: getEnv("MINIO_ACCESS_KEY", ""),
		MinioSecretKey: getEnv("MINIO_SECRET_KEY", ""),
		MinioBucket:    getEnv("MINIO_BUCKET", "flowpay"),
	}
}

func (c *Config) MigrationURL() string {
	return c.migrationURL
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
