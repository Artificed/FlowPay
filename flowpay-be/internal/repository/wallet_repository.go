package repository

import (
	"context"
	"flowpay-be/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type WalletRepository interface {
	FindByUserID(ctx context.Context, userID uuid.UUID) (*models.Wallet, error)
	FindByID(ctx context.Context, id uuid.UUID) (*models.Wallet, error)
}

type walletRepository struct {
	db *gorm.DB
}

func NewWalletRepository(db *gorm.DB) WalletRepository {
	return &walletRepository{db: db}
}

func (r *walletRepository) FindByUserID(ctx context.Context, userID uuid.UUID) (*models.Wallet, error) {
	var wallet models.Wallet
	if err := r.db.WithContext(ctx).Preload("Balances").Where("user_id = ?", userID).First(&wallet).Error; err != nil {
		return nil, err
	}
	return &wallet, nil
}

func (r *walletRepository) FindByID(ctx context.Context, id uuid.UUID) (*models.Wallet, error) {
	var wallet models.Wallet
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&wallet).Error; err != nil {
		return nil, err
	}
	return &wallet, nil
}
