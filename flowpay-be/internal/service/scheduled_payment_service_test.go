package service

import (
	"context"
	"errors"
	"flowpay-be/internal/models"
	"testing"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type mockScheduledPaymentRepo struct {
	createFn       func(sp *models.ScheduledPayment) error
	findByIDFn     func(id uuid.UUID) (*models.ScheduledPayment, error)
	updateStatusFn func(id uuid.UUID, status models.ScheduledPaymentStatus) error
	reactivateFn   func(id uuid.UUID, workflowID string, nextRunAt time.Time) error
	isActiveFn     func(id uuid.UUID) (bool, error)
}

func (m *mockScheduledPaymentRepo) Create(_ context.Context, sp *models.ScheduledPayment) error {
	if m.createFn != nil {
		return m.createFn(sp)
	}
	return nil
}
func (m *mockScheduledPaymentRepo) FindByID(_ context.Context, id uuid.UUID) (*models.ScheduledPayment, error) {
	return m.findByIDFn(id)
}
func (m *mockScheduledPaymentRepo) ListByUserID(_ context.Context, _ uuid.UUID) ([]models.ScheduledPayment, error) {
	return nil, nil
}
func (m *mockScheduledPaymentRepo) ListPageByUserID(_ context.Context, _ uuid.UUID, _ *models.ScheduledPaymentStatus, _, _ int) ([]models.ScheduledPayment, error) {
	return nil, nil
}
func (m *mockScheduledPaymentRepo) CountByUserID(_ context.Context, _ uuid.UUID, _ *models.ScheduledPaymentStatus) (int64, error) {
	return 0, nil
}
func (m *mockScheduledPaymentRepo) UpdateStatus(_ context.Context, id uuid.UUID, status models.ScheduledPaymentStatus) error {
	return m.updateStatusFn(id, status)
}
func (m *mockScheduledPaymentRepo) UpdateNextRunAt(_ context.Context, _ uuid.UUID, _ time.Time) error {
	return nil
}
func (m *mockScheduledPaymentRepo) Reactivate(_ context.Context, id uuid.UUID, workflowID string, nextRunAt time.Time) error {
	return m.reactivateFn(id, workflowID, nextRunAt)
}
func (m *mockScheduledPaymentRepo) IsActive(_ context.Context, id uuid.UUID) (bool, error) {
	return m.isActiveFn(id)
}
func (m *mockScheduledPaymentRepo) CancelWithReason(_ context.Context, _ uuid.UUID, _ string) error {
	return nil
}

// --- Create ---

func TestCreateScheduledPayment_InvalidAmount(t *testing.T) {
	svc := NewScheduledPaymentService(&mockWalletRepo{}, &mockScheduledPaymentRepo{})
	_, err := svc.Create(context.Background(), CreateScheduledPaymentInput{Amount: 0, Currency: "USD"})
	if !errors.Is(err, ErrInvalidAmount) {
		t.Errorf("expected ErrInvalidAmount, got %v", err)
	}
}

func TestCreateScheduledPayment_UnsupportedCurrency(t *testing.T) {
	svc := NewScheduledPaymentService(&mockWalletRepo{}, &mockScheduledPaymentRepo{})
	_, err := svc.Create(context.Background(), CreateScheduledPaymentInput{Amount: 100, Currency: "XXX"})
	if err == nil {
		t.Fatal("expected error for unsupported currency")
	}
}

func TestCreateScheduledPayment_RecipientNotFound(t *testing.T) {
	svc := NewScheduledPaymentService(&mockWalletRepo{
		findByIDFn: func(uuid.UUID) (*models.Wallet, error) { return nil, gorm.ErrRecordNotFound },
	}, &mockScheduledPaymentRepo{})

	_, err := svc.Create(context.Background(), CreateScheduledPaymentInput{
		Amount: 100, Currency: "USD", RecipientWalletID: uuid.New(),
	})
	if !errors.Is(err, ErrRecipientNotFound) {
		t.Errorf("expected ErrRecipientNotFound, got %v", err)
	}
}

func TestCreateScheduledPayment_SelfTransfer(t *testing.T) {
	walletID := uuid.New()
	userID := uuid.New()
	wallet := &models.Wallet{UserID: userID}
	wallet.ID = walletID

	svc := NewScheduledPaymentService(&mockWalletRepo{
		findByIDFn:     func(uuid.UUID) (*models.Wallet, error) { return wallet, nil },
		findByUserIDFn: func(uuid.UUID) (*models.Wallet, error) { return wallet, nil },
	}, &mockScheduledPaymentRepo{})

	_, err := svc.Create(context.Background(), CreateScheduledPaymentInput{
		UserID: userID, Amount: 100, Currency: "USD", RecipientWalletID: walletID,
	})
	if !errors.Is(err, ErrSelfTransfer) {
		t.Errorf("expected ErrSelfTransfer, got %v", err)
	}
}

func TestCreateScheduledPayment_Success(t *testing.T) {
	senderID := uuid.New()
	recipientID := uuid.New()
	userID := uuid.New()

	sender := &models.Wallet{UserID: userID}
	sender.ID = senderID
	recipient := &models.Wallet{}
	recipient.ID = recipientID

	var created *models.ScheduledPayment
	svc := NewScheduledPaymentService(&mockWalletRepo{
		findByIDFn:     func(uuid.UUID) (*models.Wallet, error) { return recipient, nil },
		findByUserIDFn: func(uuid.UUID) (*models.Wallet, error) { return sender, nil },
	}, &mockScheduledPaymentRepo{
		createFn: func(sp *models.ScheduledPayment) error {
			created = sp
			return nil
		},
	})

	firstRun := time.Now().Add(24 * time.Hour)
	result, err := svc.Create(context.Background(), CreateScheduledPaymentInput{
		UserID: userID, RecipientWalletID: recipientID,
		Amount: 1000, Currency: "USD", Note: "rent", IntervalDays: 30, FirstRunAt: firstRun,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result == nil || created == nil {
		t.Fatal("expected scheduled payment to be created")
	}
	if result.Amount != 1000 {
		t.Errorf("expected amount 1000, got %d", result.Amount)
	}
	if result.WorkflowID == "" {
		t.Error("expected non-empty workflow ID")
	}
	if result.Status != models.ScheduledPaymentStatusActive {
		t.Errorf("expected status active, got %v", result.Status)
	}
}

// --- Cancel ---

func TestCancelScheduledPayment_NotFound(t *testing.T) {
	svc := NewScheduledPaymentService(&mockWalletRepo{}, &mockScheduledPaymentRepo{
		findByIDFn: func(uuid.UUID) (*models.ScheduledPayment, error) {
			return nil, gorm.ErrRecordNotFound
		},
	})
	err := svc.Cancel(context.Background(), uuid.New(), uuid.New())
	if !errors.Is(err, ErrScheduledPaymentNotFound) {
		t.Errorf("expected ErrScheduledPaymentNotFound, got %v", err)
	}
}

func TestCancelScheduledPayment_NotOwner(t *testing.T) {
	sp := &models.ScheduledPayment{UserID: uuid.New()}
	sp.ID = uuid.New()

	svc := NewScheduledPaymentService(&mockWalletRepo{}, &mockScheduledPaymentRepo{
		findByIDFn: func(uuid.UUID) (*models.ScheduledPayment, error) { return sp, nil },
	})
	err := svc.Cancel(context.Background(), sp.ID, uuid.New()) // different requester
	if !errors.Is(err, ErrNotScheduledPaymentOwner) {
		t.Errorf("expected ErrNotScheduledPaymentOwner, got %v", err)
	}
}

func TestCancelScheduledPayment_Success(t *testing.T) {
	ownerID := uuid.New()
	spID := uuid.New()
	sp := &models.ScheduledPayment{UserID: ownerID, Status: models.ScheduledPaymentStatusActive}
	sp.ID = spID

	var updatedID uuid.UUID
	var updatedStatus models.ScheduledPaymentStatus
	svc := NewScheduledPaymentService(&mockWalletRepo{}, &mockScheduledPaymentRepo{
		findByIDFn: func(uuid.UUID) (*models.ScheduledPayment, error) { return sp, nil },
		updateStatusFn: func(id uuid.UUID, status models.ScheduledPaymentStatus) error {
			updatedID = id
			updatedStatus = status
			return nil
		},
	})

	err := svc.Cancel(context.Background(), spID, ownerID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updatedID != spID {
		t.Errorf("expected update for ID %v, got %v", spID, updatedID)
	}
	if updatedStatus != models.ScheduledPaymentStatusInactive {
		t.Errorf("expected status inactive, got %v", updatedStatus)
	}
}

// --- Reactivate ---

func TestReactivateScheduledPayment_NotFound(t *testing.T) {
	svc := NewScheduledPaymentService(&mockWalletRepo{}, &mockScheduledPaymentRepo{
		findByIDFn: func(uuid.UUID) (*models.ScheduledPayment, error) {
			return nil, gorm.ErrRecordNotFound
		},
	})
	_, err := svc.Reactivate(context.Background(), uuid.New(), uuid.New())
	if !errors.Is(err, ErrScheduledPaymentNotFound) {
		t.Errorf("expected ErrScheduledPaymentNotFound, got %v", err)
	}
}

func TestReactivateScheduledPayment_NotOwner(t *testing.T) {
	sp := &models.ScheduledPayment{UserID: uuid.New(), Status: models.ScheduledPaymentStatusInactive}
	sp.ID = uuid.New()

	svc := NewScheduledPaymentService(&mockWalletRepo{}, &mockScheduledPaymentRepo{
		findByIDFn: func(uuid.UUID) (*models.ScheduledPayment, error) { return sp, nil },
	})
	_, err := svc.Reactivate(context.Background(), sp.ID, uuid.New())
	if !errors.Is(err, ErrNotScheduledPaymentOwner) {
		t.Errorf("expected ErrNotScheduledPaymentOwner, got %v", err)
	}
}

func TestReactivateScheduledPayment_NotInactive(t *testing.T) {
	ownerID := uuid.New()
	sp := &models.ScheduledPayment{UserID: ownerID, Status: models.ScheduledPaymentStatusActive}
	sp.ID = uuid.New()

	svc := NewScheduledPaymentService(&mockWalletRepo{}, &mockScheduledPaymentRepo{
		findByIDFn: func(uuid.UUID) (*models.ScheduledPayment, error) { return sp, nil },
	})
	_, err := svc.Reactivate(context.Background(), sp.ID, ownerID)
	if !errors.Is(err, ErrScheduledPaymentNotInactive) {
		t.Errorf("expected ErrScheduledPaymentNotInactive, got %v", err)
	}
}

func TestReactivateScheduledPayment_Success(t *testing.T) {
	ownerID := uuid.New()
	spID := uuid.New()
	sp := &models.ScheduledPayment{
		UserID:       ownerID,
		Status:       models.ScheduledPaymentStatusInactive,
		IntervalDays: 7,
	}
	sp.ID = spID

	var reactivatedWorkflowID string
	var reactivatedNextRunAt time.Time
	svc := NewScheduledPaymentService(&mockWalletRepo{}, &mockScheduledPaymentRepo{
		findByIDFn: func(uuid.UUID) (*models.ScheduledPayment, error) { return sp, nil },
		reactivateFn: func(id uuid.UUID, workflowID string, nextRunAt time.Time) error {
			reactivatedWorkflowID = workflowID
			reactivatedNextRunAt = nextRunAt
			return nil
		},
	})

	before := time.Now()
	result, err := svc.Reactivate(context.Background(), spID, ownerID)
	after := time.Now()

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Status != models.ScheduledPaymentStatusActive {
		t.Errorf("expected status active, got %v", result.Status)
	}
	if reactivatedWorkflowID == "" {
		t.Error("expected non-empty workflow ID")
	}
	// next run should be ~7 days from now
	expectedMin := before.Add(7 * 24 * time.Hour)
	expectedMax := after.Add(7 * 24 * time.Hour)
	if reactivatedNextRunAt.Before(expectedMin) || reactivatedNextRunAt.After(expectedMax) {
		t.Errorf("nextRunAt %v not within expected 7-day window [%v, %v]", reactivatedNextRunAt, expectedMin, expectedMax)
	}
}
