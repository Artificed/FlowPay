package temporal

import (
	"context"
	"errors"
	"flowpay-be/internal/service"

	"github.com/google/uuid"
	"go.temporal.io/sdk/temporal"
)

type Activities struct {
	transferSvc service.TransferService
}

func NewActivities(transferSvc service.TransferService) *Activities {
	return &Activities{transferSvc: transferSvc}
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

func (a *Activities) CompensateTransferActivity(ctx context.Context, txnID uuid.UUID, senderWalletID uuid.UUID) error {
	_, err := a.transferSvc.ReverseTransfer(ctx, txnID, senderWalletID)
	return wrapBusinessError(err)
}

func wrapBusinessError(err error) error {
	if err == nil {
		return nil
	}

	businessErrors := []error{
		service.ErrInsufficientFunds,
		service.ErrSelfTransfer,
		service.ErrInvalidAmount,
		service.ErrUnsupportedCurrency,
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
