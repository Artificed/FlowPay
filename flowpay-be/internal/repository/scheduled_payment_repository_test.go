package repository

import (
	"context"
	"flowpay-be/internal/models"
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestScheduledPaymentIsActive_OnlyForTheCurrentWorkflow(t *testing.T) {
	cases := []struct {
		name       string
		status     models.ScheduledPaymentStatus
		workflowID string
		want       bool
	}{
		{"active, asked by its workflow", models.ScheduledPaymentStatusActive, "scheduled-current", true},
		{"active, asked by a replaced workflow", models.ScheduledPaymentStatusActive, "scheduled-old", false},
		{"inactive, asked by its workflow", models.ScheduledPaymentStatusInactive, "scheduled-current", false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			sqlDB, mock, err := sqlmock.New()
			if err != nil {
				t.Fatalf("failed to create sqlmock: %v", err)
			}
			db, err := gorm.Open(postgres.New(postgres.Config{Conn: sqlDB}), &gorm.Config{
				Logger: logger.Default.LogMode(logger.Silent),
			})
			if err != nil {
				t.Fatalf("failed to open gorm with sqlmock: %v", err)
			}

			mock.ExpectQuery(`SELECT "status","workflow_id" FROM "scheduled_payments"`).
				WillReturnRows(sqlmock.NewRows([]string{"status", "workflow_id"}).AddRow(string(tc.status), "scheduled-current"))

			got, err := NewScheduledPaymentRepository(db).IsActive(context.Background(), uuid.New(), tc.workflowID)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tc.want {
				t.Errorf("IsActive = %v, want %v", got, tc.want)
			}
			if err := mock.ExpectationsWereMet(); err != nil {
				t.Errorf("unfulfilled sqlmock expectations: %v", err)
			}
		})
	}
}
