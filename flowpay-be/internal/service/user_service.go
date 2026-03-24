package service

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"flowpay-be/internal/models"
	"flowpay-be/internal/repository"
	"flowpay-be/internal/storage"
	"io"
	"strings"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidImageType  = errors.New("only jpeg, png, and webp images are allowed")
	ErrImageTooLarge     = errors.New("image must be 5MB or less")
	ErrInvalidPassword   = errors.New("current password is incorrect")
	ErrPasswordReused    = errors.New("new password must be different from your current password")
)

const maxAvatarSize = 5 * 1024 * 1024

type UserService interface {
	UpdateAvatar(ctx context.Context, userID uuid.UUID, contentType string, r io.Reader) (*models.User, error)
	RemoveAvatar(ctx context.Context, userID uuid.UUID) error
	UpdateDisplayName(ctx context.Context, userID uuid.UUID, name string) (*models.User, error)
	ChangePassword(ctx context.Context, userID uuid.UUID, currentPwd, newPwd string) error
}

type userService struct {
	userRepo   repository.UserRepository
	storageSvc *storage.StorageService
}

func NewUserService(userRepo repository.UserRepository, storageSvc *storage.StorageService) UserService {
	return &userService{userRepo: userRepo, storageSvc: storageSvc}
}

func (s *userService) UpdateAvatar(ctx context.Context, userID uuid.UUID, contentType string, r io.Reader) (*models.User, error) {
	if !isAllowedImageType(contentType) {
		return nil, ErrInvalidImageType
	}

	var buf bytes.Buffer
	n, err := io.CopyN(&buf, r, maxAvatarSize+1)
	if err != nil && err != io.EOF {
		return nil, fmt.Errorf("read avatar: %w", err)
	}
	if n > maxAvatarSize {
		return nil, ErrImageTooLarge
	}

	key, err := s.storageSvc.UploadAvatar(ctx, userID, contentType, &buf, n)
	if err != nil {
		return nil, err
	}

	url := s.storageSvc.PublicURL(key)
	if err := s.userRepo.UpdateAvatarURL(ctx, userID, &url); err != nil {
		_ = s.storageSvc.DeleteObject(ctx, key)
		return nil, err
	}

	return s.userRepo.FindByID(ctx, userID)
}

func (s *userService) RemoveAvatar(ctx context.Context, userID uuid.UUID) error {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return err
	}

	if user.AvatarURL != nil {
		key := fmt.Sprintf("avatars/%s", userID.String())
		_ = s.storageSvc.DeleteObject(ctx, key)
	}

	return s.userRepo.UpdateAvatarURL(ctx, userID, nil)
}

func (s *userService) UpdateDisplayName(ctx context.Context, userID uuid.UUID, name string) (*models.User, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, errors.New("display name cannot be empty")
	}
	if len(name) > 100 {
		return nil, errors.New("display name must be 100 characters or less")
	}
	if err := s.userRepo.UpdateDisplayName(ctx, userID, name); err != nil {
		return nil, err
	}
	return s.userRepo.FindByID(ctx, userID)
}

func (s *userService) ChangePassword(ctx context.Context, userID uuid.UUID, currentPwd, newPwd string) error {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return err
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(currentPwd)); err != nil {
		return ErrInvalidPassword
	}
	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(newPwd)) == nil {
		return ErrPasswordReused
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(newPwd), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	return s.userRepo.UpdatePasswordHash(ctx, userID, string(hash))
}

func isAllowedImageType(contentType string) bool {
	ct := strings.ToLower(contentType)
	return ct == "image/jpeg" || ct == "image/png" || ct == "image/webp"
}
