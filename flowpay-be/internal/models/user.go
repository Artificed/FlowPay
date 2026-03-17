package models

import "gorm.io/gorm"

type User struct {
	Base
	DeletedAt    gorm.DeletedAt `gorm:"index"                                json:"-"`
	Email        string         `gorm:"uniqueIndex;not null;size:320"        json:"email"`
	PasswordHash string         `gorm:"not null;size:255"                    json:"-"`
	DisplayName  string         `gorm:"not null;size:100"                    json:"display_name"`
	AvatarURL    string         `gorm:"size:2048"                            json:"avatar_url,omitempty"`
	Wallet       *Wallet        `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE"`
}
