package models

import "github.com/google/uuid"

type WalletBalance struct {
	Base
	WalletID        uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_wallet_currency" json:"wallet_id"`
	Currency        string    `gorm:"not null;size:3;uniqueIndex:idx_wallet_currency"    json:"currency"` // ISO 4217
	TotalAmount     int64     `gorm:"not null;default:0"                                 json:"total_amount"`
	AvailableAmount int64     `gorm:"not null;default:0"                                 json:"available_amount"`
}
