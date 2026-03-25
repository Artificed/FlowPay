import { useEffect, useState, useCallback } from "react"
import { CalendarClock, Plus, ChevronLeft, ChevronRight } from "lucide-react"
import { scheduledPaymentService, CreateScheduledModal, PaymentRow } from "@/features/scheduled"
import type { ScheduledPayment } from "@/features/scheduled"
import { Button } from "@/shared/ui/primitives/button"
import { formatAmount } from "@/shared/lib/formatting"

const CANCELLED_PAGE_SIZE = 10

export default function ScheduledPage() {
  const [active, setActive] = useState<ScheduledPayment[]>([])
  const [cancelled, setCancelled] = useState<ScheduledPayment[]>([])
  const [cancelledTotal, setCancelledTotal] = useState(0)
  const [cancelledPage, setCancelledPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [cancelledLoading, setCancelledLoading] = useState(false)
  const [cancelledFetched, setCancelledFetched] = useState(false)
  const [filter, setFilter] = useState<"active" | "cancelled">("active")
  const [showCreate, setShowCreate] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const fetchActive = useCallback(async () => {
    const result = await scheduledPaymentService.list({ status: "active" })
    setActive(result.data)
  }, [])

  const fetchCancelled = useCallback(async (page: number) => {
    setCancelledLoading(true)
    try {
      const result = await scheduledPaymentService.list({
        status: "cancelled",
        limit: CANCELLED_PAGE_SIZE,
        offset: page * CANCELLED_PAGE_SIZE,
      })
      setCancelled(result.data)
      setCancelledTotal(result.total)
      setCancelledFetched(true)
    } finally {
      setCancelledLoading(false)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchActive().finally(() => setLoading(false))
  }, [fetchActive])

  function handleFilterChange(f: "active" | "cancelled") {
    setFilter(f)
    if (f === "cancelled" && !cancelledFetched) {
      fetchCancelled(0)
    }
  }

  async function handleCancel(id: string) {
    setCancellingId(id)
    try {
      await scheduledPaymentService.cancel(id)
      await fetchActive()
      setCancelledFetched(false)
      if (filter === "cancelled") fetchCancelled(cancelledPage)
    } catch {
    } finally {
      setCancellingId(null)
    }
  }

  function goToCancelledPage(page: number) {
    setCancelledPage(page)
    fetchCancelled(page)
  }

  const activeCount = active.length
  const monthlyCurrencyTotals = active.reduce<Record<string, number>>((acc, p) => {
    acc[p.currency] = (acc[p.currency] ?? 0) + Math.round((p.amount / p.interval_days) * 30)
    return acc
  }, {})
  const [dominantCurrency, monthlyTotal] = Object.entries(monthlyCurrencyTotals).sort(([, a], [, b]) => b - a)[0] ?? ["USD", 0]
  const nextPayment = active.map(p => new Date(p.next_run_at)).sort((a, b) => a.getTime() - b.getTime())[0] ?? null

  const cancelledTotalPages = Math.ceil(cancelledTotal / CANCELLED_PAGE_SIZE)

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 flex flex-col gap-8">
      <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-gradient-to-br from-white/7 to-white/2 px-8 py-5">
        <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 right-32 size-32 rounded-full bg-indigo-500/8 blur-3xl" />

        <div className="relative flex items-center justify-between">
          <div>
            <h1 className="text-[1.4rem] font-semibold text-white">Scheduled Payments</h1>
            <p className="mt-0.5 text-sm text-zinc-500">
              {activeCount > 0
                ? `${activeCount} active ${activeCount === 1 ? "payment" : "payments"}`
                : "Automate your recurring transfers"}
            </p>
          </div>
          <Button
            className="h-9 gap-2 rounded-full bg-white px-5 text-sm text-zinc-950 hover:bg-zinc-100"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="size-4" />
            Schedule payment
          </Button>
        </div>

        {activeCount > 0 && (
          <>
            <div className="relative mt-5 border-t border-white/6" />
            <div className="relative mt-5 grid grid-cols-3 gap-6">
              <div>
                <p className="text-xs text-zinc-500">Active</p>
                <p className="mt-1 bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-2xl font-semibold text-transparent">
                  {activeCount}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Est. Monthly</p>
                <p className="mt-1 bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-2xl font-semibold text-transparent">
                  {formatAmount(monthlyTotal, dominantCurrency)}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Next Payment</p>
                <p className="mt-1 bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-2xl font-semibold text-transparent">
                  {nextPayment
                    ? nextPayment.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                    : "—"}
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/4" />
          ))}
        </div>
      ) : activeCount === 0 && filter === "active" && !cancelledFetched ? (
        <div className="rounded-2xl border border-white/5 py-16 text-center">
          <CalendarClock className="mx-auto mb-3 size-8 text-zinc-700" />
          <p className="text-sm text-zinc-500">No scheduled payments yet.</p>
          <p className="mt-1 text-xs text-zinc-600">
            Schedule a recurring transfer and it will run automatically.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-5 rounded-full bg-white px-5 py-2 text-xs font-medium text-zinc-950 transition-colors hover:bg-zinc-100"
          >
            Schedule your first payment →
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-2">
            {(["active", "cancelled"] as const).map((f) => (
              <button
                key={f}
                onClick={() => handleFilterChange(f)}
                className={`rounded-full px-4 py-1.5 text-xs font-medium capitalize transition-colors ${
                  filter === f
                    ? "bg-white text-zinc-950"
                    : "bg-white/5 text-zinc-400 hover:bg-white/8 hover:text-zinc-300"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {filter === "active" ? (
            active.length === 0 ? (
              <div className="rounded-2xl border border-white/5 py-12 text-center">
                <CalendarClock className="mx-auto mb-3 size-8 text-zinc-700" />
                <p className="text-sm text-zinc-500">No active payments.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-white/5">
                {active.map((p, i) => (
                  <PaymentRow
                    key={p.id}
                    payment={p}
                    isLast={i === active.length - 1}
                    cancelling={cancellingId === p.id}
                    onCancel={() => handleCancel(p.id)}
                  />
                ))}
              </div>
            )
          ) : (
            <>
              {cancelledLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/4" />
                  ))}
                </div>
              ) : cancelled.length === 0 ? (
                <div className="rounded-2xl border border-white/5 py-12 text-center">
                  <CalendarClock className="mx-auto mb-3 size-8 text-zinc-700" />
                  <p className="text-sm text-zinc-500">No cancelled payments.</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-white/5">
                  {cancelled.map((p, i) => (
                    <PaymentRow
                      key={p.id}
                      payment={p}
                      isLast={i === cancelled.length - 1}
                      cancelling={false}
                      onCancel={() => {}}
                    />
                  ))}
                </div>
              )}

              {cancelledTotal > CANCELLED_PAGE_SIZE && (
                <div className="flex justify-center">
                  <div className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-white/4 p-1">
                    <button
                      type="button"
                      onClick={() => goToCancelledPage(cancelledPage - 1)}
                      disabled={cancelledPage === 0 || cancelledLoading}
                      className="flex size-7 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ChevronLeft className="size-3.5" />
                    </button>
                    <span className="px-3 text-xs text-zinc-500">
                      {cancelledPage + 1} / {cancelledTotalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => goToCancelledPage(cancelledPage + 1)}
                      disabled={(cancelledPage + 1) * CANCELLED_PAGE_SIZE >= cancelledTotal || cancelledLoading}
                      className="flex size-7 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ChevronRight className="size-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {showCreate && (
        <CreateScheduledModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            fetchActive()
            setCancelledFetched(false)
          }}
        />
      )}
    </div>
  )
}
