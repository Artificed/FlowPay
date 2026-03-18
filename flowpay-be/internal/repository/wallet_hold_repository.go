package repository

import (
	"context"
	"flowpay-be/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type WalletHoldRepository interface {
	Create(ctx context.Context, tx *gorm.DB, hold *models.WalletHold) error
	FindByTransactionID(ctx context.Context, txnID uuid.UUID) (*models.WalletHold, error)
	UpdateStatus(ctx context.Context, tx *gorm.DB, id uuid.UUID, status models.HoldStatus) error
}

type walletHoldRepository struct {
	db *gorm.DB
}

func NewWalletHoldRepository(db *gorm.DB) WalletHoldRepository {
	return &walletHoldRepository{db: db}
}

func (r *walletHoldRepository) conn(tx *gorm.DB) *gorm.DB {
	if tx != nil {
		return tx
	}
	return r.db
}

func (r *walletHoldRepository) Create(ctx context.Context, tx *gorm.DB, hold *models.WalletHold) error {
	return r.conn(tx).WithContext(ctx).Create(hold).Error
}

func (r *walletHoldRepository) FindByTransactionID(ctx context.Context, txnID uuid.UUID) (*models.WalletHold, error) {
	var hold models.WalletHold
	if err := r.db.WithContext(ctx).Where("transaction_id = ?", txnID).First(&hold).Error; err != nil {
		return nil, err
	}
	return &hold, nil
}

func (r *walletHoldRepository) UpdateStatus(ctx context.Context, tx *gorm.DB, id uuid.UUID, status models.HoldStatus) error {
	return r.conn(tx).WithContext(ctx).
		Model(&models.WalletHold{}).
		Where("id = ?", id).
		Update("status", status).Error
}
