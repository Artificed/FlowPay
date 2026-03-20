package temporal

import (
	"flowpay-be/internal/service"

	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/worker"
)

func NewClient(address string) (client.Client, error) {
	return client.Dial(client.Options{
		HostPort: address,
	})
}

func NewWorker(c client.Client, transferSvc service.TransferService) worker.Worker {
	w := worker.New(c, TaskQueue, worker.Options{})

	activities := NewActivities(transferSvc)
	w.RegisterWorkflow(TransferWorkflow)
	w.RegisterActivity(activities)

	return w
}
