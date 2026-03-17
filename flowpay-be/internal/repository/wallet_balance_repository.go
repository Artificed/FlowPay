package repository

import (
	"context"
	"flowpay-be/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type WalletBalanceRepository interface {
	FindOrCreate(ctx context.Context, tx *gorm.DB, walletID uuid.UUID, currency string) (*models.WalletBalance, error)
	LockForUpdate(ctx context.Context, tx *gorm.DB, walletID uuid.UUID, currency string) (*models.WalletBalance, error)
	UpdateAmounts(ctx context.Context, tx *gorm.DB, id uuid.UUID, totalDelta, availableDelta int64) error
}

type walletBalanceRepository struct {
	db *gorm.DB
}

func NewWalletBalanceRepository(db *gorm.DB) WalletBalanceRepository {
	return &walletBalanceRepository{db: db}
}

func (r *walletBalanceRepository) conn(tx *gorm.DB) *gorm.DB {
	if tx != nil {
		return tx
	}
	return r.db
}

func (r *walletBalanceRepository) FindOrCreate(ctx context.Context, tx *gorm.DB, walletID uuid.UUID, currency string) (*models.WalletBalance, error) {
	balance := &models.WalletBalance{WalletID: walletID, Currency: currency}
	result := r.conn(tx).WithContext(ctx).
		Where("wallet_id = ? AND currency = ?", walletID, currency).
		FirstOrCreate(balance)
	return balance, result.Error
}

func (r *walletBalanceRepository) LockForUpdate(ctx context.Context, tx *gorm.DB, walletID uuid.UUID, currency string) (*models.WalletBalance, error) {
	var balance models.WalletBalance
	if err := r.conn(tx).WithContext(ctx).
		Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("wallet_id = ? AND currency = ?", walletID, currency).
		First(&balance).Error; err != nil {
		return nil, err
	}
	return &balance, nil
}

func (r *walletBalanceRepository) UpdateAmounts(ctx context.Context, tx *gorm.DB, id uuid.UUID, totalDelta, availableDelta int64) error {
	return r.conn(tx).WithContext(ctx).
		Model(&models.WalletBalance{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"total_amount":     gorm.Expr("total_amount + ?", totalDelta),
			"available_amount": gorm.Expr("available_amount + ?", availableDelta),
		}).Error
}
