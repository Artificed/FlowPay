package service

import (
	"context"
	"errors"
	"flowpay-be/internal/models"
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type mockUserRepo struct {
	findByEmailFn func(email string) (*models.User, error)
}

func (m *mockUserRepo) Create(_ context.Context, _ *models.User) error { return nil }
func (m *mockUserRepo) FindByEmail(_ context.Context, email string) (*models.User, error) {
	return m.findByEmailFn(email)
}
func (m *mockUserRepo) FindByID(_ context.Context, _ uuid.UUID) (*models.User, error) {
	return nil, gorm.ErrRecordNotFound
}
func (m *mockUserRepo) UpdateAvatarURL(_ context.Context, _ uuid.UUID, _ *string) error   { return nil }
func (m *mockUserRepo) UpdateDisplayName(_ context.Context, _ uuid.UUID, _ string) error  { return nil }
func (m *mockUserRepo) UpdatePasswordHash(_ context.Context, _ uuid.UUID, _ string) error { return nil }

func TestLogin_UserNotFound(t *testing.T) {
	svc := NewAuthService(nil, &mockUserRepo{
		findByEmailFn: func(string) (*models.User, error) { return nil, gorm.ErrRecordNotFound },
	}, "secret", 24)

	_, err := svc.Login(context.Background(), LoginInput{Email: "a@b.com", Password: "password"})
	if !errors.Is(err, ErrInvalidCreds) {
		t.Errorf("expected ErrInvalidCreds, got %v", err)
	}
}

func TestLogin_WrongPassword(t *testing.T) {
	hash, _ := bcrypt.GenerateFromPassword([]byte("correct-password"), bcrypt.MinCost)
	user := &models.User{Email: "a@b.com", PasswordHash: string(hash)}
	user.ID = uuid.New()

	svc := NewAuthService(nil, &mockUserRepo{
		findByEmailFn: func(string) (*models.User, error) { return user, nil },
	}, "secret", 24)

	_, err := svc.Login(context.Background(), LoginInput{Email: "a@b.com", Password: "wrong-password"})
	if !errors.Is(err, ErrInvalidCreds) {
		t.Errorf("expected ErrInvalidCreds, got %v", err)
	}
}

func TestLogin_Success(t *testing.T) {
	hash, _ := bcrypt.GenerateFromPassword([]byte("correct-password"), bcrypt.MinCost)
	userID := uuid.New()
	user := &models.User{Email: "a@b.com", PasswordHash: string(hash)}
	user.ID = userID

	svc := NewAuthService(nil, &mockUserRepo{
		findByEmailFn: func(string) (*models.User, error) { return user, nil },
	}, "test-secret", 24)

	result, err := svc.Login(context.Background(), LoginInput{Email: "a@b.com", Password: "correct-password"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Token == "" {
		t.Error("expected non-empty token")
	}
	if result.User.ID != userID {
		t.Errorf("expected user ID %v, got %v", userID, result.User.ID)
	}

	claims := &Claims{}
	_, err = jwt.ParseWithClaims(result.Token, claims, func(*jwt.Token) (any, error) {
		return []byte("test-secret"), nil
	})
	if err != nil {
		t.Errorf("token parse failed: %v", err)
	}
	if claims.UserID != userID {
		t.Errorf("token user ID mismatch: expected %v, got %v", userID, claims.UserID)
	}
}

func TestRegister_EmailTaken(t *testing.T) {
	existing := &models.User{Email: "taken@example.com"}
	svc := NewAuthService(nil, &mockUserRepo{
		findByEmailFn: func(string) (*models.User, error) { return existing, nil },
	}, "secret", 24)

	_, err := svc.Register(context.Background(), RegisterInput{
		Email: "taken@example.com", Password: "password123", DisplayName: "Test",
	})
	if !errors.Is(err, ErrEmailTaken) {
		t.Errorf("expected ErrEmailTaken, got %v", err)
	}
}

func TestRegister_Success(t *testing.T) {
	db, mock := newMockDB(t)

	mock.ExpectBegin()
	mock.ExpectExec(`INSERT INTO "users"`).WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectExec(`INSERT INTO "wallets"`).WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	svc := NewAuthService(db, &mockUserRepo{
		findByEmailFn: func(string) (*models.User, error) { return nil, gorm.ErrRecordNotFound },
	}, "test-secret", 24)

	result, err := svc.Register(context.Background(), RegisterInput{
		Email: "new@example.com", Password: "password123", DisplayName: "New User",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Token == "" {
		t.Error("expected non-empty token")
	}
	if result.User.Email != "new@example.com" {
		t.Errorf("expected email new@example.com, got %v", result.User.Email)
	}
}
