package config

import (
	"net"
	"net/url"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	DatabaseURL         string
	Port                string
	JWTSecret           string
	JWTExpiryHours      int
	TemporalAddress     string
	CORSOrigins         []string
	StorageEndpoint     string
	StorageRegion       string
	StorageUseSSL       bool
	StoragePublicURL    string
	StorageAccessKey    string
	StorageSecretKey    string
	StorageBucket       string
	StorageEnsureBucket bool
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
		DatabaseURL:         databaseURL.String(),
		Port:                getEnv("PORT", "8080"),
		JWTSecret:           getEnv("JWT_SECRET", ""),
		JWTExpiryHours:      jwtExpiry,
		TemporalAddress:     getEnv("TEMPORAL_ADDRESS", "temporal:7233"),
		CORSOrigins:         corsOrigins,
		StorageEndpoint:     getEnv("STORAGE_ENDPOINT", "minio:9000"),
		StorageRegion:       getEnv("STORAGE_REGION", "us-east-1"),
		StorageUseSSL:       getEnvBool("STORAGE_USE_SSL", false),
		StoragePublicURL:    getEnv("STORAGE_PUBLIC_URL", "http://localhost:9000/flowpay"),
		StorageAccessKey:    getEnv("STORAGE_ACCESS_KEY", ""),
		StorageSecretKey:    getEnv("STORAGE_SECRET_KEY", ""),
		StorageBucket:       getEnv("STORAGE_BUCKET", "flowpay"),
		StorageEnsureBucket: getEnvBool("STORAGE_ENSURE_BUCKET", true),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvBool(key string, fallback bool) bool {
	v, err := strconv.ParseBool(os.Getenv(key))
	if err != nil {
		return fallback
	}
	return v
}
