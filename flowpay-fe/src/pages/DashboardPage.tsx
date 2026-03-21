import { useEffect, useState, useCallback, useRef } from "react"
import { ArrowUpRight, ArrowDownLeft, PlusCircle, Copy, Check, Zap, SendHorizonal, ChevronLeft, ChevronRight } from "lucide-react"
import { useAuth } from "@/providers/AuthProvider"
import { walletService } from "@/features/wallet"
import { transferService, streamTransactions } from "@/features/transfer"
import type { Wallet } from "@/features/wallet"
import type { Transaction } from "@/features/transfer"
import { Button } from "@/components/ui/button"
import SendMoneyModal from "@/features/transfer/SendMoneyModal"
import AddFundsModal from "@/features/wallet/AddFundsModal"

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount / 100)
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 18) return "Good afternoon"
  return "Good evening"
}

const statusStyles: Record<string, string> = {
  completed: "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20",
  pending: "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20",
  processing: "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20",
  failed: "bg-red-500/10 text-red-400 ring-1 ring-red-500/20",
  reversed: "bg-zinc-500/10 text-zinc-400 ring-1 ring-zinc-500/20",
}

function WalletIDCopy({ id }: { id: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    await navigator.clipboard.writeText(id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      className="group flex items-center gap-1.5 rounded-full border border-white/8 bg-white/4 px-3 py-1 transition-colors hover:bg-white/8"
    >
      <span className="font-mono text-[11px] text-zinc-500">
        {id.slice(0, 8)}…{id.slice(-4)}
      </span>
      {copied ? (
        <Check className="size-3 text-emerald-400" />
      ) : (
        <Copy className="size-3 text-zinc-600 transition-colors group-hover:text-zinc-400" />
      )}
    </button>
  )
}

const PAGE_SIZE = 10

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [txLoading, setTxLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCurrency, setActiveCurrency] = useState(0)
  const [showSend, setShowSend] = useState(false)
  const [showDeposit, setShowDeposit] = useState(false)
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
    walletService
      .getWallet()
      .then(setWallet)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load wallet"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchPage(0)
  }, [fetchPage])

  useEffect(() => {
    const ctrl = new AbortController()
    streamTransactions({
      signal: ctrl.signal,
      onSnapshot() {
      },
      onTransactionUpdate(updated) {
        setTransactions((prev) => {
          const exists = prev.some((t) => t.id === updated.id)
          if (!exists) {
            // New transaction arrived — only prepend on page 0
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

  const goToPage = useCallback((p: number) => {
    setPage(p)
    fetchPage(p)
  }, [fetchPage])

  const reload = useCallback(async () => {
    try {
      setError(null)
      const [w] = await Promise.all([walletService.getWallet()])
      setWallet(w)
      setPage(0)
      await fetchPage(0)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard")
    }
  }, [fetchPage])

  const activeBalance = wallet?.balances[activeCurrency]

  return (
    <div className="relative min-h-svh bg-zinc-950">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)`,
          backgroundSize: "28px 28px",
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[500px]"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99,102,241,0.18) 0%, transparent 70%)",
        }}
      />

      <header className="relative z-10 border-b border-white/5">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-lg bg-white">
              <Zap className="size-4 fill-zinc-950 text-zinc-950" />
            </div>
            <span className="font-semibold tracking-tight text-white">FlowPay</span>
          </div>
          <button
            onClick={logout}
            className="text-sm text-zinc-500 transition-colors hover:text-zinc-300"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-6">
        <section className="py-16 text-center">
          <p className="text-sm text-zinc-500">
            {getGreeting()}, {user?.display_name.split(" ")[0]}
          </p>

          {error ? (
            <div className="mt-6 flex flex-col items-center gap-3">
              <p className="text-sm text-red-400">{error}</p>
              <Button
                variant="outline"
                className="h-9 rounded-full border-white/10 bg-white/5 px-5 text-sm text-white hover:bg-white/10"
                onClick={reload}
              >
                Retry
              </Button>
            </div>
          ) : loading ? (
            <div className="mt-4 flex flex-col items-center gap-3">
              <div className="h-16 w-64 animate-pulse rounded-xl bg-white/5" />
              <div className="h-4 w-32 animate-pulse rounded-lg bg-white/5" />
            </div>
          ) : activeBalance ? (
            <>
              <p className="mt-3 bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-6xl font-semibold tracking-tighter text-transparent sm:text-7xl">
                {formatAmount(activeBalance.available_amount, activeBalance.currency)}
              </p>
              {activeBalance.total_amount !== activeBalance.available_amount && (
                <p className="mt-2 text-sm text-zinc-600">
                  {formatAmount(activeBalance.total_amount, activeBalance.currency)} total
                </p>
              )}
            </>
          ) : (
            <p className="mt-4 text-5xl font-semibold tracking-tighter text-zinc-700">
              $0.00
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {wallet?.balances.map((b, i) => (
              <button
                key={b.id}
                onClick={() => setActiveCurrency(i)}
                className={`rounded-full px-3.5 py-1 text-xs font-medium transition-all ${i === activeCurrency
                  ? "bg-white text-zinc-950"
                  : "border border-white/8 bg-white/4 text-zinc-400 hover:bg-white/8"
                  }`}
              >
                {b.currency}
              </button>
            ))}
          </div>

          <div className="mt-8 flex flex-col items-center gap-3">
            <div className="flex gap-2">
              <Button
                className="h-10 gap-2 rounded-full bg-white px-6 text-zinc-950 hover:bg-zinc-100"
                onClick={() => setShowSend(true)}
              >
                <SendHorizonal className="size-4" />
                Send money
              </Button>
              <Button
                variant="outline"
                className="h-10 gap-2 rounded-full border-white/10 bg-white/5 px-6 text-white hover:bg-white/10"
                onClick={() => setShowDeposit(true)}
              >
                Add funds
              </Button>
            </div>
            {wallet && (
              <div className="flex items-center gap-1.5 text-xs text-zinc-600">
                <span>Wallet ID</span>
                <WalletIDCopy id={wallet.id} />
              </div>
            )}
          </div>
        </section>

        <section className="pb-16">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-400">Recent transactions</h2>
            {!txLoading && total > 0 && (
              <span className="text-xs text-zinc-600">{total} total</span>
            )}
          </div>

          {txLoading && (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/4" />
              ))}
            </div>
          )}

          {!txLoading && transactions.length === 0 && (
            <div className="rounded-2xl border border-white/5 py-16 text-center">
              <p className="text-sm text-zinc-600">No transactions yet.</p>
            </div>
          )}

          {!txLoading && transactions.length > 0 && (
            <>
              <div className="overflow-hidden rounded-2xl border border-white/5">
                {transactions.map((txn, i) => {
                  const isDeposit = txn.type === "deposit"
                  const isOutgoing = !isDeposit && wallet != null && txn.sender_wallet_id === wallet.id
                  return (
                    <div
                      key={txn.id}
                      className={`flex items-center gap-4 px-5 py-4 transition-colors hover:bg-white/3 ${i !== transactions.length - 1 ? "border-b border-white/5" : ""
                        }`}
                    >
                      <div
                        className={`flex size-9 shrink-0 items-center justify-center rounded-full ${isDeposit
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
                          {isDeposit ? (txn.note || "Deposit") : (txn.note || txn.reference_code)}
                        </p>
                        <p className="mt-0.5 font-mono text-xs text-zinc-600">
                          {txn.reference_code}
                        </p>
                      </div>

                      <div className="text-right">
                        <p
                          className={`text-sm font-medium ${isOutgoing ? "text-zinc-300" : "text-emerald-400"
                            }`}
                        >
                          {isOutgoing ? "−" : "+"}
                          {formatAmount(txn.amount, txn.currency)}
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-600">{formatDate(txn.created_at)}</p>
                      </div>

                      <span
                        className={`hidden shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium sm:block ${statusStyles[txn.status] ?? statusStyles.pending
                          }`}
                      >
                        {txn.status}
                      </span>
                    </div>
                  )
                })}
              </div>

              {total > PAGE_SIZE && (
                <div className="mt-4 flex justify-center">
                  <div className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-white/4 p-1">
                    <button
                      onClick={() => goToPage(page - 1)}
                      disabled={page === 0}
                      className="flex size-7 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ChevronLeft className="size-3.5" />
                    </button>
                    <span className="px-3 text-xs text-zinc-500">
                      {page + 1} / {Math.ceil(total / PAGE_SIZE)}
                    </span>
                    <button
                      onClick={() => goToPage(page + 1)}
                      disabled={(page + 1) * PAGE_SIZE >= total}
                      className="flex size-7 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ChevronRight className="size-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </main>

      {showSend && (
        <SendMoneyModal onClose={() => setShowSend(false)} onSuccess={reload} onFail={() => fetchPage(page)} />
      )}
      {showDeposit && (
        <AddFundsModal onClose={() => setShowDeposit(false)} onSuccess={reload} />
      )}
    </div>
  )
}
