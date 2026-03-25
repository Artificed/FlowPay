package temporal

import (
	"errors"
	"flowpay-be/internal/service"
	"fmt"
	"time"

	"github.com/google/uuid"
	enumspb "go.temporal.io/api/enums/v1"
	"go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/workflow"
)

type ScheduledPaymentWorkflowInput struct {
	ScheduledPaymentID uuid.UUID
	UserID             uuid.UUID
	RecipientWalletID  uuid.UUID
	Amount             int64
	Currency           string
	Note               string
	IntervalDays       int
	FirstRunAt         time.Time
}

func ScheduledPaymentWorkflow(ctx workflow.Context, input ScheduledPaymentWorkflowInput) error {
	var a *Activities

	actOpts := workflow.WithActivityOptions(ctx, workflow.ActivityOptions{
		StartToCloseTimeout: 30 * time.Second,
		RetryPolicy: &temporal.RetryPolicy{
			MaximumAttempts:    3,
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
		},
	})

	if delay := input.FirstRunAt.Sub(workflow.Now(ctx)); delay > 0 {
		if err := workflow.Sleep(ctx, delay); err != nil {
			return err
		}
	}

	for {
		var active bool
		if err := workflow.ExecuteActivity(actOpts, a.CheckScheduledPaymentActiveActivity, input.ScheduledPaymentID).Get(ctx, &active); err != nil || !active {
			return nil
		}

		childCtx := workflow.WithChildOptions(ctx, workflow.ChildWorkflowOptions{
			WorkflowID:            fmt.Sprintf("scheduled-transfer-%s-%d", input.ScheduledPaymentID, workflow.Now(ctx).UnixMilli()),
			WorkflowIDReusePolicy: enumspb.WORKFLOW_ID_REUSE_POLICY_ALLOW_DUPLICATE_FAILED_ONLY,
		})
		transferErr := workflow.ExecuteChildWorkflow(childCtx, TransferWorkflow, TransferWorkflowInput{
			Input: service.TransferInput{
				SenderUserID:      input.UserID,
				RecipientWalletID: input.RecipientWalletID,
				Amount:            input.Amount,
				Currency:          input.Currency,
				Note:              input.Note,
			},
		}).Get(ctx, nil)
		if transferErr != nil {
			var appErr *temporal.ApplicationError
			if errors.As(transferErr, &appErr) && appErr.NonRetryable() {
				if cancelErr := workflow.ExecuteActivity(actOpts, a.CancelScheduledPaymentActivity, input.ScheduledPaymentID, appErr.Message()).Get(ctx, nil); cancelErr != nil {
					return fmt.Errorf("transfer failed (%s); also failed to cancel scheduled payment: %w", appErr.Message(), cancelErr)
				}
				return nil
			}
		}

		nextRun := workflow.Now(ctx).Add(time.Duration(input.IntervalDays) * 24 * time.Hour)
		if err := workflow.ExecuteActivity(actOpts, a.UpdateScheduledPaymentNextRunActivity, input.ScheduledPaymentID, nextRun).Get(ctx, nil); err != nil {
			return fmt.Errorf("update next run: %w", err)
		}

		if err := workflow.Sleep(ctx, time.Duration(input.IntervalDays)*24*time.Hour); err != nil {
			return err
		}
	}
}
