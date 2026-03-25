import { useState, useCallback, useRef, useEffect } from "react"
import { ChevronLeft, ChevronRight, SendHorizonal, ArrowDownLeft, ArrowUpRight, PlusCircle, Search, X } from "lucide-react"
import { walletService } from "@/features/wallet"
import { transferService, useSSETransactions, TransactionRow, TransactionDetailModal } from "@/features/transfer"
import type { Wallet } from "@/features/wallet"
import type { Transaction } from "@/features/transfer"
import { Button } from "@/shared/ui/primitives/button"
import { SendMoneyModal } from "@/features/transfer"

const PAGE_SIZE = 10

type TypeFilter = "all" | "received" | "sent" | "deposit"

const TYPE_FILTERS: { value: TypeFilter; label: string; icon: React.ReactNode }[] = [
  { value: "all", label: "All", icon: null },
  { value: "received", label: "Received", icon: <ArrowDownLeft className="size-3" /> },
  { value: "sent", label: "Sent", icon: <ArrowUpRight className="size-3" /> },
  { value: "deposit", label: "Deposits", icon: <PlusCircle className="size-3" /> },
]

function groupByDate(txns: Transaction[]): { label: string; items: Transaction[] }[] {
  const groups = new Map<string, Transaction[]>()
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterday = today - 86400000

  for (const txn of txns) {
    const d = new Date(txn.created_at)
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

    let label: string
    if (dayStart === today) {
      label = "Today"
    } else if (dayStart === yesterday) {
      label = "Yesterday"
    } else {
      label = new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(d)
    }

    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)!.push(txn)
  }

  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }))
}

export default function TransactionsPage() {
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [txLoading, setTxLoading] = useState(true)
  const [showSend, setShowSend] = useState(false)
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all")
  const [search, setSearch] = useState("")
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

  const filtered = transactions.filter((txn) => {
    const matchesType =
      typeFilter === "all"
        ? true
        : typeFilter === "deposit"
          ? txn.type === "deposit"
          : typeFilter === "sent"
            ? txn.type !== "deposit" && wallet != null && txn.sender_wallet_id === wallet.id
            : txn.type !== "deposit" && wallet != null && txn.recipient_wallet_id === wallet.id

    const q = search.trim().toLowerCase()
    const matchesSearch =
      q === "" ||
      txn.reference_code.toLowerCase().includes(q) ||
      (txn.note?.toLowerCase().includes(q) ?? false)

    return matchesType && matchesSearch
  })

  const groups = groupByDate(filtered)
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const isEmpty = !txLoading && filtered.length === 0

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-7">
        <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-gradient-to-br from-white/7 to-white/2 px-8 py-5">
          <div className="pointer-events-none absolute -left-12 -top-12 size-48 rounded-full bg-violet-500/8 blur-3xl" />
          <div className="pointer-events-none absolute -right-8 -bottom-8 size-36 rounded-full bg-indigo-500/6 blur-3xl" />

          <div className="relative flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-[1.4rem] font-semibold text-white">Transactions</h1>
              <p className="mt-0.5 text-sm text-zinc-500">
                {total > 0 ? (
                  <>
                    <span className="text-zinc-300 font-medium">{total.toLocaleString()}</span>
                    {" "}transaction{total !== 1 ? "s" : ""} in total
                  </>
                ) : (
                  "Your complete payment history"
                )}
              </p>
            </div>
            <Button
              className="h-9 gap-2 rounded-full bg-white px-5 text-sm text-zinc-950 hover:bg-zinc-100"
              onClick={() => setShowSend(true)}
            >
              <SendHorizonal className="size-4" />
              Send money
            </Button>
          </div>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-full border border-white/8 bg-white/3 p-1">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${typeFilter === f.value
                ? "bg-white text-zinc-950 shadow-sm"
                : "text-zinc-500 hover:text-zinc-300"
                }`}
            >
              {f.icon}
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-zinc-600 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by note or reference…"
            className="h-9 w-full rounded-full border border-white/8 bg-white/3 pl-8 pr-8 text-xs text-zinc-300 placeholder:text-zinc-600 outline-none focus:border-white/15 focus:bg-white/5 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 flex size-4 items-center justify-center rounded-full text-zinc-600 hover:text-zinc-300 transition-colors"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      </div>

      {txLoading && (
        <div className="space-y-px overflow-hidden rounded-2xl border border-white/5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-white/5 last:border-0">
              <div className="size-9 rounded-full bg-white/5 animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-40 rounded-full bg-white/5 animate-pulse" />
                <div className="h-2.5 w-24 rounded-full bg-white/5 animate-pulse" />
              </div>
              <div className="space-y-2 text-right">
                <div className="h-3 w-16 rounded-full bg-white/5 animate-pulse ml-auto" />
                <div className="h-2.5 w-12 rounded-full bg-white/5 animate-pulse ml-auto" />
              </div>
            </div>
          ))}
        </div>
      )}

      {isEmpty && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/[0.02] py-20 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl border border-white/8 bg-white/5 mb-4">
            <ArrowDownLeft className="size-6 text-zinc-600" />
          </div>
          <p className="text-sm font-medium text-zinc-400">
            {search || typeFilter !== "all" ? "No matching transactions" : "No transactions yet"}
          </p>
          <p className="mt-1.5 text-xs text-zinc-600">
            {search || typeFilter !== "all"
              ? "Try adjusting your search or filters"
              : "Send money to get started"}
          </p>
          {!search && typeFilter === "all" && (
            <button
              onClick={() => setShowSend(true)}
              className="mt-5 rounded-full bg-white px-5 py-2 text-xs font-medium text-zinc-950 hover:bg-zinc-100 transition-colors"
            >
              Send your first payment →
            </button>
          )}
        </div>
      )}

      {!txLoading && filtered.length > 0 && (
        <div
          className={`space-y-5 transition-opacity duration-150 ${txLoading ? "pointer-events-none opacity-50" : ""}`}
        >
          {groups.map((group) => (
            <div key={group.label}>
              <div className="mb-2 flex items-center gap-3">
                <span className="text-[11px] font-medium uppercase tracking-widest text-zinc-600">
                  {group.label}
                </span>
                <div className="flex-1 h-px bg-white/5" />
              </div>

              <div className="overflow-hidden rounded-2xl border border-white/5">
                {group.items.map((txn, i) => (
                  <TransactionRow
                    key={txn.id}
                    transaction={txn}
                    walletId={wallet?.id ?? null}
                    isLast={i === group.items.length - 1}
                    showStatusBadge
                    onClick={setSelectedTxn}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {total > PAGE_SIZE && !txLoading && (
        <div className="mt-6 flex justify-center">
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
              {page + 1} / {totalPages}
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

      {selectedTxn && (
        <TransactionDetailModal
          transaction={selectedTxn}
          walletId={wallet?.id ?? null}
          onClose={() => setSelectedTxn(null)}
        />
      )}
    </div>
  )
}
