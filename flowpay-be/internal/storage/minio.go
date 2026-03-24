package storage

import (
	"context"
	"encoding/json"
	"fmt"
	"io"

	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

type StorageService struct {
	client    *minio.Client
	bucket    string
	publicURL string
}

func NewStorageService(endpoint, accessKey, secretKey, bucket, publicURL string, useSSL bool) (*StorageService, error) {
	client, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("minio: create client: %w", err)
	}
	return &StorageService{client: client, bucket: bucket, publicURL: publicURL}, nil
}

func (s *StorageService) EnsureBucket(ctx context.Context) error {
	exists, err := s.client.BucketExists(ctx, s.bucket)
	if err != nil {
		return fmt.Errorf("minio: check bucket: %w", err)
	}
	if !exists {
		if err := s.client.MakeBucket(ctx, s.bucket, minio.MakeBucketOptions{}); err != nil {
			return fmt.Errorf("minio: create bucket: %w", err)
		}
	}

	policy := map[string]any{
		"Version": "2012-10-17",
		"Statement": []map[string]any{
			{
				"Effect":    "Allow",
				"Principal": map[string]any{"AWS": []string{"*"}},
				"Action":    []string{"s3:GetObject"},
				"Resource":  []string{fmt.Sprintf("arn:aws:s3:::%s/avatars/*", s.bucket)},
			},
		},
	}
	policyJSON, err := json.Marshal(policy)
	if err != nil {
		return fmt.Errorf("minio: marshal policy: %w", err)
	}
	if err := s.client.SetBucketPolicy(ctx, s.bucket, string(policyJSON)); err != nil {
		return fmt.Errorf("minio: set bucket policy: %w", err)
	}
	return nil
}

func (s *StorageService) UploadAvatar(ctx context.Context, userID uuid.UUID, contentType string, r io.Reader, size int64) (string, error) {
	key := fmt.Sprintf("avatars/%s", userID.String())
	_, err := s.client.PutObject(ctx, s.bucket, key, r, size, minio.PutObjectOptions{
		ContentType: contentType,
	})
	if err != nil {
		return "", fmt.Errorf("minio: upload avatar: %w", err)
	}
	return key, nil
}

func (s *StorageService) DeleteObject(ctx context.Context, key string) error {
	if err := s.client.RemoveObject(ctx, s.bucket, key, minio.RemoveObjectOptions{}); err != nil {
		return fmt.Errorf("minio: delete object: %w", err)
	}
	return nil
}

func (s *StorageService) PublicURL(key string) string {
	return fmt.Sprintf("%s/%s/%s", s.publicURL, s.bucket, key)
}
