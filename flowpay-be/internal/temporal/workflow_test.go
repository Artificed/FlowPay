package temporal_test

import (
	"errors"
	"flowpay-be/internal/service"
	"testing"

	temporalworker "flowpay-be/internal/temporal"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
	temporalerr "go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/testsuite"
)

var a *temporalworker.Activities

type WorkflowTestSuite struct {
	suite.Suite
	testsuite.WorkflowTestSuite
	env *testsuite.TestWorkflowEnvironment
}

func (s *WorkflowTestSuite) SetupTest() {
	s.env = s.NewTestWorkflowEnvironment()
}

func (s *WorkflowTestSuite) AfterTest(_, _ string) {
	s.env.AssertExpectations(s.T())
}

func TestWorkflowTestSuite(t *testing.T) {
	suite.Run(t, new(WorkflowTestSuite))
}

func (s *WorkflowTestSuite) Test_TransferWorkflow_HappyPath() {
	senderWalletID := uuid.New()
	txnID := uuid.New()
	input := temporalworker.TransferWorkflowInput{
		Input: service.TransferInput{
			SenderUserID:      uuid.New(),
			RecipientWalletID: uuid.New(),
			Amount:            1000,
			Currency:          "USD",
		},
	}
	validation := &service.TransferValidation{
		SenderWalletID:    senderWalletID,
		RecipientWalletID: input.Input.RecipientWalletID,
	}

	s.env.OnActivity(a.ValidateTransferActivity, mock.Anything, input.Input).Return(validation, nil)
	s.env.OnActivity(a.CreateTransactionActivity, mock.Anything, input.Input, senderWalletID).Return(txnID, nil)
	s.env.OnActivity(a.HoldFundsActivity, mock.Anything, txnID).Return(nil)
	s.env.OnActivity(a.DebitSenderActivity, mock.Anything, txnID).Return(nil)
	s.env.OnActivity(a.CreditRecipientActivity, mock.Anything, txnID).Return(nil)

	s.env.ExecuteWorkflow(temporalworker.TransferWorkflow, input)

	s.True(s.env.IsWorkflowCompleted())
	s.NoError(s.env.GetWorkflowError())

	var result temporalworker.TransferWorkflowResult
	s.NoError(s.env.GetWorkflowResult(&result))
	s.Equal(txnID, result.TransactionID)
}

func (s *WorkflowTestSuite) Test_TransferWorkflow_InsufficientFunds_NoCompensation() {
	senderWalletID := uuid.New()
	txnID := uuid.New()
	input := temporalworker.TransferWorkflowInput{
		Input: service.TransferInput{Amount: 1000, Currency: "USD"},
	}
	validation := &service.TransferValidation{SenderWalletID: senderWalletID}
	holdErr := temporalerr.NewNonRetryableApplicationError(
		service.ErrInsufficientFunds.Error(),
		service.ErrInsufficientFunds.Error(),
		service.ErrInsufficientFunds,
	)

	s.env.OnActivity(a.ValidateTransferActivity, mock.Anything, input.Input).Return(validation, nil)
	s.env.OnActivity(a.CreateTransactionActivity, mock.Anything, input.Input, senderWalletID).Return(txnID, nil)
	s.env.OnActivity(a.HoldFundsActivity, mock.Anything, txnID).Return(holdErr)
	s.env.OnActivity(a.FailTransactionActivity, mock.Anything, txnID).Return(nil)

	s.env.ExecuteWorkflow(temporalworker.TransferWorkflow, input)

	s.True(s.env.IsWorkflowCompleted())
	s.Error(s.env.GetWorkflowError())
}

func (s *WorkflowTestSuite) Test_TransferWorkflow_DebitFails_TriggersCompensation() {
	senderWalletID := uuid.New()
	txnID := uuid.New()
	input := temporalworker.TransferWorkflowInput{
		Input: service.TransferInput{Amount: 1000, Currency: "USD"},
	}
	validation := &service.TransferValidation{SenderWalletID: senderWalletID}

	s.env.OnActivity(a.ValidateTransferActivity, mock.Anything, input.Input).Return(validation, nil)
	s.env.OnActivity(a.CreateTransactionActivity, mock.Anything, input.Input, senderWalletID).Return(txnID, nil)
	s.env.OnActivity(a.HoldFundsActivity, mock.Anything, txnID).Return(nil)
	s.env.OnActivity(a.DebitSenderActivity, mock.Anything, txnID).Return(errors.New("debit failed"))
	s.env.OnActivity(a.CompensateTransferActivity, mock.Anything, txnID, senderWalletID).Return(nil)

	s.env.ExecuteWorkflow(temporalworker.TransferWorkflow, input)

	s.True(s.env.IsWorkflowCompleted())
	s.Error(s.env.GetWorkflowError())
}

func (s *WorkflowTestSuite) Test_TransferWorkflow_CreditFails_TriggersCompensation() {
	senderWalletID := uuid.New()
	txnID := uuid.New()
	input := temporalworker.TransferWorkflowInput{
		Input: service.TransferInput{Amount: 1000, Currency: "USD"},
	}
	validation := &service.TransferValidation{SenderWalletID: senderWalletID}

	s.env.OnActivity(a.ValidateTransferActivity, mock.Anything, input.Input).Return(validation, nil)
	s.env.OnActivity(a.CreateTransactionActivity, mock.Anything, input.Input, senderWalletID).Return(txnID, nil)
	s.env.OnActivity(a.HoldFundsActivity, mock.Anything, txnID).Return(nil)
	s.env.OnActivity(a.DebitSenderActivity, mock.Anything, txnID).Return(nil)
	s.env.OnActivity(a.CreditRecipientActivity, mock.Anything, txnID).Return(errors.New("credit failed"))
	s.env.OnActivity(a.CompensateTransferActivity, mock.Anything, txnID, senderWalletID).Return(nil)

	s.env.ExecuteWorkflow(temporalworker.TransferWorkflow, input)

	s.True(s.env.IsWorkflowCompleted())
	s.Error(s.env.GetWorkflowError())
}

func (s *WorkflowTestSuite) Test_ReverseTransferWorkflow_HappyPath() {
	input := temporalworker.ReverseTransferWorkflowInput{
		TransactionID:     uuid.New(),
		RequesterWalletID: uuid.New(),
	}

	s.env.OnActivity(a.CompensateTransferActivity, mock.Anything, input.TransactionID, input.RequesterWalletID).Return(nil)

	s.env.ExecuteWorkflow(temporalworker.ReverseTransferWorkflow, input)

	s.True(s.env.IsWorkflowCompleted())
	s.NoError(s.env.GetWorkflowError())

	var result temporalworker.ReverseTransferWorkflowResult
	s.NoError(s.env.GetWorkflowResult(&result))
	s.Equal(input.TransactionID, result.TransactionID)
}

func (s *WorkflowTestSuite) Test_ReverseTransferWorkflow_CompensationFails_ReturnsError() {
	input := temporalworker.ReverseTransferWorkflowInput{
		TransactionID:     uuid.New(),
		RequesterWalletID: uuid.New(),
	}

	s.env.OnActivity(a.CompensateTransferActivity, mock.Anything, input.TransactionID, input.RequesterWalletID).
		Return(errors.New("compensation failed"))

	s.env.ExecuteWorkflow(temporalworker.ReverseTransferWorkflow, input)

	s.True(s.env.IsWorkflowCompleted())
	s.Error(s.env.GetWorkflowError())
}
