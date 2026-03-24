import { useState, useCallback, useRef, useEffect } from "react"
import { ChevronLeft, ChevronRight, SendHorizonal } from "lucide-react"
import { walletService } from "@/features/wallet"
import { transferService, useSSETransactions, TransactionRow } from "@/features/transfer"
import type { Wallet } from "@/features/wallet"
import type { Transaction } from "@/features/transfer"
import { Button } from "@/shared/ui/primitives/button"
import { SendMoneyModal } from "@/features/transfer"

const PAGE_SIZE = 10

export default function TransactionsPage() {
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [txLoading, setTxLoading] = useState(true)
  const [showSend, setShowSend] = useState(false)
  const pageRef = useRef(page)
  pageRef.current = page

  const fetchPage = useCallback(async (p: number) => {
    setTxLoading(true)
    try {
      const result = await transferService.listTransfers({ limit: PAGE_SIZE, offset: p * PAGE_SIZE })
      setTransactions(result.data)
      setTotal(result.total)
    } finally {
      setTxLoading(false)
    }
  }, [])

  useEffect(() => {
    walletService.getWallet().then(setWallet).catch(() => { })
  }, [])

  useEffect(() => {
    fetchPage(0)
  }, [fetchPage])

  useSSETransactions({
    onTransactionUpdate(updated) {
      setTransactions((prev) => {
        const exists = prev.some((t) => t.id === updated.id)
        if (!exists) {
          if (pageRef.current === 0) {
            setTotal((n) => n + 1)
            return [updated, ...prev.slice(0, PAGE_SIZE - 1)]
          }
          return prev
        }
        return prev.map((t) => (t.id === updated.id ? updated : t))
      })
    },
    onWalletUpdate(w) {
      setWallet(w)
    },
    onError(err) {
      console.error("SSE error:", err)
    },
  })

  const goToPage = useCallback(
    (p: number) => {
      setPage(p)
      fetchPage(p)
    },
    [fetchPage],
  )

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white">Transactions</h1>
        <Button
          className="h-9 gap-2 rounded-full bg-white px-5 text-sm text-zinc-950 hover:bg-zinc-100"
          onClick={() => setShowSend(true)}
        >
          <SendHorizonal className="size-4" />
          Send money
        </Button>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-400">Recent transactions</span>
        {!txLoading && total > 0 && (
          <span className="text-xs text-zinc-600">{total} total</span>
        )}
      </div>

      {!txLoading && transactions.length === 0 && (
        <div className="rounded-2xl border border-white/5 py-16 text-center">
          <p className="text-sm text-zinc-600">No transactions yet.</p>
        </div>
      )}

      {transactions.length > 0 && (
        <div
          className={`overflow-hidden rounded-2xl border border-white/5 transition-opacity duration-150 ${txLoading ? "pointer-events-none opacity-50" : ""}`}
        >
          {transactions.map((txn, i) => (
            <TransactionRow
              key={txn.id}
              transaction={txn}
              walletId={wallet?.id ?? null}
              isLast={i === transactions.length - 1}
              showStatusBadge
            />
          ))}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="mt-4 flex justify-center">
          <div className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-white/4 p-1">
            <button
              type="button"
              onClick={() => goToPage(page - 1)}
              disabled={page === 0 || txLoading}
              className="flex size-7 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <span className="px-3 text-xs text-zinc-500">
              {page + 1} / {Math.ceil(total / PAGE_SIZE)}
            </span>
            <button
              type="button"
              onClick={() => goToPage(page + 1)}
              disabled={(page + 1) * PAGE_SIZE >= total || txLoading}
              className="flex size-7 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      {showSend && (
        <SendMoneyModal
          onClose={() => setShowSend(false)}
          onSuccess={() => fetchPage(page)}
          onFail={() => fetchPage(page)}
        />
      )}
    </div>
  )
}
