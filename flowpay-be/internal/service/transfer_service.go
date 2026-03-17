package service

import (
	"context"
	"crypto/rand"
	"errors"
	"flowpay-be/internal/models"
	"flowpay-be/internal/repository"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrInsufficientFunds = errors.New("insufficient funds")
	ErrSelfTransfer      = errors.New("cannot transfer to yourself")
	ErrInvalidAmount     = errors.New("amount must be greater than zero")
)

type TransferInput struct {
	SenderUserID      uuid.UUID
	RecipientWalletID uuid.UUID
	Amount            int64
	Currency          string
	Note              string
}

type TransferService interface {
	Transfer(ctx context.Context, input TransferInput) (*models.Transaction, error)
	GetTransaction(ctx context.Context, id, walletID uuid.UUID) (*models.Transaction, error)
	ListTransactions(ctx context.Context, walletID uuid.UUID, limit, offset int) ([]models.Transaction, error)
}

type transferService struct {
	db          *gorm.DB
	walletRepo  repository.WalletRepository
	balanceRepo repository.WalletBalanceRepository
	holdRepo    repository.WalletHoldRepository
	txRepo      repository.TransactionRepository
}

func NewTransferService(
	db *gorm.DB,
	walletRepo repository.WalletRepository,
	balanceRepo repository.WalletBalanceRepository,
	holdRepo repository.WalletHoldRepository,
	txRepo repository.TransactionRepository,
) TransferService {
	return &transferService{
		db:          db,
		walletRepo:  walletRepo,
		balanceRepo: balanceRepo,
		holdRepo:    holdRepo,
		txRepo:      txRepo,
	}
}

func (s *transferService) Transfer(ctx context.Context, input TransferInput) (*models.Transaction, error) {
	if input.Amount <= 0 {
		return nil, ErrInvalidAmount
	}

	senderWallet, err := s.walletRepo.FindByUserID(ctx, input.SenderUserID)
	if err != nil {
		return nil, fmt.Errorf("sender wallet not found: %w", err)
	}

	if senderWallet.ID == input.RecipientWalletID {
		return nil, ErrSelfTransfer
	}

	_, err = s.walletRepo.FindByID(ctx, input.RecipientWalletID)
	if err != nil {
		return nil, fmt.Errorf("recipient wallet not found: %w", err)
	}

	var txn *models.Transaction
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		senderBalance, err := s.balanceRepo.LockForUpdate(ctx, tx, senderWallet.ID, input.Currency)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrInsufficientFunds
			}
			return err
		}

		if senderBalance.AvailableAmount < input.Amount {
			return ErrInsufficientFunds
		}

		txn = &models.Transaction{
			ReferenceCode:     generateReferenceCode(),
			SenderWalletID:    senderWallet.ID,
			RecipientWalletID: input.RecipientWalletID,
			Amount:            input.Amount,
			Currency:          input.Currency,
			Note:              input.Note,
			Status:            models.TransactionStatusProcessing,
		}
		if err := s.txRepo.Create(ctx, tx, txn); err != nil {
			return err
		}

		hold := &models.WalletHold{
			WalletBalanceID: senderBalance.ID,
			TransactionID:   txn.ID,
			Amount:          input.Amount,
			Status:          models.HoldStatusPending,
		}
		if err := s.holdRepo.Create(ctx, tx, hold); err != nil {
			return err
		}
		if err := s.balanceRepo.UpdateAmounts(ctx, tx, senderBalance.ID, 0, -input.Amount); err != nil {
			return err
		}

		if err := s.balanceRepo.UpdateAmounts(ctx, tx, senderBalance.ID, -input.Amount, 0); err != nil {
			return err
		}
		if err := s.holdRepo.UpdateStatus(ctx, tx, hold.ID, models.HoldStatusSettled); err != nil {
			return err
		}

		recipientBalance, err := s.balanceRepo.FindOrCreate(ctx, tx, input.RecipientWalletID, input.Currency)
		if err != nil {
			return err
		}
		if err := s.balanceRepo.UpdateAmounts(ctx, tx, recipientBalance.ID, input.Amount, input.Amount); err != nil {
			return err
		}

		return s.txRepo.UpdateStatus(ctx, tx, txn.ID, models.TransactionStatusCompleted)
	})
	if err != nil {
		return nil, err
	}

	txn.Status = models.TransactionStatusCompleted
	return txn, nil
}

func (s *transferService) GetTransaction(ctx context.Context, id, walletID uuid.UUID) (*models.Transaction, error) {
	txn, err := s.txRepo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if txn.SenderWalletID != walletID && txn.RecipientWalletID != walletID {
		return nil, gorm.ErrRecordNotFound
	}
	return txn, nil
}

func (s *transferService) ListTransactions(ctx context.Context, walletID uuid.UUID, limit, offset int) ([]models.Transaction, error) {
	return s.txRepo.ListByWallet(ctx, walletID, limit, offset)
}

func generateReferenceCode() string {
	b := make([]byte, 3)
	rand.Read(b)
	return fmt.Sprintf("FP-%s-%X", time.Now().UTC().Format("20060102"), b)
}
