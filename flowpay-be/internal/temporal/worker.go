package temporal

import (
	"context"
	"flowpay-be/internal/repository"
	"flowpay-be/internal/service"
	"log/slog"
	"time"

	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/log"
	"go.temporal.io/sdk/worker"
)

func NewClient(ctx context.Context, address string) (client.Client, error) {
	delay := time.Second
	for {
		c, err := client.DialContext(ctx, client.Options{
			HostPort: address,
			Logger:   log.NewStructuredLogger(slog.Default()),
		})
		if err == nil {
			return c, nil
		}
		slog.Warn("temporal: dial failed", "error", err, "retry_in", delay.String())
		select {
		case <-ctx.Done():
			return nil, err
		case <-time.After(delay):
			delay = min(delay*2, 15*time.Second)
		}
	}
}

func NewWorker(c client.Client, transferSvc service.TransferService, scheduledPaymentRepo repository.ScheduledPaymentRepository) worker.Worker {
	w := worker.New(c, TaskQueue, worker.Options{})

	activities := NewActivities(transferSvc, scheduledPaymentRepo)
	w.RegisterWorkflow(TransferWorkflow)
	w.RegisterWorkflow(ReverseTransferWorkflow)
	w.RegisterWorkflow(ScheduledPaymentWorkflow)
	w.RegisterActivity(activities)

	return w
}
