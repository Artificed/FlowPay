import { useEffect, useState, useCallback, useRef } from "react"
import { ArrowUpRight, ArrowDownLeft, PlusCircle, ChevronLeft, ChevronRight, SendHorizonal } from "lucide-react"
import { walletService } from "@/features/wallet"
import { transferService, streamTransactions } from "@/features/transfer"
import type { Wallet } from "@/features/wallet"
import type { Transaction } from "@/features/transfer"
import { Button } from "@/components/ui/button"
import SendMoneyModal from "@/features/transfer/SendMoneyModal"
import { formatAmount, formatDate, statusStyles } from "@/lib/formatting"

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
    walletService.getWallet().then(setWallet).catch(() => {})
  }, [])

  useEffect(() => {
    fetchPage(0)
  }, [fetchPage])

  useEffect(() => {
    const ctrl = new AbortController()
    streamTransactions({
      signal: ctrl.signal,
      onSnapshot() {},
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
    return () => ctrl.abort()
  }, [])

  const goToPage = useCallback(
    (p: number) => {
      setPage(p)
      fetchPage(p)
    },
    [fetchPage],
  )

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
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
          className={`overflow-hidden rounded-2xl border border-white/5 transition-opacity duration-150 ${
            txLoading ? "pointer-events-none opacity-50" : ""
          }`}
        >
          {transactions.map((txn, i) => {
            const isDeposit = txn.type === "deposit"
            const isOutgoing = !isDeposit && wallet != null && txn.sender_wallet_id === wallet.id
            return (
              <div
                key={txn.id}
                className={`flex items-center gap-4 px-5 py-4 transition-colors hover:bg-white/3 ${
                  i !== transactions.length - 1 ? "border-b border-white/5" : ""
                }`}
              >
                <div
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                    isDeposit
                      ? "bg-indigo-500/10 text-indigo-400"
                      : isOutgoing
                        ? "bg-zinc-800 text-zinc-400"
                        : "bg-emerald-500/10 text-emerald-400"
                  }`}
                >
                  {isDeposit ? (
                    <PlusCircle className="size-4" />
                  ) : isOutgoing ? (
                    <ArrowUpRight className="size-4" />
                  ) : (
                    <ArrowDownLeft className="size-4" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white">
                    {isDeposit ? txn.note || "Deposit" : txn.note || txn.reference_code}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-zinc-600">{txn.reference_code}</p>
                </div>

                <div className="text-right">
                  <p
                    className={`text-sm font-medium ${
                      isOutgoing ? "text-zinc-300" : "text-emerald-400"
                    }`}
                  >
                    {isOutgoing ? "−" : "+"}
                    {formatAmount(txn.amount, txn.currency)}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-600">{formatDate(txn.created_at)}</p>
                </div>

                <span
                  className={`hidden shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium sm:block ${
                    statusStyles[txn.status] ?? statusStyles.pending
                  }`}
                >
                  {txn.status}
                </span>
              </div>
            )
          })}
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
