import { useEffect, useEffectEvent } from "react"
import { streamTransactions } from "../services"
import type { Transaction } from "../types"
import type { Wallet } from "@/features/wallet/types"

type Handlers = {
  onSnapshot?: (txns: Transaction[]) => void
  onReconnect?: () => void
  onTransactionUpdate: (updated: Transaction) => void
  onWalletUpdate: (wallet: Wallet) => void
  onError?: (err: unknown) => void
}

export function useSSETransactions(handlers: Handlers): void {
  const handleSnapshot = useEffectEvent((txns: Transaction[], reconnected: boolean) => {
    if (reconnected) handlers.onReconnect?.()
    handlers.onSnapshot?.(txns)
  })
  const handleTransactionUpdate = useEffectEvent((updated: Transaction) => handlers.onTransactionUpdate(updated))
  const handleWalletUpdate = useEffectEvent((wallet: Wallet) => handlers.onWalletUpdate(wallet))
  const handleError = useEffectEvent((err: unknown) => handlers.onError?.(err))

  useEffect(() => {
    const ctrl = new AbortController()
    let connected = false
    streamTransactions({
      signal: ctrl.signal,
      onSnapshot(txns) {
        const reconnected = connected
        connected = true
        handleSnapshot(txns, reconnected)
      },
      onTransactionUpdate(updated) {
        handleTransactionUpdate(updated)
      },
      onWalletUpdate(w) {
        handleWalletUpdate(w)
      },
      onError(err) {
        handleError(err)
      },
    })
    return () => ctrl.abort()
  }, [])
}
