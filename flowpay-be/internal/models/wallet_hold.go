package models

import (
	"github.com/google/uuid"
)

type HoldStatus string

const (
	HoldStatusPending  HoldStatus = "pending"
	HoldStatusReleased HoldStatus = "released"
	HoldStatusSettled  HoldStatus = "settled"
)

type WalletHold struct {
	Base
	WalletBalanceID uuid.UUID  `gorm:"type:uuid;not null;index"           json:"wallet_balance_id"`
	TransactionID   uuid.UUID  `gorm:"type:uuid;not null;index"           json:"transaction_id"`
	Amount          int64      `gorm:"not null"                           json:"amount"`
	Status          HoldStatus `gorm:"not null;default:'pending';size:20" json:"status"`
}
