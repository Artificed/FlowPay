package models

import "github.com/google/uuid"

type Wallet struct {
	Base
	UserID   uuid.UUID       `gorm:"type:uuid;uniqueIndex;not null" json:"user_id"`
	User     *User           `gorm:"foreignKey:UserID"`
	Balances []WalletBalance `gorm:"foreignKey:WalletID;constraint:OnDelete:CASCADE"`
}
