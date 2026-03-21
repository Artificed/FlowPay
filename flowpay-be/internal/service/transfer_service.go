package service

import (
	"context"
	"crypto/rand"
	"errors"
	"flowpay-be/internal/currency"
	"flowpay-be/internal/models"
	"flowpay-be/internal/repository"
	"flowpay-be/internal/reqctx"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"gorm.io/gorm"
)

var (
	ErrInsufficientFunds            = errors.New("insufficient funds")
	ErrSelfTransfer                 = errors.New("cannot transfer to yourself")
	ErrInvalidAmount                = errors.New("amount must be greater than zero")
	ErrTransactionNotReversible     = errors.New("transaction cannot be reversed")
	ErrNotTransactionSender         = errors.New("only the sender can reverse a transaction")
	ErrInsufficientFundsForReversal = errors.New("recipient has insufficient funds to reverse this transaction")
)

type TransferInput struct {
	SenderUserID      uuid.UUID
	RecipientWalletID uuid.UUID
	Amount            int64
	Currency          string
	Note              string
}

type TransferValidation struct {
	SenderWalletID    uuid.UUID
	RecipientWalletID uuid.UUID
}

type TransferService interface {
	ValidateTransfer(ctx context.Context, input TransferInput) (*TransferValidation, error)
	CreateTransaction(ctx context.Context, input TransferInput, senderWalletID uuid.UUID) (*models.Transaction, error)
	HoldFunds(ctx context.Context, txnID uuid.UUID) error
	DebitSender(ctx context.Context, txnID uuid.UUID) error
	CreditRecipient(ctx context.Context, txnID uuid.UUID) error
	MarkTransactionFailed(ctx context.Context, txnID uuid.UUID) error
	ReverseTransfer(ctx context.Context, txnID uuid.UUID, requesterWalletID uuid.UUID) (*models.Transaction, error)
	GetTransaction(ctx context.Context, id, walletID uuid.UUID) (*models.Transaction, error)
	ListTransactions(ctx context.Context, walletID uuid.UUID, limit, offset int) ([]models.Transaction, error)
	CountTransactions(ctx context.Context, walletID uuid.UUID) (int64, error)
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


func (s *transferService) ValidateTransfer(ctx context.Context, input TransferInput) (*TransferValidation, error) {
	if input.Amount <= 0 {
		return nil, ErrInvalidAmount
	}
	if !currency.IsSupported(input.Currency) {
		return nil, currency.ErrUnsupportedCurrency
	}

	senderWallet, err := s.walletRepo.FindByUserID(ctx, input.SenderUserID)
	if err != nil {
		return nil, fmt.Errorf("sender wallet not found: %w", err)
	}

	if senderWallet.ID == input.RecipientWalletID {
		return nil, ErrSelfTransfer
	}

	if _, err = s.walletRepo.FindByID(ctx, input.RecipientWalletID); err != nil {
		return nil, fmt.Errorf("recipient wallet not found: %w", err)
	}

	return &TransferValidation{
		SenderWalletID:    senderWallet.ID,
		RecipientWalletID: input.RecipientWalletID,
	}, nil
}

func (s *transferService) CreateTransaction(ctx context.Context, input TransferInput, senderWalletID uuid.UUID) (*models.Transaction, error) {
	for range 3 {
		txn := &models.Transaction{
			ReferenceCode:     generateReferenceCode(),
			CorrelationID:     reqctx.GetRequestID(ctx),
			SenderWalletID:    &senderWalletID,
			RecipientWalletID: input.RecipientWalletID,
			Amount:            input.Amount,
			Currency:          input.Currency,
			Note:              input.Note,
			Status:            models.TransactionStatusPending,
			Type:              models.TransactionTypeTransfer,
		}
		err := s.txRepo.Create(ctx, nil, txn)
		if err == nil {
			return txn, nil
		}
		if !isUniqueViolation(err) {
			return nil, err
		}
	}
	return nil, fmt.Errorf("failed to generate unique reference code after 3 attempts")
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

func (s *transferService) HoldFunds(ctx context.Context, txnID uuid.UUID) error {
	if existing, err := s.holdRepo.FindByTransactionID(ctx, txnID); err == nil && existing != nil {
		return nil
	}

	txn, err := s.txRepo.FindByID(ctx, txnID)
	if err != nil {
		return fmt.Errorf("transaction not found: %w", err)
	}

	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		senderBalance, err := s.balanceRepo.LockForUpdate(ctx, tx, *txn.SenderWalletID, txn.Currency)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrInsufficientFunds
			}
			return err
		}

		if senderBalance.AvailableAmount < txn.Amount {
			return ErrInsufficientFunds
		}

		hold := &models.WalletHold{
			WalletBalanceID: senderBalance.ID,
			TransactionID:   txnID,
			Amount:          txn.Amount,
			Status:          models.HoldStatusPending,
		}
		if err := s.holdRepo.Create(ctx, tx, hold); err != nil {
			return err
		}

		if err := s.balanceRepo.UpdateAmounts(ctx, tx, senderBalance.ID, 0, -txn.Amount); err != nil {
			return err
		}

		return s.txRepo.UpdateStatus(ctx, tx, txnID, models.TransactionStatusProcessing)
	})
}

func (s *transferService) MarkTransactionFailed(ctx context.Context, txnID uuid.UUID) error {
	return s.txRepo.UpdateStatus(ctx, nil, txnID, models.TransactionStatusFailed)
}

func (s *transferService) DebitSender(ctx context.Context, txnID uuid.UUID) error {
	hold, err := s.holdRepo.FindByTransactionID(ctx, txnID)
	if err != nil {
		return fmt.Errorf("hold not found for transaction: %w", err)
	}

	if hold.Status == models.HoldStatusSettled {
		return nil
	}

	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := s.balanceRepo.UpdateAmounts(ctx, tx, hold.WalletBalanceID, -hold.Amount, 0); err != nil {
			return err
		}
		return s.holdRepo.UpdateStatus(ctx, tx, hold.ID, models.HoldStatusSettled)
	})
}

func (s *transferService) CreditRecipient(ctx context.Context, txnID uuid.UUID) error {
	txn, err := s.txRepo.FindByID(ctx, txnID)
	if err != nil {
		return fmt.Errorf("transaction not found: %w", err)
	}

	if txn.Status == models.TransactionStatusCompleted {
		return nil
	}

	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		recipientBalance, err := s.balanceRepo.FindOrCreate(ctx, tx, txn.RecipientWalletID, txn.Currency)
		if err != nil {
			return err
		}

		if err := s.balanceRepo.UpdateAmounts(ctx, tx, recipientBalance.ID, txn.Amount, txn.Amount); err != nil {
			return err
		}

		return s.txRepo.UpdateStatus(ctx, tx, txnID, models.TransactionStatusCompleted)
	})
}

func (s *transferService) ReverseTransfer(ctx context.Context, txnID uuid.UUID, requesterWalletID uuid.UUID) (*models.Transaction, error) {
	txn, err := s.txRepo.FindByID(ctx, txnID)
	if err != nil {
		return nil, fmt.Errorf("transaction not found: %w", err)
	}

	if txn.SenderWalletID == nil || *txn.SenderWalletID != requesterWalletID {
		return nil, ErrNotTransactionSender
	}

	if txn.Status == models.TransactionStatusReversed {
		return txn, nil
	}

	if txn.Status != models.TransactionStatusCompleted && txn.Status != models.TransactionStatusProcessing {
		return nil, ErrTransactionNotReversible
	}

	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if txn.Status == models.TransactionStatusCompleted {
			recipientBalance, err := s.balanceRepo.LockForUpdate(ctx, tx, txn.RecipientWalletID, txn.Currency)
			if err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return ErrInsufficientFundsForReversal
				}
				return err
			}

			if recipientBalance.TotalAmount < txn.Amount || recipientBalance.AvailableAmount < txn.Amount {
				return ErrInsufficientFundsForReversal
			}

			if err := s.balanceRepo.UpdateAmounts(ctx, tx, recipientBalance.ID, -txn.Amount, -txn.Amount); err != nil {
				return err
			}
		}

		senderBalance, err := s.balanceRepo.FindOrCreate(ctx, tx, *txn.SenderWalletID, txn.Currency)
		if err != nil {
			return err
		}

		if err := s.balanceRepo.UpdateAmounts(ctx, tx, senderBalance.ID, txn.Amount, txn.Amount); err != nil {
			return err
		}

		hold, err := s.holdRepo.FindByTransactionID(ctx, txnID)
		if err == nil && hold != nil {
			if err := s.holdRepo.UpdateStatus(ctx, tx, hold.ID, models.HoldStatusReleased); err != nil {
				return err
			}
		}

		return s.txRepo.UpdateStatus(ctx, tx, txnID, models.TransactionStatusReversed)
	})
	if err != nil {
		return nil, err
	}

	txn.Status = models.TransactionStatusReversed
	return txn, nil
}

func (s *transferService) GetTransaction(ctx context.Context, id, walletID uuid.UUID) (*models.Transaction, error) {
	txn, err := s.txRepo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if (txn.SenderWalletID == nil || *txn.SenderWalletID != walletID) && txn.RecipientWalletID != walletID {
		return nil, gorm.ErrRecordNotFound
	}
	return txn, nil
}

func (s *transferService) ListTransactions(ctx context.Context, walletID uuid.UUID, limit, offset int) ([]models.Transaction, error) {
	return s.txRepo.ListByWallet(ctx, walletID, limit, offset)
}

func (s *transferService) CountTransactions(ctx context.Context, walletID uuid.UUID) (int64, error) {
	return s.txRepo.CountByWallet(ctx, walletID)
}

func generateReferenceCode() string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		panic(fmt.Sprintf("crypto/rand failed: %v", err))
	}
	return fmt.Sprintf("FP-%s-%X", time.Now().UTC().Format("20060102"), b)
}
