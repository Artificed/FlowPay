import { RefreshCw, Trash2 } from "lucide-react"
import type { ScheduledPayment } from "../types"
import { Badge } from "@/shared/ui/primitives/badge"
import { formatAmount, formatDate } from "@/shared/lib/formatting"

type RowProps = {
  payment: ScheduledPayment
  isLast: boolean
  cancelling: boolean
  onCancel: () => void
}

export function PaymentRow({ payment, isLast, cancelling, onCancel }: RowProps) {
  const isActive = payment.status === "active"

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
