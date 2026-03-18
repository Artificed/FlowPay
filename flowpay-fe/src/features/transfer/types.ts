export type TransactionStatus = "pending" | "processing" | "completed" | "failed" | "reversed"

export type Transaction = {
  id: string
  reference_code: string
  sender_wallet_id: string
  recipient_wallet_id: string
  amount: number
  currency: string
  note?: string
  status: TransactionStatus
  created_at: string
  updated_at: string
}

export type CreateTransferInput = {
  recipient_wallet_id: string
  amount: number
  currency: string
  note?: string
}
