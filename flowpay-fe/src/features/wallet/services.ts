import { api } from "@/lib/api"
import type { Wallet, WalletBalance, SupportedCurrency } from "./types"

export const walletService = {
  getWallet: () => api.get<Wallet>("/wallet").then((r) => r.data),

  deposit: (body: { amount: number; currency: string }) =>
    api.post<WalletBalance>("/wallet/deposit", body).then((r) => r.data),

  getCurrencies: () =>
    api.get<SupportedCurrency[]>("/currencies").then((r) => r.data),
}
