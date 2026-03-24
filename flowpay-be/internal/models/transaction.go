package models

import "github.com/google/uuid"

type TransactionStatus string

const (
	TransactionStatusPending    TransactionStatus = "pending"
	TransactionStatusProcessing TransactionStatus = "processing"
	TransactionStatusCompleted  TransactionStatus = "completed"
	TransactionStatusFailed     TransactionStatus = "failed"
	TransactionStatusReversed   TransactionStatus = "reversed"
)

type TransactionType string

const (
	TransactionTypeTransfer TransactionType = "transfer"
	TransactionTypeDeposit  TransactionType = "deposit"
)

type Transaction struct {
	Base
	ReferenceCode     string            `gorm:"uniqueIndex;not null;size:64"             json:"reference_code"`
	CorrelationID     string            `gorm:"not null;default:'';size:36"              json:"correlation_id,omitempty"`
	SenderWalletID    *uuid.UUID        `gorm:"type:uuid;index"                          json:"sender_wallet_id"`
	RecipientWalletID uuid.UUID         `gorm:"type:uuid;not null;index"                 json:"recipient_wallet_id"`
	Amount            int64             `gorm:"not null"                                 json:"amount"`
	Currency          string            `gorm:"not null;size:3"                          json:"currency"`
	Note              string            `gorm:"size:500"                                 json:"note,omitempty"`
	Status            TransactionStatus `gorm:"not null;default:'pending';size:20;index" json:"status"`
	Type              TransactionType   `gorm:"not null;default:'transfer';size:20"      json:"type"`
	SenderName    *string `gorm:"-" json:"sender_name,omitempty"`
	RecipientName *string `gorm:"-" json:"recipient_name,omitempty"`
}
