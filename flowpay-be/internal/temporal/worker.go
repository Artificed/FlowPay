package temporal

import (
	"flowpay-be/internal/repository"
	"flowpay-be/internal/service"

	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/worker"
)

func NewClient(address string) (client.Client, error) {
	return client.Dial(client.Options{
		HostPort: address,
	})
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
