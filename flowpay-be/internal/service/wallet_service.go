package service

import (
	"context"
	"flowpay-be/internal/models"
	"flowpay-be/internal/repository"

	"github.com/google/uuid"
)

type WalletService interface {
	GetWallet(ctx context.Context, userID uuid.UUID) (*models.Wallet, error)
}

type walletService struct {
	walletRepo repository.WalletRepository
}

func NewWalletService(walletRepo repository.WalletRepository) WalletService {
	return &walletService{walletRepo: walletRepo}
}

func (s *walletService) GetWallet(ctx context.Context, userID uuid.UUID) (*models.Wallet, error) {
	return s.walletRepo.FindByUserID(ctx, userID)
}
