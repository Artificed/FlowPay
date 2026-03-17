package service

import (
	"context"
	"errors"
	"flowpay-be/internal/models"
	"flowpay-be/internal/repository"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

var (
	ErrEmailTaken   = errors.New("email already in use")
	ErrInvalidCreds = errors.New("invalid email or password")
)

type Claims struct {
	UserID uuid.UUID `json:"user_id"`
	jwt.RegisteredClaims
}

type RegisterInput struct {
	Email       string
	Password    string
	DisplayName string
}

type LoginInput struct {
	Email    string
	Password string
}

type AuthResult struct {
	Token string       `json:"token"`
	User  *models.User `json:"user"`
}

type AuthService interface {
	Register(ctx context.Context, input RegisterInput) (*AuthResult, error)
	Login(ctx context.Context, input LoginInput) (*AuthResult, error)
}

type authService struct {
	db        *gorm.DB
	userRepo  repository.UserRepository
	jwtSecret []byte
	jwtExpiry time.Duration
}

func NewAuthService(db *gorm.DB, userRepo repository.UserRepository, jwtSecret string, jwtExpiryHours int) AuthService {
	return &authService{
		db:        db,
		userRepo:  userRepo,
		jwtSecret: []byte(jwtSecret),
		jwtExpiry: time.Duration(jwtExpiryHours) * time.Hour,
	}
}

func (s *authService) Register(ctx context.Context, input RegisterInput) (*AuthResult, error) {
	_, err := s.userRepo.FindByEmail(ctx, input.Email)
	if err == nil {
		return nil, ErrEmailTaken
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	user := &models.User{
		Email:        input.Email,
		PasswordHash: string(hash),
		DisplayName:  input.DisplayName,
	}

	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(user).Error; err != nil {
			return err
		}
		wallet := &models.Wallet{
			UserID: user.ID,
			Status: models.WalletStatusActive,
		}
		return tx.Create(wallet).Error
	})
	if err != nil {
		return nil, err
	}

	token, err := s.signToken(user.ID)
	if err != nil {
		return nil, err
	}

	return &AuthResult{Token: token, User: user}, nil
}

func (s *authService) Login(ctx context.Context, input LoginInput) (*AuthResult, error) {
	user, err := s.userRepo.FindByEmail(ctx, input.Email)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrInvalidCreds
		}
		return nil, err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)); err != nil {
		return nil, ErrInvalidCreds
	}

	token, err := s.signToken(user.ID)
	if err != nil {
		return nil, err
	}

	return &AuthResult{Token: token, User: user}, nil
}

func (s *authService) signToken(userID uuid.UUID) (string, error) {
	claims := Claims{
		UserID: userID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(s.jwtExpiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.jwtSecret)
}
