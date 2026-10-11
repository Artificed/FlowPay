package temporal

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"flowpay-be/internal/currency"
	"flowpay-be/internal/repository"
	"flowpay-be/internal/service"

	"github.com/google/uuid"
	temporalerr "go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/testsuite"
)

func TestWrapBusinessError_NilReturnsNil(t *testing.T) {
	if got := wrapBusinessError(nil); got != nil {
		t.Errorf("expected nil, got %v", got)
	}
}

func TestWrapBusinessError_BusinessErrorsAreNonRetryable(t *testing.T) {
	cases := []struct {
		name string
		err  error
	}{
		{"ErrInsufficientFunds", service.ErrInsufficientFunds},
		{"ErrSelfTransfer", service.ErrSelfTransfer},
		{"ErrInvalidAmount", service.ErrInvalidAmount},
		{"ErrUnsupportedCurrency", currency.ErrUnsupportedCurrency},
		{"ErrTransactionNotReversible", service.ErrTransactionNotReversible},
		{"ErrNotTransactionSender", service.ErrNotTransactionSender},
		{"ErrInsufficientFundsForReversal", service.ErrInsufficientFundsForReversal},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			result := wrapBusinessError(tc.err)

			var appErr *temporalerr.ApplicationError
			if !errors.As(result, &appErr) {
				t.Fatalf("expected *temporal.ApplicationError, got %T", result)
			}
			if !appErr.NonRetryable() {
				t.Error("expected non-retryable error")
			}
			if appErr.Type() != tc.err.Error() {
				t.Errorf("expected type %q, got %q", tc.err.Error(), appErr.Type())
			}
		})
	}
}

func TestWrapBusinessError_WrappedBusinessError_IsNonRetryable(t *testing.T) {
	wrapped := fmt.Errorf("context: %w", service.ErrInsufficientFunds)
	result := wrapBusinessError(wrapped)

	var appErr *temporalerr.ApplicationError
	if !errors.As(result, &appErr) {
		t.Fatalf("expected *temporal.ApplicationError, got %T", result)
	}
	if !appErr.NonRetryable() {
		t.Error("expected non-retryable error")
	}
}

func TestWrapBusinessError_InfraError_PassesThrough(t *testing.T) {
	err := errors.New("some infrastructure error")
	result := wrapBusinessError(err)
	if result != err {
		t.Errorf("expected error to pass through unchanged, got %v", result)
	}
}

type recordingScheduledPaymentRepo struct {
	repository.ScheduledPaymentRepository
	gotWorkflowID string
}

func (r *recordingScheduledPaymentRepo) IsActive(_ context.Context, _ uuid.UUID, workflowID string) (bool, error) {
	r.gotWorkflowID = workflowID
	return true, nil
}

func TestCheckScheduledPaymentActiveActivity_AsksForItsOwnWorkflow(t *testing.T) {
	repo := &recordingScheduledPaymentRepo{}
	a := NewActivities(nil, repo)

	var suite testsuite.WorkflowTestSuite
	env := suite.NewTestActivityEnvironment()
	env.RegisterActivity(a)

	if _, err := env.ExecuteActivity(a.CheckScheduledPaymentActiveActivity, uuid.New()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if repo.gotWorkflowID != "default-test-workflow-id" {
		t.Errorf("checked for workflow %q, want the running workflow's ID", repo.gotWorkflowID)
	}
}
