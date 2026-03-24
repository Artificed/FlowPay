export type ScheduledPaymentStatus = "active" | "cancelled"

export type ScheduledPayment = {
  id: string
  user_id: string
  recipient_wallet_id: string
  amount: number
  currency: string
  note?: string
  interval_days: number
  next_run_at: string
  status: ScheduledPaymentStatus
  workflow_id: string
  created_at: string
  updated_at: string
}

export type CreateScheduledPaymentInput = {
  recipient_wallet_id: string
  amount: number
  currency: string
  note?: string
  interval_days: number
  first_run_at: string
}
