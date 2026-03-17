package repository

import (
	"context"
	"flowpay-be/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type TransactionRepository interface {
	Create(ctx context.Context, tx *gorm.DB, transaction *models.Transaction) error
	FindByID(ctx context.Context, id uuid.UUID) (*models.Transaction, error)
	ListByWallet(ctx context.Context, walletID uuid.UUID, limit, offset int) ([]models.Transaction, error)
	UpdateStatus(ctx context.Context, tx *gorm.DB, id uuid.UUID, status models.TransactionStatus) error
}

type transactionRepository struct {
	db *gorm.DB
}

func NewTransactionRepository(db *gorm.DB) TransactionRepository {
	return &transactionRepository{db: db}
}

func (r *transactionRepository) conn(tx *gorm.DB) *gorm.DB {
	if tx != nil {
		return tx
	}
	return r.db
}

func (r *transactionRepository) Create(ctx context.Context, tx *gorm.DB, transaction *models.Transaction) error {
	return r.conn(tx).WithContext(ctx).Create(transaction).Error
}

func (r *transactionRepository) FindByID(ctx context.Context, id uuid.UUID) (*models.Transaction, error) {
	var t models.Transaction
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&t).Error; err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *transactionRepository) ListByWallet(ctx context.Context, walletID uuid.UUID, limit, offset int) ([]models.Transaction, error) {
	var transactions []models.Transaction
	if err := r.db.WithContext(ctx).
		Where("sender_wallet_id = ? OR recipient_wallet_id = ?", walletID, walletID).
		Order("created_at DESC").
		Limit(limit).Offset(offset).
		Find(&transactions).Error; err != nil {
		return nil, err
	}
	return transactions, nil
}

func (r *transactionRepository) UpdateStatus(ctx context.Context, tx *gorm.DB, id uuid.UUID, status models.TransactionStatus) error {
	return r.conn(tx).WithContext(ctx).
		Model(&models.Transaction{}).
		Where("id = ?", id).
		Update("status", status).Error
}
