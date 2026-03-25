import { useState } from "react"
import { X, ArrowUpRight, ArrowDownLeft, PlusCircle, Copy, Check, Hash, Wallet } from "lucide-react"
import type { Transaction } from "../types"
import { Badge } from "@/shared/ui/primitives/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogDescription,
} from "@/shared/ui/primitives/dialog"
import { formatAmount, statusStyles } from "@/shared/lib/formatting"

type Props = {
  transaction: Transaction
  walletId: string | null
  onClose: () => void
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-white/5 last:border-0">
      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/5 text-zinc-500">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-widest text-zinc-600">{label}</p>
        <div className="mt-0.5 text-sm font-medium text-zinc-200 break-all">{value}</div>
      </div>
    </div>
  )
}

export function TransactionDetailModal({ transaction: txn, walletId, onClose }: Props) {
  const [copied, setCopied] = useState(false)

  const isDeposit = txn.type === "deposit"
  const isOutgoing = !isDeposit && walletId != null && txn.sender_wallet_id === walletId

  const accentColor = isDeposit
    ? "text-indigo-400"
    : isOutgoing
      ? "text-zinc-300"
      : "text-emerald-400"

  const iconBg = isDeposit
    ? "bg-indigo-500/15 text-indigo-400"
    : isOutgoing
      ? "bg-zinc-800 text-zinc-400"
      : "bg-emerald-500/15 text-emerald-400"

  const glowColor = isDeposit ? "bg-indigo-500" : isOutgoing ? "bg-zinc-400" : "bg-emerald-500"
  const typeLabel = isDeposit ? "Deposit" : isOutgoing ? "Sent" : "Received"
  const amountSign = isOutgoing ? "-" : "+"

  const friendlyDate = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(txn.created_at))

  function copyRef() {
    navigator.clipboard.writeText(txn.reference_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const senderDisplay = isDeposit
    ? "-"
    : isOutgoing
      ? "You"
      : txn.sender_name || "Unknown wallet"

  const recipientDisplay = isOutgoing
    ? txn.recipient_name || "Unknown wallet"
    : "You"

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-w-sm overflow-hidden rounded-2xl border border-white/8 bg-zinc-950 p-0 shadow-2xl"
      >
        <div
          className={`pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 size-36 rounded-full blur-3xl opacity-20 ${glowColor}`}
        />

        <DialogClose className="absolute right-4 top-4 z-10 flex size-7 items-center justify-center rounded-full bg-white/5 text-zinc-500 transition-colors hover:bg-white/10 hover:text-zinc-300">
          <X className="size-3.5" />
        </DialogClose>

        <DialogHeader className="sr-only">
          <DialogTitle>Transaction detail</DialogTitle>
          <DialogDescription>Details for this transaction</DialogDescription>
        </DialogHeader>

        <div className="relative px-6 pb-2 pt-8 text-center">
          <div className={`mx-auto mb-3.5 flex size-12 items-center justify-center rounded-2xl ${iconBg}`}>
            {isDeposit ? (
              <PlusCircle className="size-5" />
            ) : isOutgoing ? (
              <ArrowUpRight className="size-5" />
            ) : (
              <ArrowDownLeft className="size-5" />
            )}
          </div>

          <p className={`text-[2rem] font-semibold tracking-tight leading-none ${accentColor}`}>
            {amountSign}{formatAmount(txn.amount, txn.currency)}
          </p>

          {txn.note && (
            <p className="mt-2 text-sm text-zinc-400">"{txn.note}"</p>
          )}

          <div className="mt-3 flex items-center justify-center gap-2">
            <Badge className={`${statusStyles[txn.status] ?? statusStyles.pending} capitalize`}>
              {txn.status}
            </Badge>
            <span className="text-xs text-zinc-600">{typeLabel}</span>
          </div>
        </div>

        <div className="px-5 py-3">
          <DetailRow
            icon={<Hash className="size-3.5" />}
            label="Reference"
            value={
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-xs">{txn.reference_code}</span>
                <button
                  onClick={copyRef}
                  className="-mr-2 flex size-6 items-center justify-center rounded-md hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"
                >
                  {copied
                    ? <Check className="size-3 text-emerald-400" />
                    : <Copy className="size-3" />
                  }
                </button>
              </div>
            }
          />

          <DetailRow
            icon={<ArrowUpRight className="size-3.5" />}
            label="From"
            value={senderDisplay}
          />

          <DetailRow
            icon={<ArrowDownLeft className="size-3.5" />}
            label="To"
            value={recipientDisplay}
          />

          <DetailRow
            icon={<Wallet className="size-3.5" />}
            label="Date"
            value={<span className="font-normal text-zinc-300">{friendlyDate}</span>}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
