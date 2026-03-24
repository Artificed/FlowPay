import { useEffect, useRef } from "react"
import { streamTransactions } from "../services"
import type { Transaction } from "../types"
import type { Wallet } from "@/features/wallet/types"

type Handlers = {
  onSnapshot?: (txns: Transaction[]) => void
  onTransactionUpdate: (updated: Transaction) => void
  onWalletUpdate: (wallet: Wallet) => void
  onError?: (err: unknown) => void
}

export function useSSETransactions(handlers: Handlers): void {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    const ctrl = new AbortController()
    streamTransactions({
      signal: ctrl.signal,
      onSnapshot(txns) {
        handlersRef.current.onSnapshot?.(txns)
      },
      onTransactionUpdate(updated) {
        handlersRef.current.onTransactionUpdate(updated)
      },
      onWalletUpdate(w) {
        handlersRef.current.onWalletUpdate(w)
      },
      onError(err) {
        handlersRef.current.onError?.(err)
      },
    })
    return () => ctrl.abort()
  }, [])
}
