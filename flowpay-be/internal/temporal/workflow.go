package temporal

import (
	"flowpay-be/internal/service"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/workflow"
)

const TaskQueue = "transfer-task-queue"

type TransferWorkflowInput struct {
	Input service.TransferInput
}

type TransferWorkflowResult struct {
	TransactionID uuid.UUID
}

type ReverseTransferWorkflowInput struct {
	TransactionID     uuid.UUID
	RequesterWalletID uuid.UUID
}

type ReverseTransferWorkflowResult struct {
	TransactionID uuid.UUID
}

var activityOptions = workflow.ActivityOptions{
	StartToCloseTimeout: 30 * time.Second,
	RetryPolicy: &temporal.RetryPolicy{
		MaximumAttempts:    3,
		InitialInterval:    time.Second,
		BackoffCoefficient: 2.0,
	},
}

func TransferWorkflow(ctx workflow.Context, input TransferWorkflowInput) (*TransferWorkflowResult, error) {
	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	var a *Activities

	var validation *service.TransferValidation
	if err := workflow.ExecuteActivity(ctx, a.ValidateTransferActivity, input.Input).Get(ctx, &validation); err != nil {
		return nil, err
	}

	var txnID uuid.UUID
	if err := workflow.ExecuteActivity(ctx, a.CreateTransactionActivity, input.Input, validation.SenderWalletID).Get(ctx, &txnID); err != nil {
		return nil, err
	}

	if err := workflow.ExecuteActivity(ctx, a.HoldFundsActivity, txnID).Get(ctx, nil); err != nil {
		if failErr := workflow.ExecuteActivity(ctx, a.FailTransactionActivity, txnID).Get(ctx, nil); failErr != nil {
			return nil, fmt.Errorf("hold funds failed: %w; mark transaction failed also failed: %v", err, failErr)
		}
		return nil, err
	}

	if err := workflow.ExecuteActivity(ctx, a.DebitSenderActivity, txnID).Get(ctx, nil); err != nil {
		if compErr := workflow.ExecuteActivity(ctx, a.CompensateTransferActivity, txnID, validation.SenderWalletID).Get(ctx, nil); compErr != nil {
			return nil, fmt.Errorf("debit sender failed: %w; compensation also failed: %v", err, compErr)
		}
		return nil, err
	}

	if err := workflow.ExecuteActivity(ctx, a.CreditRecipientActivity, txnID).Get(ctx, nil); err != nil {
		if compErr := workflow.ExecuteActivity(ctx, a.CompensateTransferActivity, txnID, validation.SenderWalletID).Get(ctx, nil); compErr != nil {
			return nil, fmt.Errorf("credit recipient failed: %w; compensation also failed: %v", err, compErr)
		}
		return nil, err
	}

	return &TransferWorkflowResult{TransactionID: txnID}, nil
}

func ReverseTransferWorkflow(ctx workflow.Context, input ReverseTransferWorkflowInput) (*ReverseTransferWorkflowResult, error) {
	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	var a *Activities

	if err := workflow.ExecuteActivity(ctx, a.CompensateTransferActivity, input.TransactionID, input.RequesterWalletID).Get(ctx, nil); err != nil {
		return nil, err
	}

	return &ReverseTransferWorkflowResult{TransactionID: input.TransactionID}, nil
}
