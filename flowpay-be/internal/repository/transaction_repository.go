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
	CountByWallet(ctx context.Context, walletID uuid.UUID) (int64, error)
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

type txWithNames struct {
	models.Transaction
	SenderName    *string `gorm:"column:sender_name"`
	RecipientName *string `gorm:"column:recipient_name"`
}

func (r *transactionRepository) enrichNames(ctx context.Context, txns []models.Transaction) ([]models.Transaction, error) {
	if len(txns) == 0 {
		return txns, nil
	}

	ids := make([]uuid.UUID, len(txns))
	for i, t := range txns {
		ids[i] = t.ID
	}

	var rows []txWithNames
	err := r.db.WithContext(ctx).
		Table("transactions t").
		Select(`t.*,
			su.display_name AS sender_name,
			ru.display_name AS recipient_name`).
		Joins("LEFT JOIN wallets sw ON sw.id = t.sender_wallet_id").
		Joins("LEFT JOIN users su ON su.id = sw.user_id AND su.deleted_at IS NULL").
		Joins("LEFT JOIN wallets rw ON rw.id = t.recipient_wallet_id").
		Joins("LEFT JOIN users ru ON ru.id = rw.user_id AND ru.deleted_at IS NULL").
		Where("t.id IN ?", ids).
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	nameMap := make(map[uuid.UUID]txWithNames, len(rows))
	for _, row := range rows {
		nameMap[row.ID] = row
	}
	for i, t := range txns {
		if row, ok := nameMap[t.ID]; ok {
			txns[i].SenderName = row.SenderName
			txns[i].RecipientName = row.RecipientName
		}
	}
	return txns, nil
}

func (r *transactionRepository) FindByID(ctx context.Context, id uuid.UUID) (*models.Transaction, error) {
	var t models.Transaction
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&t).Error; err != nil {
		return nil, err
	}
	txns, err := r.enrichNames(ctx, []models.Transaction{t})
	if err != nil {
		return nil, err
	}
	return &txns[0], nil
}

func walletScope(db *gorm.DB, walletID uuid.UUID) *gorm.DB {
	return db.Where(
		"sender_wallet_id = ? OR "+
			"(recipient_wallet_id = ? AND type = ? AND status IN ?) OR "+
			"(recipient_wallet_id = ? AND type = ?)",
		walletID,
		walletID, models.TransactionTypeTransfer,
		[]models.TransactionStatus{models.TransactionStatusCompleted, models.TransactionStatusReversed},
		walletID, models.TransactionTypeDeposit,
	)
}

func (r *transactionRepository) ListByWallet(ctx context.Context, walletID uuid.UUID, limit, offset int) ([]models.Transaction, error) {
	var transactions []models.Transaction
	if err := walletScope(r.db.WithContext(ctx), walletID).
		Order("created_at DESC").
		Limit(limit).Offset(offset).
		Find(&transactions).Error; err != nil {
		return nil, err
	}
	return r.enrichNames(ctx, transactions)
}

func (r *transactionRepository) CountByWallet(ctx context.Context, walletID uuid.UUID) (int64, error) {
	var count int64
	if err := walletScope(r.db.WithContext(ctx).Model(&models.Transaction{}), walletID).
		Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

func (r *transactionRepository) UpdateStatus(ctx context.Context, tx *gorm.DB, id uuid.UUID, status models.TransactionStatus) error {
	return r.conn(tx).WithContext(ctx).
		Model(&models.Transaction{}).
		Where("id = ?", id).
		Update("status", status).Error
}
