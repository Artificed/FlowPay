import { useEffect, useState, useCallback } from "react"
import { CalendarClock, Plus, Trash2, RefreshCw } from "lucide-react"
import { scheduledPaymentService } from "@/features/scheduled/services"
import type { ScheduledPayment } from "@/features/scheduled/types"
import CreateScheduledModal from "@/features/scheduled/create-scheduled-modal"
import { Button } from "@/components/ui/button"
import { formatAmount, formatDate } from "@/lib/formatting"
import { Badge } from "@/components/ui/badge"

export default function ScheduledPage() {
  const [payments, setPayments] = useState<ScheduledPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    try {
      const data = await scheduledPaymentService.list()
      setPayments(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPayments()
  }, [fetchPayments])

  async function handleCancel(id: string) {
    setCancellingId(id)
    try {
      await scheduledPaymentService.cancel(id)
      setPayments((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: "cancelled" } : p)),
      )
    } catch {
    } finally {
      setCancellingId(null)
    }
  }

  const active = payments.filter((p) => p.status === "active")
  const cancelled = payments.filter((p) => p.status === "cancelled")

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white">Scheduled Payments</h1>
        <Button
          className="h-9 gap-2 rounded-full bg-white px-5 text-sm text-zinc-950 hover:bg-zinc-100"
          onClick={() => setShowCreate(true)}
        >
          <Plus className="size-4" />
          Schedule payment
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/4" />
          ))}
        </div>
      ) : payments.length === 0 ? (
        <div className="rounded-2xl border border-white/5 py-16 text-center">
          <CalendarClock className="mx-auto mb-3 size-8 text-zinc-700" />
          <p className="text-sm text-zinc-500">No scheduled payments yet.</p>
          <p className="mt-1 text-xs text-zinc-600">
            Schedule a recurring transfer and it will run automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <section>
              <p className="mb-3 text-sm font-medium text-zinc-400">Active</p>
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
            </section>
          )}

          {cancelled.length > 0 && (
            <section>
              <p className="mb-3 text-sm font-medium text-zinc-400">Cancelled</p>
              <div className="overflow-hidden rounded-2xl border border-white/5">
                {cancelled.map((p, i) => (
                  <PaymentRow
                    key={p.id}
                    payment={p}
                    isLast={i === cancelled.length - 1}
                    cancelling={false}
                    onCancel={() => { }}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {showCreate && (
        <CreateScheduledModal
          onClose={() => setShowCreate(false)}
          onSuccess={fetchPayments}
        />
      )}
    </div>
  )
}

type RowProps = {
  payment: ScheduledPayment
  isLast: boolean
  cancelling: boolean
  onCancel: () => void
}

function PaymentRow({ payment, isLast, cancelling, onCancel }: RowProps) {
  const isActive = payment.status === "active"

  return (
    <div
      className={`flex items-center gap-4 px-5 py-4 transition-colors hover:bg-white/3 ${!isLast ? "border-b border-white/5" : ""
        }`}
    >
      <div
        className={`flex size-9 shrink-0 items-center justify-center rounded-full ${isActive ? "bg-violet-500/10 text-violet-400" : "bg-zinc-800 text-zinc-600"
          }`}
      >
        <RefreshCw className="size-4" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-white">
          {payment.note || formatAmount(payment.amount, payment.currency)}
        </p>
        <p className="mt-0.5 font-mono text-xs text-zinc-600 truncate">
          → {payment.recipient_wallet_id}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-xs text-zinc-500">
            Every {payment.interval_days} {payment.interval_days === 1 ? "day" : "days"}
          </span>
          {isActive && (
            <>
              <span className="text-zinc-700">·</span>
              <span className="text-xs text-zinc-500">
                Next: {formatDate(payment.next_run_at)}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-medium text-zinc-300">
            {formatAmount(payment.amount, payment.currency)}
          </p>
          <Badge
            className={
              isActive
                ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
                : "bg-zinc-500/10 text-zinc-400 ring-1 ring-zinc-500/20"
            }
          >
            {payment.status}
          </Badge>
        </div>

        {isActive && (
          <button
            onClick={onCancel}
            disabled={cancelling}
            className="flex size-8 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
            title="Cancel payment"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
    </div>
  )
}
