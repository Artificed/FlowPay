package storage

import (
	"context"
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"
)

func TestNewStorageService_UsesPathStyleOnlyForACustomEndpoint(t *testing.T) {
	custom, err := NewStorageService(context.Background(), Options{
		Endpoint:  "seaweedfs:8333",
		Region:    "us-east-1",
		AccessKey: "key",
		SecretKey: "secret",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	opts := custom.client.Options()
	if aws.ToString(opts.BaseEndpoint) != "http://seaweedfs:8333" || !opts.UsePathStyle {
		t.Errorf("custom endpoint: BaseEndpoint %q, UsePathStyle %v", aws.ToString(opts.BaseEndpoint), opts.UsePathStyle)
	}

	onAWS, err := NewStorageService(context.Background(), Options{Region: "ap-southeast-3"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	opts = onAWS.client.Options()
	if opts.BaseEndpoint != nil || opts.UsePathStyle || opts.Region != "ap-southeast-3" {
		t.Errorf("aws: BaseEndpoint %v, UsePathStyle %v, Region %q", opts.BaseEndpoint, opts.UsePathStyle, opts.Region)
	}
}

func TestPublicURLAndKeyFromURL_RoundTrip(t *testing.T) {
	svc := &StorageService{publicURL: "https://flowpay.my.id"}
	url := svc.PublicURL("avatars/u1/a1")
	if url != "https://flowpay.my.id/avatars/u1/a1" {
		t.Fatalf("PublicURL = %q", url)
	}
	if key, ok := svc.KeyFromURL(url); !ok || key != "avatars/u1/a1" {
		t.Errorf("KeyFromURL = %q, %v", key, ok)
	}
	if _, ok := svc.KeyFromURL("https://elsewhere.example/avatars/u1/a1"); ok {
		t.Error("KeyFromURL accepted a URL from another host")
	}
}
