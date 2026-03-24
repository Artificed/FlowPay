import { ArrowUpRight, ArrowDownLeft, PlusCircle } from "lucide-react"
import type { Transaction } from "../types"
import { Badge } from "@/shared/ui/primitives/badge"
import { formatAmount, formatDate, statusStyles } from "@/shared/lib/formatting"

type Props = {
  transaction: Transaction
  walletId: string | null
  isLast: boolean
  showStatusBadge?: boolean
  onClick?: (txn: Transaction) => void
}

export function TransactionRow({ transaction: txn, walletId, isLast, showStatusBadge, onClick }: Props) {
  const isDeposit = txn.type === "deposit"
  const isOutgoing = !isDeposit && walletId != null && txn.sender_wallet_id === walletId

  const accentBar = isDeposit
    ? "bg-indigo-500/60"
    : isOutgoing
      ? "bg-zinc-700"
      : "bg-emerald-500/60"

  const iconBg = isDeposit
    ? "bg-indigo-500/10 text-indigo-400"
    : isOutgoing
      ? "bg-zinc-800 text-zinc-400"
      : "bg-emerald-500/10 text-emerald-400"

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick ? () => onClick(txn) : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(txn) } : undefined}
      className={`group relative flex items-center gap-4 px-5 py-4 transition-colors
        ${onClick ? "cursor-pointer hover:bg-white/[0.03] active:bg-white/[0.05]" : ""}
        ${!isLast ? "border-b border-white/5" : ""}
      `}
    >
      <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-7 rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity ${accentBar}`} />

      <div className={`flex size-9 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
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
        <p className={`text-sm font-medium ${isOutgoing ? "text-zinc-300" : "text-emerald-400"}`}>
          {isOutgoing ? "−" : "+"}
          {formatAmount(txn.amount, txn.currency)}
        </p>
        <p className="mt-0.5 text-xs text-zinc-600">{formatDate(txn.created_at)}</p>
      </div>

      {showStatusBadge && (
        <Badge className={`hidden shrink-0 sm:inline-flex ${statusStyles[txn.status] ?? statusStyles.pending}`}>
          {txn.status}
        </Badge>
      )}
    </div>
  )
}
