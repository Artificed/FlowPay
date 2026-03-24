package handler

import (
	"errors"
	"flowpay-be/internal/api/middleware"
	"flowpay-be/internal/service"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type UserHandler struct {
	userSvc service.UserService
}

func NewUserHandler(userSvc service.UserService) *UserHandler {
	return &UserHandler{userSvc: userSvc}
}

// UpdateAvatar godoc
// @Summary      Upload profile picture
// @Tags         profile
// @Accept       multipart/form-data
// @Produce      json
// @Param        file  formData  file  true  "Avatar image (jpeg/png/webp, max 5MB)"
// @Success      200   {object}  models.User
// @Security     BearerAuth
// @Router       /profile/avatar [put]
func (h *UserHandler) UpdateAvatar(c *gin.Context) {
	userID := c.MustGet(middleware.UserIDKey).(uuid.UUID)

	if err := c.Request.ParseMultipartForm(10 << 20); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid multipart form"})
		return
	}

	file, _, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
		return
	}
	defer file.Close()

	sniff := make([]byte, 512)
	n, err := io.ReadFull(file, sniff)
	if err != nil && err != io.ErrUnexpectedEOF {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read file"})
		return
	}
	detectedType := http.DetectContentType(sniff[:n])
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to process file"})
		return
	}

	user, err := h.userSvc.UpdateAvatar(c.Request.Context(), userID, detectedType, file)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidImageType):
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		case errors.Is(err, service.ErrImageTooLarge):
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to upload avatar"})
		}
		return
	}

	c.JSON(http.StatusOK, user)
}

// RemoveAvatar godoc
// @Summary      Remove profile picture
// @Tags         profile
// @Success      204
// @Security     BearerAuth
// @Router       /profile/avatar [delete]
func (h *UserHandler) RemoveAvatar(c *gin.Context) {
	userID := c.MustGet(middleware.UserIDKey).(uuid.UUID)

	if err := h.userSvc.RemoveAvatar(c.Request.Context(), userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to remove avatar"})
		return
	}

	c.Status(http.StatusNoContent)
}

// UpdateProfile godoc
// @Summary      Update display name
// @Tags         profile
// @Accept       json
// @Produce      json
// @Param        body  body      object{display_name=string}  true  "Profile update"
// @Success      200   {object}  models.User
// @Security     BearerAuth
// @Router       /profile [patch]
func (h *UserHandler) UpdateProfile(c *gin.Context) {
	userID := c.MustGet(middleware.UserIDKey).(uuid.UUID)

	var req struct {
		DisplayName string `json:"display_name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid input"})
		return
	}

	user, err := h.userSvc.UpdateDisplayName(c.Request.Context(), userID, req.DisplayName)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, user)
}

// ChangePassword godoc
// @Summary      Change password
// @Tags         profile
// @Accept       json
// @Param        body  body  object{current_password=string,new_password=string}  true  "Password change"
// @Success      204
// @Security     BearerAuth
// @Router       /profile/password [patch]
func (h *UserHandler) ChangePassword(c *gin.Context) {
	userID := c.MustGet(middleware.UserIDKey).(uuid.UUID)

	var req struct {
		CurrentPassword string `json:"current_password" binding:"required"`
		NewPassword     string `json:"new_password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid input"})
		return
	}

	if err := h.userSvc.ChangePassword(c.Request.Context(), userID, req.CurrentPassword, req.NewPassword); err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidPassword), errors.Is(err, service.ErrPasswordReused):
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to change password"})
		}
		return
	}

	c.Status(http.StatusNoContent)
}
