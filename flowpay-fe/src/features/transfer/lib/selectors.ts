import type { Transaction, FilterRange } from "../types"

export function getFilteredTransactions(transactions: Transaction[], filterRange: FilterRange): Transaction[] {
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
