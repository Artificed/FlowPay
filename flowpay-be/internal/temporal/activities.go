package temporal

import (
	"context"
	"errors"
	"flowpay-be/internal/currency"
	"flowpay-be/internal/repository"
	"flowpay-be/internal/service"
	"time"

	"github.com/google/uuid"
	"go.temporal.io/sdk/temporal"
)

type Activities struct {
	transferSvc        service.TransferService
	scheduledPaymentRepo repository.ScheduledPaymentRepository
}

func NewActivities(transferSvc service.TransferService, scheduledPaymentRepo repository.ScheduledPaymentRepository) *Activities {
	return &Activities{transferSvc: transferSvc, scheduledPaymentRepo: scheduledPaymentRepo}
}

func (a *Activities) ValidateTransferActivity(ctx context.Context, input service.TransferInput) (*service.TransferValidation, error) {
	result, err := a.transferSvc.ValidateTransfer(ctx, input)
	if err != nil {
		return nil, wrapBusinessError(err)
	}
	return result, nil
}

func (a *Activities) CreateTransactionActivity(ctx context.Context, input service.TransferInput, senderWalletID uuid.UUID) (uuid.UUID, error) {
	txn, err := a.transferSvc.CreateTransaction(ctx, input, senderWalletID)
	if err != nil {
		return uuid.Nil, wrapBusinessError(err)
	}
	return txn.ID, nil
}

func (a *Activities) HoldFundsActivity(ctx context.Context, txnID uuid.UUID) error {
	return wrapBusinessError(a.transferSvc.HoldFunds(ctx, txnID))
}

func (a *Activities) DebitSenderActivity(ctx context.Context, txnID uuid.UUID) error {
	return wrapBusinessError(a.transferSvc.DebitSender(ctx, txnID))
}

func (a *Activities) CreditRecipientActivity(ctx context.Context, txnID uuid.UUID) error {
	return wrapBusinessError(a.transferSvc.CreditRecipient(ctx, txnID))
}

func (a *Activities) FailTransactionActivity(ctx context.Context, txnID uuid.UUID) error {
	return a.transferSvc.MarkTransactionFailed(ctx, txnID)
}

func (a *Activities) CompensateTransferActivity(ctx context.Context, txnID uuid.UUID, senderWalletID uuid.UUID) error {
	_, err := a.transferSvc.ReverseTransfer(ctx, txnID, senderWalletID)
	return wrapBusinessError(err)
}

func (a *Activities) CancelScheduledPaymentActivity(ctx context.Context, id uuid.UUID, reason string) error {
	return a.scheduledPaymentRepo.CancelWithReason(ctx, id, reason)
}

func (a *Activities) CheckScheduledPaymentActiveActivity(ctx context.Context, id uuid.UUID) (bool, error) {
	return a.scheduledPaymentRepo.IsActive(ctx, id)
}

func (a *Activities) UpdateScheduledPaymentNextRunActivity(ctx context.Context, id uuid.UUID, nextRun time.Time) error {
	return a.scheduledPaymentRepo.UpdateNextRunAt(ctx, id, nextRun)
}

func wrapBusinessError(err error) error {
	if err == nil {
		return nil
	}

	businessErrors := []error{
		service.ErrInsufficientFunds,
		service.ErrSelfTransfer,
		service.ErrInvalidAmount,
		service.ErrRecipientNotFound,
		currency.ErrUnsupportedCurrency,
		service.ErrTransactionNotReversible,
		service.ErrNotTransactionSender,
		service.ErrInsufficientFundsForReversal,
	}

	for _, be := range businessErrors {
		if errors.Is(err, be) {
			return temporal.NewNonRetryableApplicationError(err.Error(), be.Error(), err)
		}
	}

	return err
}
