package service

import (
	"context"
	"errors"
	"flowpay-be/internal/models"
	"testing"

	"github.com/google/uuid"
)

func TestDeposit_InvalidAmount(t *testing.T) {
	svc := NewWalletService(nil, &mockWalletRepo{}, &mockBalanceRepo{}, &mockTxRepo{})
	_, err := svc.Deposit(context.Background(), DepositInput{Amount: 0, Currency: "USD"})
	if !errors.Is(err, ErrInvalidDepositAmount) {
		t.Errorf("expected ErrInvalidDepositAmount, got %v", err)
	}
}

func TestDeposit_NegativeAmount(t *testing.T) {
	svc := NewWalletService(nil, &mockWalletRepo{}, &mockBalanceRepo{}, &mockTxRepo{})
	_, err := svc.Deposit(context.Background(), DepositInput{Amount: -100, Currency: "USD"})
	if !errors.Is(err, ErrInvalidDepositAmount) {
		t.Errorf("expected ErrInvalidDepositAmount, got %v", err)
	}
}

func TestDeposit_UnsupportedCurrency(t *testing.T) {
	svc := NewWalletService(nil, &mockWalletRepo{}, &mockBalanceRepo{}, &mockTxRepo{})
	_, err := svc.Deposit(context.Background(), DepositInput{Amount: 100, Currency: "XXX"})
	if err == nil {
		t.Fatal("expected error for unsupported currency")
	}
}

func TestDeposit_WalletNotFound(t *testing.T) {
	walletErr := errors.New("wallet not found")
	svc := NewWalletService(nil, &mockWalletRepo{
		findByUserIDFn: func(uuid.UUID) (*models.Wallet, error) { return nil, walletErr },
	}, &mockBalanceRepo{}, &mockTxRepo{})

	_, err := svc.Deposit(context.Background(), DepositInput{UserID: uuid.New(), Amount: 100, Currency: "USD"})
	if !errors.Is(err, walletErr) {
		t.Errorf("expected wallet error, got %v", err)
	}
}

func TestDeposit_Success(t *testing.T) {
	db, mock := newMockDB(t)
	walletID := uuid.New()
	balanceID := uuid.New()
	userID := uuid.New()

	mock.ExpectBegin()
	mock.ExpectCommit()

	balance := &models.WalletBalance{TotalAmount: 0, AvailableAmount: 0, Currency: "USD", WalletID: walletID}
	balance.ID = balanceID

	findOrCreateCalls := 0
	balanceRepo := &mockBalanceRepo{
		findOrCreateFn: func(uuid.UUID, string) (*models.WalletBalance, error) {
			findOrCreateCalls++
			return balance, nil
		},
		updateAmountsFn: func(_ uuid.UUID, _, _ int64) error { return nil },
	}
	txRepo := &mockTxRepo{
		createFn: func(_ *models.Transaction) error { return nil },
	}

	svc := NewWalletService(db, &mockWalletRepo{
		findByUserIDFn: func(uuid.UUID) (*models.Wallet, error) {
			w := &models.Wallet{UserID: userID}
			w.ID = walletID
			return w, nil
		},
	}, balanceRepo, txRepo)

	result, err := svc.Deposit(context.Background(), DepositInput{UserID: userID, Amount: 500, Currency: "USD"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result == nil {
		t.Fatal("expected non-nil balance result")
	}
	// FindOrCreate is called once inside the transaction and once after
	if findOrCreateCalls != 2 {
		t.Errorf("expected FindOrCreate called twice, got %d", findOrCreateCalls)
	}
}

func TestGetWallet_Delegates(t *testing.T) {
	userID := uuid.New()
	walletID := uuid.New()
	expected := &models.Wallet{UserID: userID}
	expected.ID = walletID

	svc := NewWalletService(nil, &mockWalletRepo{
		findByUserIDFn: func(uuid.UUID) (*models.Wallet, error) { return expected, nil },
	}, &mockBalanceRepo{}, &mockTxRepo{})

	result, err := svc.GetWallet(context.Background(), userID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.ID != walletID {
		t.Errorf("expected wallet ID %v, got %v", walletID, result.ID)
	}
}
