import { http } from "@/lib/http"
import type { Wallet, WalletBalance, SupportedCurrency } from "./types"

export const walletService = {
  getWallet: () => http.get<Wallet>("/api/wallet").then((r) => r.data),

  deposit: (body: { amount: number; currency: string }) =>
    http.post<WalletBalance>("/api/wallet/deposit", body).then((r) => r.data),

  getCurrencies: () =>
    http.get<SupportedCurrency[]>("/api/currencies").then((r) => r.data),
}
