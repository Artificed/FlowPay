package models

import (
	"time"

	"github.com/google/uuid"
)

type ScheduledPaymentStatus string

const (
	ScheduledPaymentStatusActive   ScheduledPaymentStatus = "active"
	ScheduledPaymentStatusInactive ScheduledPaymentStatus = "inactive"
)

type ScheduledPayment struct {
	Base
	UserID            uuid.UUID              `gorm:"not null"          json:"user_id"`
	RecipientWalletID uuid.UUID              `gorm:"not null"          json:"recipient_wallet_id"`
	Amount            int64                  `gorm:"not null"          json:"amount"`
	Currency          string                 `gorm:"not null;size:3"   json:"currency"`
	Note              string                 `gorm:"size:500"          json:"note"`
	IntervalDays      int                    `gorm:"not null"          json:"interval_days"`
	NextRunAt         time.Time              `gorm:"not null"          json:"next_run_at"`
	Status            ScheduledPaymentStatus `gorm:"not null;default:active" json:"status"`
	WorkflowID        string                 `gorm:"not null;size:255" json:"workflow_id"`
}
