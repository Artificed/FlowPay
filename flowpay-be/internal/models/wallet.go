package models

import "github.com/google/uuid"

type WalletStatus string

const (
	WalletStatusActive    WalletStatus = "active"
	WalletStatusSuspended WalletStatus = "suspended"
	WalletStatusClosed    WalletStatus = "closed"
)

type Wallet struct {
	Base
	UserID   uuid.UUID       `gorm:"type:uuid;uniqueIndex;not null"    json:"user_id"`
	Status   WalletStatus    `gorm:"not null;default:'active';size:20" json:"status"`
	User     *User           `gorm:"foreignKey:UserID"`
	Balances []WalletBalance `gorm:"foreignKey:WalletID;constraint:OnDelete:CASCADE"`
}
