import type { ReactNode } from "react"
import { Zap, Shield, Globe } from "lucide-react"

const features = [
  { icon: Zap, title: "Instant transfers", description: "Money moves in seconds, not days" },
  { icon: Shield, title: "Bank-grade security", description: "End-to-end encrypted transactions" },
  { icon: Globe, title: "Multi-currency", description: "Send in any currency, worldwide" },
]

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1fr_480px]">
      <div className="relative hidden overflow-hidden bg-zinc-950 p-12 lg:flex lg:flex-col lg:justify-between">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)`,
            backgroundSize: "48px 48px",
          }}
        />
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-white">
            <Zap className="size-5 fill-zinc-950 text-zinc-950" />
          </div>
          <span className="text-xl font-semibold tracking-tight text-white">FlowPay</span>
        </div>

        <div className="relative space-y-10">
          <div className="space-y-4">
            <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight text-white">
              Money that moves
              <br />
              <span className="text-zinc-400">as fast as you do.</span>
            </h1>
            <p className="max-w-sm text-zinc-400">
              Send, receive, and manage money with zero friction.
            </p>
          </div>

          <div className="space-y-5">
            {features.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex items-center gap-3.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Icon className="size-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{title}</p>
                  <p className="text-sm text-zinc-500">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center bg-white p-8 dark:bg-zinc-900">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex items-center gap-2.5 lg:hidden">
            <div className="bg-foreground flex size-7 items-center justify-center rounded-lg">
              <Zap className="fill-background text-background size-4" />
            </div>
            <span className="font-semibold tracking-tight">FlowPay</span>
          </div>

          {children}
        </div>
      </div>
    </div>
  )
}
