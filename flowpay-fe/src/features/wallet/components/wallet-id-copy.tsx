import { useState } from "react"
import { Copy, Check } from "lucide-react"

export function WalletIDCopy({ id }: { id: string }) {
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
