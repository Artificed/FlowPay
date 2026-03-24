import { useEffect, useState, useCallback, useRef } from "react"
import { Link } from "react-router-dom"
import {
  SendHorizonal,
  Copy,
  Check,
  ArrowDownLeft,
  ArrowUpRight,
  PlusCircle,
  TrendingDown,
  TrendingUp,
  Download,
} from "lucide-react"
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from "recharts"
import { useAuth } from "@/providers/AuthProvider"
import { walletService } from "@/features/wallet"
import { transferService, streamTransactions } from "@/features/transfer"
import type { Wallet } from "@/features/wallet"
import type { Transaction } from "@/features/transfer"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import SendMoneyModal from "@/features/transfer/SendMoneyModal"
import AddFundsModal from "@/features/wallet/AddFundsModal"
import { formatAmount, formatDate, getGreeting } from "@/lib/formatting"

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

type FilterRange = "1d" | "7d" | "30d" | "all"

type ChartPoint = { date: string; inflow: number; outflow: number }

function getFilteredTransactions(transactions: Transaction[], filterRange: FilterRange): Transaction[] {
  if (filterRange === "all") return transactions
  const now = new Date()
  const cutoff = new Date(now)
  if (filterRange === "1d") {
    cutoff.setHours(0, 0, 0, 0)
  } else if (filterRange === "7d") {
    cutoff.setDate(cutoff.getDate() - 7)
  } else {
    cutoff.setDate(cutoff.getDate() - 30)
  }
  return transactions.filter((t) => new Date(t.created_at) >= cutoff)
}

function buildChartData(transactions: Transaction[], walletId: string, filterRange: FilterRange): ChartPoint[] {
  const now = new Date()

  if (filterRange === "1d") {
    const slots: Record<number, ChartPoint> = {}
    for (let h = 0; h < 24; h += 2) {
      const label = h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`
      slots[h] = { date: label, inflow: 0, outflow: 0 }
    }
    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)
    for (const txn of transactions) {
      const d = new Date(txn.created_at)
      if (d < startOfToday) continue
      const slotHour = Math.floor(d.getHours() / 2) * 2
      if (!(slotHour in slots)) continue
      const isDeposit = txn.type === "deposit"
      const isOutgoing = !isDeposit && txn.sender_wallet_id === walletId
      if (isOutgoing) {
        slots[slotHour].outflow += txn.amount / 100
      } else {
        slots[slotHour].inflow += txn.amount / 100
      }
    }
    return Object.values(slots)
  }

  const numDays = filterRange === "7d" ? 7 : 30
  const days: Record<string, ChartPoint> = {}
  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    days[label] = { date: label, inflow: 0, outflow: 0 }
  }

  for (const txn of transactions) {
    const d = new Date(txn.created_at)
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    if (!(label in days)) continue
    const isDeposit = txn.type === "deposit"
    const isOutgoing = !isDeposit && txn.sender_wallet_id === walletId
    if (isOutgoing) {
      days[label].outflow += txn.amount / 100
    } else {
      days[label].inflow += txn.amount / 100
    }
  }

  return Object.values(days)
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number; name: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-white/8 bg-zinc-900 px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 text-zinc-500">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className={p.name === "inflow" ? "text-emerald-400" : "text-zinc-400"}>
          {p.name === "inflow" ? "In" : "Out"}: ${p.value.toFixed(2)}
        </p>
      ))}
    </div>
  )
}

const CHART_LABELS: Record<FilterRange, string> = {
  "1d": "today",
  "7d": "last 7 days",
  "30d": "last 30 days",
  all: "all time",
}

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

  useEffect(() => {
    const ctrl = new AbortController()
    streamTransactions({
      signal: ctrl.signal,
      onSnapshot() { },
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
    return () => ctrl.abort()
  }, [])

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
  const chartData = wallet ? buildChartData(timFiltered, wallet.id, filterRange) : []
  const chartXAxisInterval = filterRange === "1d" ? 1 : filterRange === "7d" ? 0 : 4

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
                /* TODO: export transactions as CSV */
              }}
              className="h-9 gap-1.5 rounded-full border-white/8 bg-white/4 px-4 text-zinc-400 hover:bg-white/8 hover:text-zinc-400"
            >
              <Download className="size-3.5" />
              Export
            </Button>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_272px]">
          <div className="rounded-2xl border border-white/5 bg-white/3 p-5">
            <p className="mb-4 text-xs font-medium text-zinc-400">
              Activity — {CHART_LABELS[filterRange]}
            </p>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#71717a" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#71717a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#52525b", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval={chartXAxisInterval}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="outflow"
                  stroke="#71717a"
                  strokeWidth={1.5}
                  fill="url(#outflowGrad)"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="inflow"
                  stroke="#34d399"
                  strokeWidth={1.5}
                  fill="url(#inflowGrad)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

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
              {recentTxns.map((txn, i) => {
                const isDeposit = txn.type === "deposit"
                const isOutgoing = !isDeposit && wallet != null && txn.sender_wallet_id === wallet.id
                return (
                  <div
                    key={txn.id}
                    className={`flex items-center gap-4 px-5 py-4 transition-colors hover:bg-white/3 ${i !== recentTxns.length - 1 ? "border-b border-white/5" : ""
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
                        {isDeposit ? txn.note || "Deposit" : txn.note || txn.reference_code}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-zinc-600">{txn.reference_code}</p>
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
                  </div>
                )
              })}
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
