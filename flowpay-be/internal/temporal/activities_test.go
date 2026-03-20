package temporal

import (
	"errors"
	"fmt"
	"testing"

	"flowpay-be/internal/currency"
	"flowpay-be/internal/service"

	temporalerr "go.temporal.io/sdk/temporal"
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
