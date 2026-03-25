import { apiClient } from "@/shared/lib/api/client"
import type { ScheduledPayment, CreateScheduledPaymentInput } from "./types"

export const scheduledPaymentService = {
  list: (params?: { status?: "active" | "cancelled"; limit?: number; offset?: number }) =>
    apiClient
      .get<{ data: ScheduledPayment[]; total: number }>("/scheduled-payments", { params })
      .then((r) => r.data),

  create: (body: CreateScheduledPaymentInput) =>
    apiClient
      .post<ScheduledPayment>("/scheduled-payments", body)
      .then((r) => r.data),

  cancel: (id: string) =>
    apiClient.delete(`/scheduled-payments/${id}`),
}
