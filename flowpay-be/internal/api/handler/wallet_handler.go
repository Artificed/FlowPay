package handler

import (
	"flowpay-be/internal/api/middleware"
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
