package models

import "github.com/google/uuid"

type Wallet struct {
	Base
	UserID   uuid.UUID       `gorm:"type:uuid;uniqueIndex;not null" json:"user_id"`
	Balances []WalletBalance `gorm:"foreignKey:WalletID;constraint:OnDelete:CASCADE" json:"balances"`
}
