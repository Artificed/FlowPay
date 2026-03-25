package service

import (
	"context"
	"errors"
	"flowpay-be/internal/models"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func uuidPtr(id uuid.UUID) *uuid.UUID { return &id }

type mockWalletRepo struct {
	findByUserIDFn func(uuid.UUID) (*models.Wallet, error)
	findByIDFn     func(uuid.UUID) (*models.Wallet, error)
}

func (m *mockWalletRepo) FindByUserID(_ context.Context, id uuid.UUID) (*models.Wallet, error) {
	return m.findByUserIDFn(id)
}

func (m *mockWalletRepo) FindByID(_ context.Context, id uuid.UUID) (*models.Wallet, error) {
	return m.findByIDFn(id)
}

type mockBalanceRepo struct {
	findOrCreateFn  func(walletID uuid.UUID, currency string) (*models.WalletBalance, error)
	lockForUpdateFn func(walletID uuid.UUID, currency string) (*models.WalletBalance, error)
	updateAmountsFn func(id uuid.UUID, totalDelta, availableDelta int64) error
}

func (m *mockBalanceRepo) FindOrCreate(_ context.Context, _ *gorm.DB, walletID uuid.UUID, currency string) (*models.WalletBalance, error) {
	return m.findOrCreateFn(walletID, currency)
}

func (m *mockBalanceRepo) LockForUpdate(_ context.Context, _ *gorm.DB, walletID uuid.UUID, currency string) (*models.WalletBalance, error) {
	return m.lockForUpdateFn(walletID, currency)
}

func (m *mockBalanceRepo) UpdateAmounts(_ context.Context, _ *gorm.DB, id uuid.UUID, totalDelta, availableDelta int64) error {
	return m.updateAmountsFn(id, totalDelta, availableDelta)
}

type mockHoldRepo struct {
	findByTransactionIDFn func(txnID uuid.UUID) (*models.WalletHold, error)
	createFn              func(hold *models.WalletHold) error
	updateStatusFn        func(id uuid.UUID, status models.HoldStatus) error
}

func (m *mockHoldRepo) FindByTransactionID(_ context.Context, txnID uuid.UUID) (*models.WalletHold, error) {
	return m.findByTransactionIDFn(txnID)
}

func (m *mockHoldRepo) Create(_ context.Context, _ *gorm.DB, hold *models.WalletHold) error {
	return m.createFn(hold)
}

func (m *mockHoldRepo) UpdateStatus(_ context.Context, _ *gorm.DB, id uuid.UUID, status models.HoldStatus) error {
	return m.updateStatusFn(id, status)
}

type mockTxRepo struct {
	createFn       func(*models.Transaction) error
	findByIDFn     func(id uuid.UUID) (*models.Transaction, error)
	updateStatusFn func(id uuid.UUID, status models.TransactionStatus) error
	listFn         func(walletID uuid.UUID, limit, offset int) ([]models.Transaction, error)
	countFn        func(walletID uuid.UUID) (int64, error)
}

func (m *mockTxRepo) Create(_ context.Context, _ *gorm.DB, txn *models.Transaction) error {
	return m.createFn(txn)
}

func (m *mockTxRepo) FindByID(_ context.Context, id uuid.UUID) (*models.Transaction, error) {
	return m.findByIDFn(id)
}

func (m *mockTxRepo) UpdateStatus(_ context.Context, _ *gorm.DB, id uuid.UUID, status models.TransactionStatus) error {
	return m.updateStatusFn(id, status)
}

func (m *mockTxRepo) ListByWallet(_ context.Context, walletID uuid.UUID, limit, offset int) ([]models.Transaction, error) {
	return m.listFn(walletID, limit, offset)
}

func (m *mockTxRepo) CountByWallet(_ context.Context, walletID uuid.UUID) (int64, error) {
	return m.countFn(walletID)
}

func (m *mockTxRepo) ExportByWallet(_ context.Context, _ uuid.UUID, _ *time.Time) ([]models.Transaction, error) {
	return nil, nil
}

func newMockDB(t *testing.T) (*gorm.DB, sqlmock.Sqlmock) {
	t.Helper()
	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	db, err := gorm.Open(postgres.New(postgres.Config{Conn: sqlDB}), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("failed to open gorm with sqlmock: %v", err)
	}
	t.Cleanup(func() {
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unfulfilled sqlmock expectations: %v", err)
		}
	})
	return db, mock
}

func uniqueViolationErr() error {
	return &pgconn.PgError{Code: "23505"}
}

func TestValidateTransfer_InvalidAmount(t *testing.T) {
	svc := NewTransferService(nil, &mockWalletRepo{}, &mockBalanceRepo{}, &mockHoldRepo{}, &mockTxRepo{})
	_, err := svc.ValidateTransfer(context.Background(), TransferInput{Amount: 0, Currency: "USD"})
	if !errors.Is(err, ErrInvalidAmount) {
		t.Errorf("expected ErrInvalidAmount, got %v", err)
	}
}

func TestValidateTransfer_UnsupportedCurrency(t *testing.T) {
	svc := NewTransferService(nil, &mockWalletRepo{}, &mockBalanceRepo{}, &mockHoldRepo{}, &mockTxRepo{})
	_, err := svc.ValidateTransfer(context.Background(), TransferInput{Amount: 100, Currency: "XXX"})
	if err == nil {
		t.Error("expected error for unsupported currency")
	}
}

func TestValidateTransfer_SenderNotFound(t *testing.T) {
	walletRepo := &mockWalletRepo{
		findByUserIDFn: func(_ uuid.UUID) (*models.Wallet, error) {
			return nil, gorm.ErrRecordNotFound
		},
	}
	svc := NewTransferService(nil, walletRepo, &mockBalanceRepo{}, &mockHoldRepo{}, &mockTxRepo{})
	_, err := svc.ValidateTransfer(context.Background(), TransferInput{Amount: 100, Currency: "USD"})
	if err == nil {
		t.Error("expected error when sender not found")
	}
}

func TestValidateTransfer_SelfTransfer(t *testing.T) {
	walletID := uuid.New()
	walletRepo := &mockWalletRepo{
		findByUserIDFn: func(_ uuid.UUID) (*models.Wallet, error) {
			return &models.Wallet{Base: models.Base{ID: walletID}}, nil
		},
	}
	svc := NewTransferService(nil, walletRepo, &mockBalanceRepo{}, &mockHoldRepo{}, &mockTxRepo{})
	_, err := svc.ValidateTransfer(context.Background(), TransferInput{
		SenderUserID:      uuid.New(),
		RecipientWalletID: walletID,
		Amount:            100,
		Currency:          "USD",
	})
	if !errors.Is(err, ErrSelfTransfer) {
		t.Errorf("expected ErrSelfTransfer, got %v", err)
	}
}

func TestValidateTransfer_RecipientNotFound(t *testing.T) {
	senderWalletID := uuid.New()
	walletRepo := &mockWalletRepo{
		findByUserIDFn: func(_ uuid.UUID) (*models.Wallet, error) {
			return &models.Wallet{Base: models.Base{ID: senderWalletID}}, nil
		},
		findByIDFn: func(_ uuid.UUID) (*models.Wallet, error) {
			return nil, gorm.ErrRecordNotFound
		},
	}
	svc := NewTransferService(nil, walletRepo, &mockBalanceRepo{}, &mockHoldRepo{}, &mockTxRepo{})
	_, err := svc.ValidateTransfer(context.Background(), TransferInput{
		RecipientWalletID: uuid.New(),
		Amount:            100,
		Currency:          "USD",
	})
	if err == nil {
		t.Error("expected error when recipient not found")
	}
}

func TestValidateTransfer_Success(t *testing.T) {
	senderWalletID := uuid.New()
	recipientWalletID := uuid.New()
	walletRepo := &mockWalletRepo{
		findByUserIDFn: func(_ uuid.UUID) (*models.Wallet, error) {
			return &models.Wallet{Base: models.Base{ID: senderWalletID}}, nil
		},
		findByIDFn: func(_ uuid.UUID) (*models.Wallet, error) {
			return &models.Wallet{Base: models.Base{ID: recipientWalletID}}, nil
		},
	}
	svc := NewTransferService(nil, walletRepo, &mockBalanceRepo{}, &mockHoldRepo{}, &mockTxRepo{})
	validation, err := svc.ValidateTransfer(context.Background(), TransferInput{
		SenderUserID:      uuid.New(),
		RecipientWalletID: recipientWalletID,
		Amount:            100,
		Currency:          "USD",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if validation.SenderWalletID != senderWalletID {
		t.Errorf("expected senderWalletID %v, got %v", senderWalletID, validation.SenderWalletID)
	}
}

func TestCreateTransaction_Success(t *testing.T) {
	txRepo := &mockTxRepo{
		createFn: func(txn *models.Transaction) error {
			txn.ID = uuid.New()
			return nil
		},
	}
	svc := NewTransferService(nil, &mockWalletRepo{}, &mockBalanceRepo{}, &mockHoldRepo{}, txRepo)
	txn, err := svc.CreateTransaction(context.Background(), TransferInput{Amount: 100, Currency: "USD"}, uuid.New())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if txn == nil {
		t.Error("expected non-nil transaction")
	}
}

func TestCreateTransaction_RetryOnUniqueViolation(t *testing.T) {
	calls := 0
	txRepo := &mockTxRepo{
		createFn: func(txn *models.Transaction) error {
			calls++
			if calls < 3 {
				return uniqueViolationErr()
			}
			txn.ID = uuid.New()
			return nil
		},
	}
	svc := NewTransferService(nil, &mockWalletRepo{}, &mockBalanceRepo{}, &mockHoldRepo{}, txRepo)
	txn, err := svc.CreateTransaction(context.Background(), TransferInput{Amount: 100, Currency: "USD"}, uuid.New())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if calls != 3 {
		t.Errorf("expected 3 create attempts, got %d", calls)
	}
	if txn == nil {
		t.Error("expected non-nil transaction")
	}
}

func TestCreateTransaction_FailsAfterMaxRetries(t *testing.T) {
	txRepo := &mockTxRepo{
		createFn: func(_ *models.Transaction) error {
			return uniqueViolationErr()
		},
	}
	svc := NewTransferService(nil, &mockWalletRepo{}, &mockBalanceRepo{}, &mockHoldRepo{}, txRepo)
	_, err := svc.CreateTransaction(context.Background(), TransferInput{Amount: 100, Currency: "USD"}, uuid.New())
	if err == nil {
		t.Error("expected error after max retries exhausted")
	}
}

func TestHoldFunds_Idempotent_AlreadyHeld(t *testing.T) {
	holdRepo := &mockHoldRepo{
		findByTransactionIDFn: func(_ uuid.UUID) (*models.WalletHold, error) {
			return &models.WalletHold{}, nil
		},
	}
	svc := NewTransferService(nil, &mockWalletRepo{}, &mockBalanceRepo{}, holdRepo, &mockTxRepo{})
	if err := svc.HoldFunds(context.Background(), uuid.New()); err != nil {
		t.Errorf("expected nil for idempotent call, got %v", err)
	}
}

func TestHoldFunds_InsufficientFunds(t *testing.T) {
	txnID := uuid.New()
	txn := &models.Transaction{
		Base:           models.Base{ID: txnID},
		SenderWalletID: uuidPtr(uuid.New()),
		Currency:       "USD",
		Amount:         1000,
	}
	balance := &models.WalletBalance{
		Base:            models.Base{ID: uuid.New()},
		AvailableAmount: 500,
	}

	db, mock := newMockDB(t)
	mock.ExpectBegin()
	mock.ExpectRollback()

	holdRepo := &mockHoldRepo{
		findByTransactionIDFn: func(_ uuid.UUID) (*models.WalletHold, error) {
			return nil, gorm.ErrRecordNotFound
		},
	}
	txRepo := &mockTxRepo{
		findByIDFn: func(_ uuid.UUID) (*models.Transaction, error) { return txn, nil },
	}
	balanceRepo := &mockBalanceRepo{
		lockForUpdateFn: func(_ uuid.UUID, _ string) (*models.WalletBalance, error) {
			return balance, nil
		},
	}

	svc := NewTransferService(db, &mockWalletRepo{}, balanceRepo, holdRepo, txRepo)
	if err := svc.HoldFunds(context.Background(), txnID); !errors.Is(err, ErrInsufficientFunds) {
		t.Errorf("expected ErrInsufficientFunds, got %v", err)
	}
}

func TestHoldFunds_Success(t *testing.T) {
	txnID := uuid.New()
	txn := &models.Transaction{
		Base:           models.Base{ID: txnID},
		SenderWalletID: uuidPtr(uuid.New()),
		Currency:       "USD",
		Amount:         500,
	}
	balanceID := uuid.New()
	balance := &models.WalletBalance{
		Base:            models.Base{ID: balanceID},
		AvailableAmount: 1000,
	}

	db, mock := newMockDB(t)
	mock.ExpectBegin()
	mock.ExpectCommit()

	holdRepo := &mockHoldRepo{
		findByTransactionIDFn: func(_ uuid.UUID) (*models.WalletHold, error) {
			return nil, gorm.ErrRecordNotFound
		},
		createFn: func(_ *models.WalletHold) error { return nil },
	}
	txRepo := &mockTxRepo{
		findByIDFn:     func(_ uuid.UUID) (*models.Transaction, error) { return txn, nil },
		updateStatusFn: func(_ uuid.UUID, _ models.TransactionStatus) error { return nil },
	}
	balanceRepo := &mockBalanceRepo{
		lockForUpdateFn: func(_ uuid.UUID, _ string) (*models.WalletBalance, error) {
			return balance, nil
		},
		updateAmountsFn: func(_ uuid.UUID, _, _ int64) error { return nil },
	}

	svc := NewTransferService(db, &mockWalletRepo{}, balanceRepo, holdRepo, txRepo)
	if err := svc.HoldFunds(context.Background(), txnID); err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestReverseTransfer_NotSender(t *testing.T) {
	txnID := uuid.New()
	txn := &models.Transaction{
		Base:           models.Base{ID: txnID},
		SenderWalletID: uuidPtr(uuid.New()),
		Status:         models.TransactionStatusCompleted,
	}
	txRepo := &mockTxRepo{
		findByIDFn: func(_ uuid.UUID) (*models.Transaction, error) { return txn, nil },
	}
	svc := NewTransferService(nil, &mockWalletRepo{}, &mockBalanceRepo{}, &mockHoldRepo{}, txRepo)
	_, err := svc.ReverseTransfer(context.Background(), txnID, uuid.New())
	if !errors.Is(err, ErrNotTransactionSender) {
		t.Errorf("expected ErrNotTransactionSender, got %v", err)
	}
}

func TestReverseTransfer_AlreadyReversed_IsIdempotent(t *testing.T) {
	txnID := uuid.New()
	walletID := uuid.New()
	txn := &models.Transaction{
		Base:           models.Base{ID: txnID},
		SenderWalletID: &walletID,
		Status:         models.TransactionStatusReversed,
	}
	txRepo := &mockTxRepo{
		findByIDFn: func(_ uuid.UUID) (*models.Transaction, error) { return txn, nil },
	}
	svc := NewTransferService(nil, &mockWalletRepo{}, &mockBalanceRepo{}, &mockHoldRepo{}, txRepo)
	result, err := svc.ReverseTransfer(context.Background(), txnID, walletID)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
	if result.Status != models.TransactionStatusReversed {
		t.Errorf("expected reversed status, got %v", result.Status)
	}
}

func TestReverseTransfer_NotReversible(t *testing.T) {
	for _, status := range []models.TransactionStatus{
		models.TransactionStatusPending,
		models.TransactionStatusFailed,
	} {
		t.Run(string(status), func(t *testing.T) {
			txnID := uuid.New()
			walletID := uuid.New()
			txn := &models.Transaction{
				Base:           models.Base{ID: txnID},
				SenderWalletID: &walletID,
				Status:         status,
			}
			txRepo := &mockTxRepo{
				findByIDFn: func(_ uuid.UUID) (*models.Transaction, error) { return txn, nil },
			}
			svc := NewTransferService(nil, &mockWalletRepo{}, &mockBalanceRepo{}, &mockHoldRepo{}, txRepo)
			_, err := svc.ReverseTransfer(context.Background(), txnID, walletID)
			if !errors.Is(err, ErrTransactionNotReversible) {
				t.Errorf("expected ErrTransactionNotReversible, got %v", err)
			}
		})
	}
}

func TestReverseTransfer_Processing_SkipsRecipientDebit(t *testing.T) {
	txnID := uuid.New()
	walletID := uuid.New()
	txn := &models.Transaction{
		Base:              models.Base{ID: txnID},
		SenderWalletID:    &walletID,
		RecipientWalletID: uuid.New(),
		Currency:          "USD",
		Amount:            500,
		Status:            models.TransactionStatusProcessing,
	}

	db, mock := newMockDB(t)
	mock.ExpectBegin()
	mock.ExpectCommit()

	lockForUpdateCalled := false
	holdReleased := false

	txRepo := &mockTxRepo{
		findByIDFn:     func(_ uuid.UUID) (*models.Transaction, error) { return txn, nil },
		updateStatusFn: func(_ uuid.UUID, _ models.TransactionStatus) error { return nil },
	}
	balanceRepo := &mockBalanceRepo{
		lockForUpdateFn: func(_ uuid.UUID, _ string) (*models.WalletBalance, error) {
			lockForUpdateCalled = true
			return nil, nil
		},
		findOrCreateFn: func(_ uuid.UUID, _ string) (*models.WalletBalance, error) {
			return &models.WalletBalance{Base: models.Base{ID: uuid.New()}}, nil
		},
		updateAmountsFn: func(_ uuid.UUID, _, _ int64) error { return nil },
	}
	holdRepo := &mockHoldRepo{
		findByTransactionIDFn: func(_ uuid.UUID) (*models.WalletHold, error) {
			return &models.WalletHold{Base: models.Base{ID: uuid.New()}}, nil
		},
		updateStatusFn: func(_ uuid.UUID, status models.HoldStatus) error {
			if status == models.HoldStatusReleased {
				holdReleased = true
			}
			return nil
		},
	}

	svc := NewTransferService(db, &mockWalletRepo{}, balanceRepo, holdRepo, txRepo)
	_, err := svc.ReverseTransfer(context.Background(), txnID, walletID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if lockForUpdateCalled {
		t.Error("LockForUpdate should not be called for processing status — recipient was never credited")
	}
	if !holdReleased {
		t.Error("expected hold to be released")
	}
}

func TestReverseTransfer_Completed_InsufficientFundsForReversal(t *testing.T) {
	txnID := uuid.New()
	walletID := uuid.New()
	txn := &models.Transaction{
		Base:              models.Base{ID: txnID},
		SenderWalletID:    &walletID,
		RecipientWalletID: uuid.New(),
		Currency:          "USD",
		Amount:            1000,
		Status:            models.TransactionStatusCompleted,
	}

	db, mock := newMockDB(t)
	mock.ExpectBegin()
	mock.ExpectRollback()

	txRepo := &mockTxRepo{
		findByIDFn: func(_ uuid.UUID) (*models.Transaction, error) { return txn, nil },
	}
	balanceRepo := &mockBalanceRepo{
		lockForUpdateFn: func(_ uuid.UUID, _ string) (*models.WalletBalance, error) {
			return &models.WalletBalance{
				Base:            models.Base{ID: uuid.New()},
				TotalAmount:     500,
				AvailableAmount: 500,
			}, nil
		},
	}

	svc := NewTransferService(db, &mockWalletRepo{}, balanceRepo, &mockHoldRepo{}, txRepo)
	_, err := svc.ReverseTransfer(context.Background(), txnID, walletID)
	if !errors.Is(err, ErrInsufficientFundsForReversal) {
		t.Errorf("expected ErrInsufficientFundsForReversal, got %v", err)
	}
}

func TestReverseTransfer_Completed_Success(t *testing.T) {
	txnID := uuid.New()
	walletID := uuid.New()
	txn := &models.Transaction{
		Base:              models.Base{ID: txnID},
		SenderWalletID:    &walletID,
		RecipientWalletID: uuid.New(),
		Currency:          "USD",
		Amount:            500,
		Status:            models.TransactionStatusCompleted,
	}

	db, mock := newMockDB(t)
	mock.ExpectBegin()
	mock.ExpectCommit()

	txRepo := &mockTxRepo{
		findByIDFn:     func(_ uuid.UUID) (*models.Transaction, error) { return txn, nil },
		updateStatusFn: func(_ uuid.UUID, _ models.TransactionStatus) error { return nil },
	}
	balanceRepo := &mockBalanceRepo{
		lockForUpdateFn: func(_ uuid.UUID, _ string) (*models.WalletBalance, error) {
			return &models.WalletBalance{
				Base:            models.Base{ID: uuid.New()},
				TotalAmount:     1000,
				AvailableAmount: 1000,
			}, nil
		},
		findOrCreateFn: func(_ uuid.UUID, _ string) (*models.WalletBalance, error) {
			return &models.WalletBalance{Base: models.Base{ID: uuid.New()}}, nil
		},
		updateAmountsFn: func(_ uuid.UUID, _, _ int64) error { return nil },
	}
	holdRepo := &mockHoldRepo{
		findByTransactionIDFn: func(_ uuid.UUID) (*models.WalletHold, error) {
			return nil, gorm.ErrRecordNotFound
		},
	}

	svc := NewTransferService(db, &mockWalletRepo{}, balanceRepo, holdRepo, txRepo)
	result, err := svc.ReverseTransfer(context.Background(), txnID, walletID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Status != models.TransactionStatusReversed {
		t.Errorf("expected reversed status, got %v", result.Status)
	}
}
