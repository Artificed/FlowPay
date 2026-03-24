import { useEffect, useState, useCallback, useRef } from "react"
import { Link } from "react-router-dom"
import { SendHorizonal, TrendingDown, TrendingUp, Download } from "lucide-react"
import { useAuth } from "@/features/auth"
import { walletService, WalletIDCopy } from "@/features/wallet"
import { transferService, useSSETransactions, TransactionRow, ActivityChart, getFilteredTransactions } from "@/features/transfer"
import type { Wallet } from "@/features/wallet"
import type { Transaction, FilterRange } from "@/features/transfer"
import { Button } from "@/shared/ui/primitives/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/primitives/select"
import { SendMoneyModal } from "@/features/transfer"
import { AddFundsModal } from "@/features/wallet"
import { formatAmount, getGreeting } from "@/shared/lib/formatting"

export default function HomePage() {
  const { user } = useAuth()
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCurrency, setActiveCurrency] = useState(0)
  const [showSend, setShowSend] = useState(false)
  const [showDeposit, setShowDeposit] = useState(false)
  const [filterRange, setFilterRange] = useState<FilterRange>("30d")
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const fetchData = useCallback(async () => {
    try {
      setError(null)
      const [w, txResult] = await Promise.all([
        walletService.getWallet(),
        transferService.listTransfers({ limit: 20, offset: 0 }),
      ])
      if (mountedRef.current) {
        setWallet(w)
        setTransactions(txResult.data)
      }
    } catch (err) {
      if (mountedRef.current)
        setError(err instanceof Error ? err.message : "Failed to load data")
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useSSETransactions({
    onTransactionUpdate(updated) {
      setTransactions((prev) => {
        const exists = prev.some((t) => t.id === updated.id)
        if (exists) return prev.map((t) => (t.id === updated.id ? updated : t))
        return [updated, ...prev.slice(0, 19)]
      })
    },
    onWalletUpdate(w) {
      setWallet(w)
    },
    onError(err) {
      console.error("SSE error:", err)
    },
  })

  const firstName = user?.display_name.split(" ")[0] ?? ""
  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })

  const activeBalance = wallet?.balances[activeCurrency]
  const activeCurrencyCode = activeBalance?.currency ?? "USD"

  const timFiltered = getFilteredTransactions(transactions, filterRange)
  const filteredTxns = timFiltered.filter((t) => t.currency === activeCurrencyCode)

  const moneyIn = filteredTxns.reduce((sum, t) => {
    if (t.type === "deposit") return sum + t.amount
    if (wallet && t.recipient_wallet_id === wallet.id) return sum + t.amount
    return sum
  }, 0)

  const moneyOut = filteredTxns.reduce((sum, t) => {
    if (t.type === "deposit") return sum
    if (wallet && t.sender_wallet_id === wallet.id) return sum + t.amount
    return sum
  }, 0)

  const recentTxns = transactions.slice(0, 5)

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="space-y-4">
          <div className="h-8 w-56 animate-pulse rounded-lg bg-white/5" />
          <div className="grid gap-5 lg:grid-cols-[1fr_272px]">
            <div className="h-72 animate-pulse rounded-2xl bg-white/5" />
            <div className="h-72 animate-pulse rounded-2xl bg-white/5" />
          </div>
          <div className="h-64 animate-pulse rounded-2xl bg-white/5" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10 text-center">
        <p className="text-sm text-red-400">{error}</p>
        <Button
          variant="outline"
          className="mt-4 h-9 rounded-full border-white/10 bg-white/5 px-5 text-sm text-white hover:bg-white/10"
          onClick={fetchData}
        >
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="space-y-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[1.6rem] font-semibold text-white">
              {getGreeting()}, {firstName}
            </h1>
            <p className="mt-1 text-sm text-zinc-400">{todayLabel}</p>
          </div>
          <div className="flex items-center gap-2 translate-y-2">
            <Select value={filterRange} onValueChange={(v) => setFilterRange(v as FilterRange)}>
              <SelectTrigger className="!h-9 rounded-full border-white/8 bg-white/4 px-4 text-sm text-zinc-400 hover:bg-white/8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">Today</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => {
              }}
              className="h-9 gap-1.5 rounded-full border-white/8 bg-white/4 px-4 text-zinc-400 hover:bg-white/8 hover:text-zinc-400"
            >
              <Download className="size-3.5" />
              Export
            </Button>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_272px]">
          {wallet ? (
            <ActivityChart transactions={transactions} walletId={wallet.id} filterRange={filterRange} />
          ) : (
            <div className="rounded-2xl border border-white/5 bg-white/3 p-5" />
          )}

          <div className="rounded-2xl border border-white/8 bg-gradient-to-br from-white/8 to-white/3 p-6 flex flex-col">
            <div className="pb-4">
              <p className="text-xs text-zinc-500">Available Balance</p>
              {activeBalance ? (
                <>
                  <p className="mt-1.5 bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-3xl font-semibold tracking-tighter text-transparent">
                    {formatAmount(activeBalance.available_amount, activeBalance.currency)}
                  </p>
                  {activeBalance.total_amount !== activeBalance.available_amount && (
                    <p className="mt-1 text-xs text-zinc-500">
                      {formatAmount(activeBalance.total_amount, activeBalance.currency)} total
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-1.5 text-3xl font-semibold tracking-tighter text-zinc-700">$0.00</p>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5">
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
            </div>

            <div className="border-t border-white/6 py-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <TrendingUp className="size-3 text-emerald-400" />
                  Money in
                </div>
                <span className="text-sm font-medium text-emerald-400">
                  +{formatAmount(moneyIn, activeCurrencyCode)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <TrendingDown className="size-3 text-zinc-500" />
                  Money out
                </div>
                <span className="text-sm font-medium text-zinc-300">
                  -{formatAmount(moneyOut, activeCurrencyCode)}
                </span>
              </div>
            </div>

            <div className="border-t border-white/6 pt-4 flex flex-col gap-2">
              <Button
                className="h-10 w-full gap-2 rounded-full bg-white text-zinc-950 hover:bg-zinc-100"
                onClick={() => setShowSend(true)}
              >
                <SendHorizonal className="size-4" />
                Send money
              </Button>
              <Button
                variant="outline"
                className="h-10 w-full gap-2 rounded-full border-white/10 bg-white/5 text-white hover:bg-white/10"
                onClick={() => setShowDeposit(true)}
              >
                Add funds
              </Button>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-400">Recent transactions</span>
            <Link
              to="/app/transactions"
              className="text-xs text-zinc-600 transition-colors hover:text-zinc-400"
            >
              View all →
            </Link>
          </div>

          {recentTxns.length === 0 ? (
            <div className="rounded-2xl border border-white/5 py-12 text-center">
              <p className="text-sm text-zinc-600">No transactions yet.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-white/5">
              {recentTxns.map((txn, i) => (
                <TransactionRow
                  key={txn.id}
                  transaction={txn}
                  walletId={wallet?.id ?? null}
                  isLast={i === recentTxns.length - 1}
                />
              ))}
            </div>
          )}

          {wallet && (
            <div className="mt-3 flex items-center gap-1.5 px-1 text-xs text-zinc-600">
              <span>Wallet ID</span>
              <WalletIDCopy id={wallet.id} />
            </div>
          )}
        </div>
      </div>

      {showSend && (
        <SendMoneyModal onClose={() => setShowSend(false)} onSuccess={fetchData} onFail={() => { }} />
      )}
      {showDeposit && (
        <AddFundsModal onClose={() => setShowDeposit(false)} onSuccess={fetchData} />
      )}
    </div>
  )
}
