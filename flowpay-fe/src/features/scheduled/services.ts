import { apiClient } from "@/shared/lib/api/client"
import type { ScheduledPayment, CreateScheduledPaymentInput } from "./types"

export const scheduledPaymentService = {
  list: () =>
    apiClient
      .get<{ data: ScheduledPayment[] }>("/scheduled-payments")
      .then((r) => r.data.data),

  create: (body: CreateScheduledPaymentInput) =>
    apiClient
      .post<ScheduledPayment>("/scheduled-payments", body)
      .then((r) => r.data),

  cancel: (id: string) =>
    apiClient.delete(`/scheduled-payments/${id}`),
}
