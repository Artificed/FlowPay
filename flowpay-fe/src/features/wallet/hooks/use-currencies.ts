import { useEffect, useState } from "react"
import { walletService } from "../services"
import type { SupportedCurrency } from "../types"

export function useCurrencies() {
  const [currencies, setCurrencies] = useState<SupportedCurrency[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    walletService
      .getCurrencies()
      .then(setCurrencies)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load currencies"))
  }, [])

  return { currencies, currencyError: error }
}
