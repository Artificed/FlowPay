package temporal

import (
	"flowpay-be/internal/service"
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

var activityOptions = workflow.ActivityOptions{
	StartToCloseTimeout: 30 * time.Second,
	RetryPolicy: &temporal.RetryPolicy{
		MaximumAttempts:        3,
		InitialInterval:        time.Second,
		BackoffCoefficient:     2.0,
		NonRetryableErrorTypes: []string{"non_retryable"},
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
		_ = workflow.ExecuteActivity(ctx, a.FailTransactionActivity, txnID).Get(ctx, nil)
		return nil, err
	}

	if err := workflow.ExecuteActivity(ctx, a.DebitSenderActivity, txnID).Get(ctx, nil); err != nil {
		_ = workflow.ExecuteActivity(ctx, a.CompensateTransferActivity, txnID, validation.SenderWalletID).Get(ctx, nil)
		return nil, err
	}

	if err := workflow.ExecuteActivity(ctx, a.CreditRecipientActivity, txnID).Get(ctx, nil); err != nil {
		_ = workflow.ExecuteActivity(ctx, a.CompensateTransferActivity, txnID, validation.SenderWalletID).Get(ctx, nil)
		return nil, err
	}

	return &TransferWorkflowResult{TransactionID: txnID}, nil
}
