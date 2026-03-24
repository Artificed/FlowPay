import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from "recharts"
import type { Transaction, FilterRange, ChartPoint } from "../types"
import { getFilteredTransactions } from "../lib/selectors"

function buildChartData(transactions: Transaction[], walletId: string, filterRange: FilterRange, currency: string): ChartPoint[] {
  const now = new Date()

  if (filterRange === "1d") {
    const slots: Record<number, ChartPoint> = {}
    for (let h = 0; h < 24; h += 2) {
      const label = h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`
      slots[h] = { date: label, inflow: 0, outflow: 0 }
    }
    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)
    for (const txn of transactions.filter((t) => t.currency === currency)) {
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

  for (const txn of transactions.filter((t) => t.currency === currency)) {
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

type Props = {
  transactions: Transaction[]
  walletId: string
  filterRange: FilterRange
  currency: string
}

export function ActivityChart({ transactions, walletId, filterRange, currency }: Props) {
  const filtered = getFilteredTransactions(transactions, filterRange)
  const chartData = buildChartData(filtered, walletId, filterRange, currency)
  const chartXAxisInterval = filterRange === "1d" ? 1 : filterRange === "7d" ? 0 : 4

  return (
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
  )
}
