package handler

import (
	"errors"
	"flowpay-be/internal/api/middleware"
	"flowpay-be/internal/currency"
	"flowpay-be/internal/service"
	temporalworker "flowpay-be/internal/temporal"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	enumspb "go.temporal.io/api/enums/v1"
	"go.temporal.io/sdk/client"
)

type ScheduledPaymentHandler struct {
	svc            service.ScheduledPaymentService
	temporalClient client.Client
}

func NewScheduledPaymentHandler(svc service.ScheduledPaymentService, temporalClient client.Client) *ScheduledPaymentHandler {
	return &ScheduledPaymentHandler{svc: svc, temporalClient: temporalClient}
}

type createScheduledPaymentRequest struct {
	RecipientWalletID uuid.UUID `json:"recipient_wallet_id" binding:"required"`
	Amount            int64     `json:"amount"              binding:"required,gt=0"`
	Currency          string    `json:"currency"            binding:"required,len=3"`
	Note              string    `json:"note"`
	IntervalDays      int       `json:"interval_days"       binding:"required,gt=0"`
	FirstRunAt        time.Time `json:"first_run_at"        binding:"required"`
}

// CreateScheduledPayment godoc
// @Summary      Create a recurring scheduled payment
// @Tags         scheduled-payments
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body body createScheduledPaymentRequest true "Scheduled payment details"
// @Success      201 {object} models.ScheduledPayment
// @Failure      400 {object} map[string]string
// @Failure      401 {object} map[string]string
// @Router       /scheduled-payments [post]
func (h *ScheduledPaymentHandler) Create(c *gin.Context) {
	userID := c.MustGet(middleware.UserIDKey).(uuid.UUID)

	var req createScheduledPaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid input"})
		return
	}

	sp, err := h.svc.Create(c.Request.Context(), service.CreateScheduledPaymentInput{
		UserID:            userID,
		RecipientWalletID: req.RecipientWalletID,
		Amount:            req.Amount,
		Currency:          req.Currency,
		Note:              req.Note,
		IntervalDays:      req.IntervalDays,
		FirstRunAt:        req.FirstRunAt,
	})
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidAmount):
			c.JSON(http.StatusBadRequest, gin.H{"error": "amount must be greater than zero"})
		case errors.Is(err, service.ErrSelfTransfer):
			c.JSON(http.StatusBadRequest, gin.H{"error": "cannot schedule payment to yourself"})
		case errors.Is(err, service.ErrRecipientNotFound):
			c.JSON(http.StatusBadRequest, gin.H{"error": "recipient wallet not found"})
		case errors.Is(err, currency.ErrUnsupportedCurrency):
			c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported currency"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create scheduled payment"})
		}
		return
	}

	_, err = h.temporalClient.ExecuteWorkflow(
		c.Request.Context(),
		client.StartWorkflowOptions{
			ID:                    sp.WorkflowID,
			TaskQueue:             temporalworker.TaskQueue,
			WorkflowIDReusePolicy: enumspb.WORKFLOW_ID_REUSE_POLICY_ALLOW_DUPLICATE_FAILED_ONLY,
		},
		temporalworker.ScheduledPaymentWorkflow,
		temporalworker.ScheduledPaymentWorkflowInput{
			ScheduledPaymentID: sp.ID,
			UserID:             sp.UserID,
			RecipientWalletID:  sp.RecipientWalletID,
			Amount:             sp.Amount,
			Currency:           sp.Currency,
			Note:               sp.Note,
			IntervalDays:       sp.IntervalDays,
			FirstRunAt:         sp.NextRunAt,
		},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to start scheduled payment workflow"})
		return
	}

	c.JSON(http.StatusCreated, sp)
}

// ListScheduledPayments godoc
// @Summary      List scheduled payments for current user
// @Tags         scheduled-payments
// @Produce      json
// @Security     BearerAuth
// @Success      200 {object} map[string]interface{}
// @Failure      401 {object} map[string]string
// @Router       /scheduled-payments [get]
func (h *ScheduledPaymentHandler) List(c *gin.Context) {
	userID := c.MustGet(middleware.UserIDKey).(uuid.UUID)

	sps, err := h.svc.List(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list scheduled payments"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": sps})
}

// CancelScheduledPayment godoc
// @Summary      Cancel a scheduled payment
// @Tags         scheduled-payments
// @Produce      json
// @Security     BearerAuth
// @Param        id path string true "Scheduled Payment ID"
// @Success      204
// @Failure      400 {object} map[string]string
// @Failure      401 {object} map[string]string
// @Failure      403 {object} map[string]string
// @Failure      404 {object} map[string]string
// @Router       /scheduled-payments/{id} [delete]
func (h *ScheduledPaymentHandler) Cancel(c *gin.Context) {
	userID := c.MustGet(middleware.UserIDKey).(uuid.UUID)

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid scheduled payment id"})
		return
	}

	if err := h.svc.Cancel(c.Request.Context(), id, userID); err != nil {
		switch {
		case errors.Is(err, service.ErrScheduledPaymentNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "scheduled payment not found"})
		case errors.Is(err, service.ErrNotScheduledPaymentOwner):
			c.JSON(http.StatusForbidden, gin.H{"error": "only the owner can cancel this scheduled payment"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to cancel scheduled payment"})
		}
		return
	}

	c.Status(http.StatusNoContent)
}
