package service

import (
	"context"
	"errors"
	"flowpay-be/internal/currency"
	"flowpay-be/internal/models"
	"flowpay-be/internal/repository"
	"flowpay-be/internal/reqctx"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var ErrInvalidDepositAmount = errors.New("deposit amount must be greater than zero")

type DepositInput struct {
	UserID   uuid.UUID
	Amount   int64
	Currency string
}

type WalletService interface {
	GetWallet(ctx context.Context, userID uuid.UUID) (*models.Wallet, error)
	Deposit(ctx context.Context, input DepositInput) (*models.WalletBalance, error)
}

type walletService struct {
	db          *gorm.DB
	walletRepo  repository.WalletRepository
	balanceRepo repository.WalletBalanceRepository
	txRepo      repository.TransactionRepository
}

func NewWalletService(db *gorm.DB, walletRepo repository.WalletRepository, balanceRepo repository.WalletBalanceRepository, txRepo repository.TransactionRepository) WalletService {
	return &walletService{db: db, walletRepo: walletRepo, balanceRepo: balanceRepo, txRepo: txRepo}
}

func (s *walletService) GetWallet(ctx context.Context, userID uuid.UUID) (*models.Wallet, error) {
	return s.walletRepo.FindByUserID(ctx, userID)
}

func (s *walletService) Deposit(ctx context.Context, input DepositInput) (*models.WalletBalance, error) {
	if input.Amount <= 0 {
		return nil, ErrInvalidDepositAmount
	}
	if !currency.IsSupported(input.Currency) {
		return nil, currency.ErrUnsupportedCurrency
	}

	wallet, err := s.walletRepo.FindByUserID(ctx, input.UserID)
	if err != nil {
		return nil, err
	}

	var balance *models.WalletBalance
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var err error
		balance, err = s.balanceRepo.FindOrCreate(ctx, tx, wallet.ID, input.Currency)
		if err != nil {
			return err
		}
		if err := s.balanceRepo.UpdateAmounts(ctx, tx, balance.ID, input.Amount, input.Amount); err != nil {
			return err
		}

		for range 3 {
			depTxn := &models.Transaction{
				ReferenceCode:     generateReferenceCode(),
				CorrelationID:     reqctx.GetRequestID(ctx),
				SenderWalletID:    nil,
				RecipientWalletID: wallet.ID,
				Amount:            input.Amount,
				Currency:          input.Currency,
				Status:            models.TransactionStatusCompleted,
				Type:              models.TransactionTypeDeposit,
			}
			err := s.txRepo.Create(ctx, tx, depTxn)
			if err == nil {
				return nil
			}
			if !isUniqueViolation(err) {
				return err
			}
		}
		return fmt.Errorf("failed to generate unique reference code after 3 attempts")
	})
	if err != nil {
		return nil, err
	}

	return s.balanceRepo.FindOrCreate(ctx, s.db, wallet.ID, input.Currency)
}
