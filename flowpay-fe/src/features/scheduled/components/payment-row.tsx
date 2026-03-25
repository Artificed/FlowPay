import { RefreshCw, Trash2, RotateCcw } from "lucide-react"
import type { ScheduledPayment } from "../types"
import { formatAmount, formatDate } from "@/shared/lib/formatting"

type RowProps = {
  payment: ScheduledPayment
  isLast: boolean
  cancelling: boolean
  onCancel: () => void
  reactivating?: boolean
  onReactivate?: () => void
}

function getNextRunLabel(isoDate: string): string {
  const nowDay = new Date(); nowDay.setHours(0, 0, 0, 0)
  const targetDay = new Date(isoDate); targetDay.setHours(0, 0, 0, 0)
  const diffDays = Math.round((targetDay.getTime() - nowDay.getTime()) / 86400000)
  if (diffDays < 0) return "Overdue"
  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Tomorrow"
  return `in ${diffDays} days`
}

export function PaymentRow({ payment, isLast, cancelling, onCancel, reactivating, onReactivate }: RowProps) {
  const isActive = payment.status === "active"
  const isInactive = payment.status === "inactive"
  const nextRunLabel = isActive ? getNextRunLabel(payment.next_run_at) : null

  return (
    <div
      className={`flex items-center gap-4 px-5 py-4 transition-colors hover:bg-white/3 ${!isLast ? "border-b border-white/5" : ""}`}
    >
      <div
        className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
          isActive ? "bg-violet-500/10 text-violet-400" : "bg-zinc-800 text-zinc-600"
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
        {isInactive && payment.failed_reason && (
          <p className="mt-0.5 text-xs text-red-400/80 truncate" title={payment.failed_reason}>
            Auto-cancelled: {payment.failed_reason}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-medium text-zinc-300">
            {formatAmount(payment.amount, payment.currency)}
          </p>
          <p
            className={`mt-0.5 text-xs ${nextRunLabel === "Overdue" ? "text-red-400" : nextRunLabel === "Today" ? "text-amber-400" : "text-zinc-500"}`}
            title={isActive ? formatDate(payment.next_run_at) : undefined}
          >
            Every {payment.interval_days} {payment.interval_days === 1 ? "day" : "days"}
            {isActive && nextRunLabel && ` · Next: ${nextRunLabel}`}
          </p>
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

        {isInactive && onReactivate && (
          <button
            onClick={onReactivate}
            disabled={reactivating}
            className="flex size-8 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-emerald-500/10 hover:text-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
            title="Reactivate payment"
          >
            <RotateCcw className="size-4" />
          </button>
        )}
      </div>
    </div>
  )
}
