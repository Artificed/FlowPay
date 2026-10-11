package database

import (
	"bytes"
	"encoding/json"
	"errors"
	"log/slog"
	"strings"
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type row struct {
	ID    int
	Email string
}

func TestNewLogger_SkipsRecordNotFoundAndWritesJSON(t *testing.T) {
	var logs bytes.Buffer
	previous := slog.Default()
	slog.SetDefault(slog.New(slog.NewJSONHandler(&logs, nil)))
	t.Cleanup(func() { slog.SetDefault(previous) })

	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	db, err := gorm.Open(postgres.New(postgres.Config{Conn: sqlDB}), &gorm.Config{Logger: newLogger()})
	if err != nil {
		t.Fatalf("failed to open gorm with sqlmock: %v", err)
	}

	mock.ExpectQuery(`SELECT`).WillReturnRows(sqlmock.NewRows([]string{"id", "email"}))
	if err := db.Where("email = ?", "someone@example.com").First(&row{}).Error; !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("expected record not found, got %v", err)
	}
	if logs.Len() != 0 {
		t.Fatalf("expected no log line for record not found, got %q", logs.String())
	}

	mock.ExpectQuery(`SELECT`).WillReturnError(errors.New("connection reset"))
	_ = db.Where("email = ?", "someone@example.com").First(&row{}).Error

	var line map[string]any
	if err := json.Unmarshal(bytes.TrimSpace(logs.Bytes()), &line); err != nil {
		t.Fatalf("log line is not JSON: %q", logs.String())
	}
	if line["level"] != "ERROR" {
		t.Errorf("expected an ERROR line, got %v", line)
	}
	if strings.Contains(logs.String(), "someone@example.com") {
		t.Errorf("query values leaked into the log: %q", logs.String())
	}
}
