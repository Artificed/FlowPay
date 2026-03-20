package handler

import (
	"errors"
	"flowpay-be/internal/api/middleware"
	"flowpay-be/internal/currency"
	"flowpay-be/internal/service"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type WalletHandler struct {
	walletSvc service.WalletService
}

func NewWalletHandler(walletSvc service.WalletService) *WalletHandler {
	return &WalletHandler{walletSvc: walletSvc}
}

// GetWallet godoc
// @Summary      Get current user's wallet and balances
// @Tags         wallet
// @Produce      json
// @Security     BearerAuth
// @Success      200 {object} models.Wallet
// @Failure      401 {object} map[string]string
// @Failure      404 {object} map[string]string
// @Router       /wallet [get]
func (h *WalletHandler) GetWallet(c *gin.Context) {
	userID := c.MustGet(middleware.UserIDKey).(uuid.UUID)

	wallet, err := h.walletSvc.GetWallet(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "wallet not found"})
		return
	}

	c.JSON(http.StatusOK, wallet)
}

type depositRequest struct {
	Amount   int64  `json:"amount"   binding:"required,gt=0"`
	Currency string `json:"currency" binding:"required,len=3"`
}

// Deposit godoc
// @Summary      Add funds to wallet
// @Tags         wallet
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body body depositRequest true "Deposit details"
// @Success      200 {object} models.WalletBalance
// @Failure      400 {object} map[string]string
// @Failure      401 {object} map[string]string
// @Router       /wallet/deposit [post]
func (h *WalletHandler) Deposit(c *gin.Context) {
	userID := c.MustGet(middleware.UserIDKey).(uuid.UUID)

	var req depositRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	balance, err := h.walletSvc.Deposit(c.Request.Context(), service.DepositInput{
		UserID:   userID,
		Amount:   req.Amount,
		Currency: req.Currency,
	})
	if err != nil {
		switch {
		case errors.Is(err, currency.ErrUnsupportedCurrency):
			c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported currency"})
		case errors.Is(err, service.ErrInvalidDepositAmount):
			c.JSON(http.StatusBadRequest, gin.H{"error": "amount must be greater than zero"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "deposit failed"})
		}
		return
	}

	c.JSON(http.StatusOK, balance)
}

// GetCurrencies godoc
// @Summary      List supported currencies
// @Tags         wallet
// @Produce      json
// @Success      200 {array} currency.Currency
// @Router       /currencies [get]
func GetCurrencies(c *gin.Context) {
	c.JSON(http.StatusOK, currency.All())
}
