import { apiClient } from "@/shared/lib/api/client"
import type { Wallet, WalletBalance, SupportedCurrency } from "./types"

export const walletService = {
  getWallet: () => apiClient.get<Wallet>("/wallet").then((r) => r.data),

  deposit: (body: { amount: number; currency: string }) =>
    apiClient.post<WalletBalance>("/wallet/deposit", body).then((r) => r.data),

  getCurrencies: () =>
    apiClient.get<SupportedCurrency[]>("/currencies").then((r) => r.data),
}
