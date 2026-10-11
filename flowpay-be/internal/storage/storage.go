package storage

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/google/uuid"
)

type StorageService struct {
	client    *s3.Client
	bucket    string
	publicURL string
}

type Options struct {
	Endpoint  string
	Region    string
	UseSSL    bool
	Bucket    string
	PublicURL string
	AccessKey string
	SecretKey string
}

func NewStorageService(ctx context.Context, opts Options) (*StorageService, error) {
	loadOpts := []func(*awsconfig.LoadOptions) error{awsconfig.WithRegion(opts.Region)}
	if opts.AccessKey != "" {
		loadOpts = append(loadOpts, awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(opts.AccessKey, opts.SecretKey, "")))
	}
	cfg, err := awsconfig.LoadDefaultConfig(ctx, loadOpts...)
	if err != nil {
		return nil, fmt.Errorf("storage: load aws config: %w", err)
	}

	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		if opts.Endpoint == "" {
			return
		}
		scheme := "http"
		if opts.UseSSL {
			scheme = "https"
		}
		o.BaseEndpoint = aws.String(scheme + "://" + opts.Endpoint)
		o.UsePathStyle = true
	})
	return &StorageService{client: client, bucket: opts.Bucket, publicURL: strings.TrimSuffix(opts.PublicURL, "/")}, nil
}

func (s *StorageService) EnsureBucket(ctx context.Context) error {
	_, err := s.client.HeadBucket(ctx, &s3.HeadBucketInput{Bucket: aws.String(s.bucket)})
	var notFound *types.NotFound
	switch {
	case errors.As(err, &notFound):
		input := &s3.CreateBucketInput{Bucket: aws.String(s.bucket)}
		if region := s.client.Options().Region; region != "us-east-1" {
			input.CreateBucketConfiguration = &types.CreateBucketConfiguration{LocationConstraint: types.BucketLocationConstraint(region)}
		}
		if _, err := s.client.CreateBucket(ctx, input); err != nil {
			return fmt.Errorf("storage: create bucket: %w", err)
		}
	case err != nil:
		return fmt.Errorf("storage: check bucket: %w", err)
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
		return fmt.Errorf("storage: marshal policy: %w", err)
	}
	if _, err := s.client.PutBucketPolicy(ctx, &s3.PutBucketPolicyInput{
		Bucket: aws.String(s.bucket),
		Policy: aws.String(string(policyJSON)),
	}); err != nil {
		return fmt.Errorf("storage: set bucket policy: %w", err)
	}
	return nil
}

func (s *StorageService) UploadAvatar(ctx context.Context, userID uuid.UUID, contentType string, body io.ReadSeeker, size int64) (string, error) {
	key := fmt.Sprintf("avatars/%s/%s", userID, uuid.NewString())
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:        aws.String(s.bucket),
		Key:           aws.String(key),
		Body:          body,
		ContentLength: aws.Int64(size),
		ContentType:   aws.String(contentType),
	})
	if err != nil {
		return "", fmt.Errorf("storage: upload avatar: %w", err)
	}
	return key, nil
}

func (s *StorageService) DeleteObject(ctx context.Context, key string) error {
	if _, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	}); err != nil {
		return fmt.Errorf("storage: delete object: %w", err)
	}
	return nil
}

func (s *StorageService) PublicURL(key string) string {
	return s.publicURL + "/" + key
}

func (s *StorageService) KeyFromURL(url string) (string, bool) {
	return strings.CutPrefix(url, s.publicURL+"/")
}
