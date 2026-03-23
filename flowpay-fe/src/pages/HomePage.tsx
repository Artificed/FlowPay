import { useEffect, useState, useCallback, useRef } from "react"
import { SendHorizonal, Copy, Check } from "lucide-react"
import { useAuth } from "@/providers/AuthProvider"
import { walletService } from "@/features/wallet"
import { streamTransactions } from "@/features/transfer"
import type { Wallet } from "@/features/wallet"
import { Button } from "@/components/ui/button"
import SendMoneyModal from "@/features/transfer/SendMoneyModal"
import AddFundsModal from "@/features/wallet/AddFundsModal"
import { formatAmount, getGreeting } from "@/lib/formatting"

function WalletIDCopy({ id }: { id: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    await navigator.clipboard.writeText(id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      className="group flex items-center gap-1.5 rounded-full border border-white/8 bg-white/4 px-3 py-1 transition-colors hover:bg-white/8"
    >
      <span className="font-mono text-[11px] text-zinc-500">
        {id.slice(0, 8)}…{id.slice(-4)}
      </span>
      {copied ? (
        <Check className="size-3 text-emerald-400" />
      ) : (
        <Copy className="size-3 text-zinc-600 transition-colors group-hover:text-zinc-400" />
      )}
    </button>
  )
}

export default function HomePage() {
  const { user } = useAuth()
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCurrency, setActiveCurrency] = useState(0)
  const [showSend, setShowSend] = useState(false)
  const [showDeposit, setShowDeposit] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const fetchWallet = useCallback(async () => {
    try {
      setError(null)
      const w = await walletService.getWallet()
      if (mountedRef.current) setWallet(w)
    } catch (err) {
      if (mountedRef.current)
        setError(err instanceof Error ? err.message : "Failed to load wallet")
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWallet()
  }, [fetchWallet])

  useEffect(() => {
    const ctrl = new AbortController()
    streamTransactions({
      signal: ctrl.signal,
      onSnapshot() {},
      onTransactionUpdate() {},
      onWalletUpdate(w) {
        setWallet(w)
      },
      onError(err) {
        console.error("SSE error:", err)
      },
    })
    return () => ctrl.abort()
  }, [])

  const activeBalance = wallet?.balances[activeCurrency]

  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-center">
      <p className="text-sm text-zinc-500">
        {getGreeting()}, {user?.display_name.split(" ")[0]}
      </p>

      {error ? (
        <div className="mt-6 flex flex-col items-center gap-3">
          <p className="text-sm text-red-400">{error}</p>
          <Button
            variant="outline"
            className="h-9 rounded-full border-white/10 bg-white/5 px-5 text-sm text-white hover:bg-white/10"
            onClick={fetchWallet}
          >
            Retry
          </Button>
        </div>
      ) : loading ? (
        <div className="mt-4 flex flex-col items-center gap-3">
          <div className="h-16 w-64 animate-pulse rounded-xl bg-white/5" />
          <div className="h-4 w-32 animate-pulse rounded-lg bg-white/5" />
        </div>
      ) : activeBalance ? (
        <>
          <p className="mt-3 bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-6xl font-semibold tracking-tighter text-transparent sm:text-7xl">
            {formatAmount(activeBalance.available_amount, activeBalance.currency)}
          </p>
          {activeBalance.total_amount !== activeBalance.available_amount && (
            <p className="mt-2 text-sm text-zinc-600">
              {formatAmount(activeBalance.total_amount, activeBalance.currency)} total
            </p>
          )}
        </>
      ) : (
        <p className="mt-4 text-5xl font-semibold tracking-tighter text-zinc-700">$0.00</p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {wallet?.balances.map((b, i) => (
          <button
            key={b.id}
            onClick={() => setActiveCurrency(i)}
            className={`rounded-full px-3.5 py-1 text-xs font-medium transition-all ${
              i === activeCurrency
                ? "bg-white text-zinc-950"
                : "border border-white/8 bg-white/4 text-zinc-400 hover:bg-white/8"
            }`}
          >
            {b.currency}
          </button>
        ))}
      </div>

      <div className="mt-8 flex flex-col items-center gap-3">
        <div className="flex gap-2">
          <Button
            className="h-10 gap-2 rounded-full bg-white px-6 text-zinc-950 hover:bg-zinc-100"
            onClick={() => setShowSend(true)}
          >
            <SendHorizonal className="size-4" />
            Send money
          </Button>
          <Button
            variant="outline"
            className="h-10 gap-2 rounded-full border-white/10 bg-white/5 px-6 text-white hover:bg-white/10"
            onClick={() => setShowDeposit(true)}
          >
            Add funds
          </Button>
        </div>
        {wallet && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-600">
            <span>Wallet ID</span>
            <WalletIDCopy id={wallet.id} />
          </div>
        )}
      </div>

      {showSend && (
        <SendMoneyModal onClose={() => setShowSend(false)} onSuccess={fetchWallet} onFail={() => {}} />
      )}
      {showDeposit && (
        <AddFundsModal onClose={() => setShowDeposit(false)} onSuccess={fetchWallet} />
      )}
    </div>
  )
}
