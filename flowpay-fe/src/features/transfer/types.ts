export type TransactionStatus = "pending" | "processing" | "completed" | "failed" | "reversed"

export type TransactionType = "transfer" | "deposit"

export type Transaction = {
  id: string
  reference_code: string
  sender_wallet_id: string | null
  recipient_wallet_id: string
  amount: number
  currency: string
  note?: string
  status: TransactionStatus
  type: TransactionType
  sender_name?: string
  recipient_name?: string
  created_at: string
  updated_at: string
}

export type FilterRange = "1d" | "7d" | "30d" | "all"

export type ChartPoint = { date: string; inflow: number; outflow: number }

export type CreateTransferInput = {
  recipient_wallet_id: string
  amount: number
  currency: string
  note?: string
}
