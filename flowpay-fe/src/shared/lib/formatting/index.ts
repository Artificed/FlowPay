import { z } from "zod"

export function parseDollarsToCents(value: string): number {
  return Math.round(parseFloat(value) * 100)
}

export const amountField = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount")
  .refine((v) => parseFloat(v) > 0, "Amount must be greater than zero")

export function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount / 100)
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))
}

export function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 18) return "Good afternoon"
  return "Good evening"
}

export const statusStyles: Record<string, string> = {
  completed: "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20",
  pending: "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20",
  processing: "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20",
  failed: "bg-red-500/10 text-red-400 ring-1 ring-red-500/20",
  reversed: "bg-zinc-500/10 text-zinc-400 ring-1 ring-zinc-500/20",
}
