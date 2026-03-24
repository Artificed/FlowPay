import { useEffect, useState, useCallback } from "react"
import { CalendarClock, Plus } from "lucide-react"
import { scheduledPaymentService, CreateScheduledModal, PaymentRow } from "@/features/scheduled"
import type { ScheduledPayment } from "@/features/scheduled"
import { Button } from "@/shared/ui/primitives/button"

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
