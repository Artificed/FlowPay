package config

import (
	"net"
	"net/url"
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
	sslMode := getEnv("DB_SSLMODE", "disable")
	sslRootCert := getEnv("DB_SSLROOTCERT", "")

	query := url.Values{"sslmode": {sslMode}, "TimeZone": {"UTC"}}
	if sslRootCert != "" {
		query.Set("sslrootcert", sslRootCert)
	}
	databaseURL := url.URL{
		Scheme:   "postgres",
		User:     url.UserPassword(user, password),
		Host:     net.JoinHostPort(host, port),
		Path:     name,
		RawQuery: query.Encode(),
	}

	jwtExpiry, err := strconv.Atoi(getEnv("JWT_EXPIRY_HOURS", "24"))
	if err != nil {
		jwtExpiry = 24
	}

	corsOrigins := strings.Split(getEnv("CORS_ORIGINS", "http://localhost:5173,http://localhost"), ",")

	return &Config{
		DatabaseURL:     databaseURL.String(),
		Port:            getEnv("PORT", "8080"),
		JWTSecret:       getEnv("JWT_SECRET", ""),
		JWTExpiryHours:  jwtExpiry,
		TemporalAddress: getEnv("TEMPORAL_ADDRESS", "temporal:7233"),
		CORSOrigins:     corsOrigins,
		MinioEndpoint:   getEnv("MINIO_ENDPOINT", "minio:9000"),
		MinioPublicURL:  getEnv("MINIO_PUBLIC_URL", "http://localhost:9000"),
		MinioAccessKey:  getEnv("MINIO_ACCESS_KEY", ""),
		MinioSecretKey:  getEnv("MINIO_SECRET_KEY", ""),
		MinioBucket:     getEnv("MINIO_BUCKET", "flowpay"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
