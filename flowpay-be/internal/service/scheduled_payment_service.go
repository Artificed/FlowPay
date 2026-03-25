package service

import (
	"context"
	"errors"
	"flowpay-be/internal/currency"
	"flowpay-be/internal/models"
	"flowpay-be/internal/repository"
	"time"

	"github.com/google/uuid"
)

var (
	ErrScheduledPaymentNotFound    = errors.New("scheduled payment not found")
	ErrNotScheduledPaymentOwner    = errors.New("only the owner can modify a scheduled payment")
	ErrScheduledPaymentNotInactive = errors.New("scheduled payment is not inactive")
)

type CreateScheduledPaymentInput struct {
	UserID            uuid.UUID
	RecipientWalletID uuid.UUID
	Amount            int64
	Currency          string
	Note              string
	IntervalDays      int
	FirstRunAt        time.Time
}

type ScheduledPaymentService interface {
	Create(ctx context.Context, input CreateScheduledPaymentInput) (*models.ScheduledPayment, error)
	List(ctx context.Context, userID uuid.UUID) ([]models.ScheduledPayment, error)
	ListPage(ctx context.Context, userID uuid.UUID, status *models.ScheduledPaymentStatus, limit, offset int) ([]models.ScheduledPayment, error)
	Count(ctx context.Context, userID uuid.UUID, status *models.ScheduledPaymentStatus) (int64, error)
	Cancel(ctx context.Context, id, userID uuid.UUID) error
	Reactivate(ctx context.Context, id, userID uuid.UUID) (*models.ScheduledPayment, error)
	IsActive(ctx context.Context, id uuid.UUID) (bool, error)
}

type scheduledPaymentService struct {
	walletRepo repository.WalletRepository
	spRepo     repository.ScheduledPaymentRepository
}

func NewScheduledPaymentService(walletRepo repository.WalletRepository, spRepo repository.ScheduledPaymentRepository) ScheduledPaymentService {
	return &scheduledPaymentService{walletRepo: walletRepo, spRepo: spRepo}
}

func (s *scheduledPaymentService) Create(ctx context.Context, input CreateScheduledPaymentInput) (*models.ScheduledPayment, error) {
	if input.Amount <= 0 {
		return nil, ErrInvalidAmount
	}
	if err := currency.Validate(input.Currency); err != nil {
		return nil, err
	}

	recipientWallet, err := s.walletRepo.FindByID(ctx, input.RecipientWalletID)
	if err != nil {
		return nil, ErrRecipientNotFound
	}

	senderWallet, err := s.walletRepo.FindByUserID(ctx, input.UserID)
	if err != nil {
		return nil, ErrRecipientNotFound
	}
	if senderWallet.ID == recipientWallet.ID {
		return nil, ErrSelfTransfer
	}

	id := uuid.New()
	sp := &models.ScheduledPayment{
		UserID:            input.UserID,
		RecipientWalletID: input.RecipientWalletID,
		Amount:            input.Amount,
		Currency:          input.Currency,
		Note:              input.Note,
		IntervalDays:      input.IntervalDays,
		NextRunAt:         input.FirstRunAt,
		Status:            models.ScheduledPaymentStatusActive,
		WorkflowID:        "scheduled-" + id.String(),
	}
	sp.ID = id

	if err := s.spRepo.Create(ctx, sp); err != nil {
		return nil, err
	}
	return sp, nil
}

func (s *scheduledPaymentService) List(ctx context.Context, userID uuid.UUID) ([]models.ScheduledPayment, error) {
	return s.spRepo.ListByUserID(ctx, userID)
}

func (s *scheduledPaymentService) ListPage(ctx context.Context, userID uuid.UUID, status *models.ScheduledPaymentStatus, limit, offset int) ([]models.ScheduledPayment, error) {
	return s.spRepo.ListPageByUserID(ctx, userID, status, limit, offset)
}

func (s *scheduledPaymentService) Count(ctx context.Context, userID uuid.UUID, status *models.ScheduledPaymentStatus) (int64, error) {
	return s.spRepo.CountByUserID(ctx, userID, status)
}

func (s *scheduledPaymentService) Cancel(ctx context.Context, id, userID uuid.UUID) error {
	sp, err := s.spRepo.FindByID(ctx, id)
	if err != nil {
		return ErrScheduledPaymentNotFound
	}
	if sp.UserID != userID {
		return ErrNotScheduledPaymentOwner
	}
	return s.spRepo.UpdateStatus(ctx, id, models.ScheduledPaymentStatusInactive)
}

func (s *scheduledPaymentService) Reactivate(ctx context.Context, id, userID uuid.UUID) (*models.ScheduledPayment, error) {
	sp, err := s.spRepo.FindByID(ctx, id)
	if err != nil {
		return nil, ErrScheduledPaymentNotFound
	}
	if sp.UserID != userID {
		return nil, ErrNotScheduledPaymentOwner
	}
	if sp.Status != models.ScheduledPaymentStatusInactive {
		return nil, ErrScheduledPaymentNotInactive
	}

	newWorkflowID := "scheduled-" + id.String() + "-r-" + uuid.New().String()
	nextRunAt := time.Now().Add(time.Duration(sp.IntervalDays) * 24 * time.Hour)
	if err := s.spRepo.Reactivate(ctx, id, newWorkflowID, nextRunAt); err != nil {
		return nil, err
	}

	sp.Status = models.ScheduledPaymentStatusActive
	sp.WorkflowID = newWorkflowID
	sp.NextRunAt = nextRunAt
	return sp, nil
}

func (s *scheduledPaymentService) IsActive(ctx context.Context, id uuid.UUID) (bool, error) {
	return s.spRepo.IsActive(ctx, id)
}
