import { http } from "@/lib/http"
import type { ScheduledPayment, CreateScheduledPaymentInput } from "./types"

export const scheduledPaymentService = {
  list: () =>
    http
      .get<{ data: ScheduledPayment[] }>("/api/scheduled-payments")
      .then((r) => r.data.data),

  create: (body: CreateScheduledPaymentInput) =>
    http
      .post<ScheduledPayment>("/api/scheduled-payments", body)
      .then((r) => r.data),

  cancel: (id: string) =>
    http.delete(`/api/scheduled-payments/${id}`),
}
