package service

import (
	"context"
	"errors"
	"flowpay-be/internal/currency"
	"flowpay-be/internal/models"
	"flowpay-be/internal/repository"

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
}

func NewWalletService(db *gorm.DB, walletRepo repository.WalletRepository, balanceRepo repository.WalletBalanceRepository) WalletService {
	return &walletService{db: db, walletRepo: walletRepo, balanceRepo: balanceRepo}
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
		return s.balanceRepo.UpdateAmounts(ctx, tx, balance.ID, input.Amount, input.Amount)
	})
	if err != nil {
		return nil, err
	}

	return s.balanceRepo.FindOrCreate(ctx, s.db, wallet.ID, input.Currency)
}
