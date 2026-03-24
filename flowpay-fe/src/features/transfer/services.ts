import { fetchEventSource } from "@microsoft/fetch-event-source"
import { api, BASE_URL } from "@/lib/api"
import type { Transaction, CreateTransferInput } from "./types"
import type { Wallet } from "@/features/wallet/types"

export const transferService = {
  listTransfers: (params?: { limit?: number; offset?: number }) =>
    api
      .get<{ data: Transaction[]; total: number }>("/transfers", { params })
      .then((r) => r.data),

  createTransfer: (body: CreateTransferInput, idempotencyKey: string) =>
    api
      .post<Transaction>("/transfers", body, {
        headers: { "Idempotency-Key": idempotencyKey },
      })
      .then((r) => r.data),

  getTransfer: (id: string) =>
    api.get<Transaction>(`/transfers/${id}`).then((r) => r.data),
}

export function streamTransactions(handlers: {
  onSnapshot: (txns: Transaction[]) => void
  onTransactionUpdate: (txn: Transaction) => void
  onWalletUpdate: (wallet: Wallet) => void
  onError?: (err: unknown) => void
  signal: AbortSignal
}): void {
  const token = localStorage.getItem("flowpay_token")

  fetchEventSource(`${BASE_URL}/transfers/stream`, {
    headers: { Authorization: token ? `Bearer ${token}` : "" },
    signal: handlers.signal,
    async onopen(response) {
      if (response.ok) return
      if (response.status === 401) throw new Error("Unauthorized")
    },
    onmessage(msg) {
      if (!msg.event) return
      try {
        switch (msg.event) {
          case "snapshot":
            handlers.onSnapshot(JSON.parse(msg.data) as Transaction[])
            break
          case "transaction_update":
            handlers.onTransactionUpdate(JSON.parse(msg.data) as Transaction)
            break
          case "wallet_update":
            handlers.onWalletUpdate(JSON.parse(msg.data) as Wallet)
            break
        }
      } catch {

      }
    },
    onerror(err) {
      handlers.onError?.(err)
      if (err instanceof Error && err.message === "Unauthorized") throw err
    },
  })
}
