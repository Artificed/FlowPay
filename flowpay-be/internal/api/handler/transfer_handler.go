package handler

import (
	"errors"
	"flowpay-be/internal/api/middleware"
	"flowpay-be/internal/service"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type TransferHandler struct {
	transferSvc service.TransferService
	walletSvc   service.WalletService
}

func NewTransferHandler(transferSvc service.TransferService, walletSvc service.WalletService) *TransferHandler {
	return &TransferHandler{transferSvc: transferSvc, walletSvc: walletSvc}
}

type transferRequest struct {
	RecipientWalletID uuid.UUID `json:"recipient_wallet_id" binding:"required"`
	Amount            int64     `json:"amount"              binding:"required,gt=0"`
	Currency          string    `json:"currency"            binding:"required,len=3"`
	Note              string    `json:"note"`
}

// CreateTransfer godoc
// @Summary      Send money to another wallet
// @Tags         transfers
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body body transferRequest true "Transfer details"
// @Success      201 {object} models.Transaction
// @Failure      400 {object} map[string]string
// @Failure      401 {object} map[string]string
// @Failure      422 {object} map[string]string
// @Router       /transfers [post]
func (h *TransferHandler) CreateTransfer(c *gin.Context) {
	userID := c.MustGet(middleware.UserIDKey).(uuid.UUID)

	var req transferRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	txn, err := h.transferSvc.Transfer(c.Request.Context(), service.TransferInput{
		SenderUserID:      userID,
		RecipientWalletID: req.RecipientWalletID,
		Amount:            req.Amount,
		Currency:          req.Currency,
		Note:              req.Note,
	})
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInsufficientFunds):
			c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "insufficient funds"})
		case errors.Is(err, service.ErrSelfTransfer):
			c.JSON(http.StatusBadRequest, gin.H{"error": "cannot transfer to yourself"})
		case errors.Is(err, service.ErrInvalidAmount):
			c.JSON(http.StatusBadRequest, gin.H{"error": "amount must be greater than zero"})
		case errors.Is(err, service.ErrUnsupportedCurrency):
			c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported currency"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "transfer failed"})
		}
		return
	}

	c.JSON(http.StatusCreated, txn)
}

// ListTransfers godoc
// @Summary      List transactions for current user
// @Tags         transfers
// @Produce      json
// @Security     BearerAuth
// @Param        limit  query int false "Page size (default 20)"
// @Param        offset query int false "Offset (default 0)"
// @Success      200 {array} models.Transaction
// @Failure      401 {object} map[string]string
// @Router       /transfers [get]
func (h *TransferHandler) ListTransfers(c *gin.Context) {
	userID := c.MustGet(middleware.UserIDKey).(uuid.UUID)

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if limit > 100 {
		limit = 100
	}

	wallet, err := h.walletSvc.GetWallet(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "wallet not found"})
		return
	}

	transactions, err := h.transferSvc.ListTransactions(c.Request.Context(), wallet.ID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list transactions"})
		return
	}

	c.JSON(http.StatusOK, transactions)
}

// GetTransfer godoc
// @Summary      Get a transaction by ID
// @Tags         transfers
// @Produce      json
// @Security     BearerAuth
// @Param        id path string true "Transaction ID"
// @Success      200 {object} models.Transaction
// @Failure      401 {object} map[string]string
// @Failure      404 {object} map[string]string
// @Router       /transfers/{id} [get]
func (h *TransferHandler) GetTransfer(c *gin.Context) {
	userID := c.MustGet(middleware.UserIDKey).(uuid.UUID)

	txID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid transaction id"})
		return
	}

	wallet, err := h.walletSvc.GetWallet(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "wallet not found"})
		return
	}

	txn, err := h.transferSvc.GetTransaction(c.Request.Context(), txID, wallet.ID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "transaction not found"})
		return
	}

	c.JSON(http.StatusOK, txn)
}
