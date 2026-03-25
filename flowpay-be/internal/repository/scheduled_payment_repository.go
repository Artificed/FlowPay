package repository

import (
	"context"
	"errors"
	"flowpay-be/internal/models"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ScheduledPaymentRepository interface {
	Create(ctx context.Context, sp *models.ScheduledPayment) error
	FindByID(ctx context.Context, id uuid.UUID) (*models.ScheduledPayment, error)
	ListByUserID(ctx context.Context, userID uuid.UUID) ([]models.ScheduledPayment, error)
	ListPageByUserID(ctx context.Context, userID uuid.UUID, status *models.ScheduledPaymentStatus, limit, offset int) ([]models.ScheduledPayment, error)
	CountByUserID(ctx context.Context, userID uuid.UUID, status *models.ScheduledPaymentStatus) (int64, error)
	UpdateStatus(ctx context.Context, id uuid.UUID, status models.ScheduledPaymentStatus) error
	UpdateNextRunAt(ctx context.Context, id uuid.UUID, nextRunAt time.Time) error
	Reactivate(ctx context.Context, id uuid.UUID, workflowID string, nextRunAt time.Time) error
	IsActive(ctx context.Context, id uuid.UUID) (bool, error)
	CancelWithReason(ctx context.Context, id uuid.UUID, reason string) error
}

type scheduledPaymentRepository struct {
	db *gorm.DB
}

func NewScheduledPaymentRepository(db *gorm.DB) ScheduledPaymentRepository {
	return &scheduledPaymentRepository{db: db}
}

func (r *scheduledPaymentRepository) Create(ctx context.Context, sp *models.ScheduledPayment) error {
	return r.db.WithContext(ctx).Create(sp).Error
}

func (r *scheduledPaymentRepository) FindByID(ctx context.Context, id uuid.UUID) (*models.ScheduledPayment, error) {
	var sp models.ScheduledPayment
	if err := r.db.WithContext(ctx).First(&sp, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &sp, nil
}

func (r *scheduledPaymentRepository) ListByUserID(ctx context.Context, userID uuid.UUID) ([]models.ScheduledPayment, error) {
	var sps []models.ScheduledPayment
	if err := r.db.WithContext(ctx).Where("user_id = ?", userID).Order("created_at DESC").Find(&sps).Error; err != nil {
		return nil, err
	}
	return sps, nil
}

func (r *scheduledPaymentRepository) ListPageByUserID(ctx context.Context, userID uuid.UUID, status *models.ScheduledPaymentStatus, limit, offset int) ([]models.ScheduledPayment, error) {
	var sps []models.ScheduledPayment
	q := r.db.WithContext(ctx).Where("user_id = ?", userID)
	if status != nil {
		q = q.Where("status = ?", *status)
	}
	if err := q.Order("created_at DESC").Limit(limit).Offset(offset).Find(&sps).Error; err != nil {
		return nil, err
	}
	return sps, nil
}

func (r *scheduledPaymentRepository) CountByUserID(ctx context.Context, userID uuid.UUID, status *models.ScheduledPaymentStatus) (int64, error) {
	var count int64
	q := r.db.WithContext(ctx).Model(&models.ScheduledPayment{}).Where("user_id = ?", userID)
	if status != nil {
		q = q.Where("status = ?", *status)
	}
	return count, q.Count(&count).Error
}

func (r *scheduledPaymentRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status models.ScheduledPaymentStatus) error {
	return r.db.WithContext(ctx).Model(&models.ScheduledPayment{}).Where("id = ?", id).Update("status", status).Error
}

func (r *scheduledPaymentRepository) UpdateNextRunAt(ctx context.Context, id uuid.UUID, nextRunAt time.Time) error {
	return r.db.WithContext(ctx).Model(&models.ScheduledPayment{}).Where("id = ?", id).Update("next_run_at", nextRunAt).Error
}

func (r *scheduledPaymentRepository) Reactivate(ctx context.Context, id uuid.UUID, workflowID string, nextRunAt time.Time) error {
	return r.db.WithContext(ctx).Model(&models.ScheduledPayment{}).Where("id = ?", id).Updates(map[string]any{
		"status":      models.ScheduledPaymentStatusActive,
		"workflow_id": workflowID,
		"next_run_at": nextRunAt,
	}).Error
}

func (r *scheduledPaymentRepository) CancelWithReason(ctx context.Context, id uuid.UUID, reason string) error {
	return r.db.WithContext(ctx).Model(&models.ScheduledPayment{}).
		Where("id = ?", id).
		Updates(map[string]any{"status": models.ScheduledPaymentStatusInactive, "failed_reason": reason}).Error
}

func (r *scheduledPaymentRepository) IsActive(ctx context.Context, id uuid.UUID) (bool, error) {
	var sp models.ScheduledPayment
	if err := r.db.WithContext(ctx).Select("status").First(&sp, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, nil
		}
		return false, err
	}
	return sp.Status == models.ScheduledPaymentStatusActive, nil
}
