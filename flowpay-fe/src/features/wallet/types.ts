export type SupportedCurrency = {
  code: string
  name: string
}

export type WalletStatus = "active" | "suspended" | "closed"

export type WalletBalance = {
  id: string
  wallet_id: string
  currency: string
  total_amount: number
  available_amount: number
  created_at: string
  updated_at: string
}

export type Wallet = {
  id: string
  user_id: string
  status: WalletStatus
  Balances: WalletBalance[]
  created_at: string
  updated_at: string
}
