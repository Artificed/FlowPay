import { useState } from "react"
import { Outlet } from "react-router-dom"
import { Menu } from "lucide-react"
import Sidebar from "./Sidebar"

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-svh overflow-hidden bg-zinc-950">
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)`,
          backgroundSize: "28px 28px",
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[500px]"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99,102,241,0.18) 0%, transparent 70%)",
        }}
      />

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center gap-3 border-b border-white/5 px-4 md:hidden">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu className="size-5 text-zinc-400" />
          </button>
          <span className="font-semibold text-white">FlowPay</span>
        </header>

        <main className="relative flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
