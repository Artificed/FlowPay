import { http } from "@/lib/http"
import type { Transaction, CreateTransferInput } from "./types"

export const transferService = {
  listTransfers: (params?: { limit?: number; offset?: number }) =>
    http.get<Transaction[]>("/api/v1/transfers", { params }).then((r) => r.data),

  createTransfer: (body: CreateTransferInput) =>
    http.post<Transaction>("/api/v1/transfers", body).then((r) => r.data),

  getTransfer: (id: string) =>
    http.get<Transaction>(`/api/v1/transfers/${id}`).then((r) => r.data),
}
