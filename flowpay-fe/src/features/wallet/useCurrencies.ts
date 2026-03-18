import { useEffect, useState } from "react"
import { walletService } from "./services"
import type { SupportedCurrency } from "./types"

export function useCurrencies() {
  const [currencies, setCurrencies] = useState<SupportedCurrency[]>([])

  useEffect(() => {
    walletService.getCurrencies().then(setCurrencies).catch(() => {})
  }, [])

  return currencies
}
