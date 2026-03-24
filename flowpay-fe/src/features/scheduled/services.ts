import { api } from "@/lib/api"
import type { ScheduledPayment, CreateScheduledPaymentInput } from "./types"

export const scheduledPaymentService = {
  list: () =>
    api
      .get<{ data: ScheduledPayment[] }>("/scheduled-payments")
      .then((r) => r.data.data),

  create: (body: CreateScheduledPaymentInput) =>
    api
      .post<ScheduledPayment>("/scheduled-payments", body)
      .then((r) => r.data),

  cancel: (id: string) =>
    api.delete(`/scheduled-payments/${id}`),
}
