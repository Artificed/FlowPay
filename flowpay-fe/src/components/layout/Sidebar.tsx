import { NavLink } from "react-router-dom"
import { Zap, House, ArrowLeftRight, CalendarClock, CircleUser, LogOut } from "lucide-react"
import { useAuth } from "@/providers/AuthProvider"

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

const nav = [
  { to: "/app/home", label: "Home", icon: House },
  { to: "/app/transactions", label: "Transactions", icon: ArrowLeftRight },
  { to: "/app/scheduled", label: "Scheduled", icon: CalendarClock },
  { to: "/app/profile", label: "Profile", icon: CircleUser },
]

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth()

  const sidebarContent = (
    <div className="flex h-full w-60 flex-col bg-zinc-950 border-r border-white/5">
      <div className="flex h-14 items-center gap-2.5 px-4 border-b border-white/5">
        <div className="flex size-7 items-center justify-center rounded-lg bg-white">
          <Zap className="size-4 fill-zinc-950 text-zinc-950" />
        </div>
        <span className="font-semibold tracking-tight text-white">FlowPay</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {nav.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${isActive
                    ? "bg-white/8 text-white"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                  }`
                }
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex items-center gap-3 border-t border-white/5 p-4">
        <div className="flex size-8 items-center justify-center rounded-full bg-indigo-500/20 text-sm font-medium text-indigo-300">
          {user?.display_name[0].toUpperCase()}
        </div>
        <span className="flex-1 truncate text-sm text-zinc-300">{user?.display_name}</span>
        <button onClick={logout} className="shrink-0">
          <LogOut className="size-4 text-zinc-600 transition-colors hover:text-zinc-300" />
        </button>
      </div>
    </div>
  )

  return (
    <>
      <div className="hidden md:flex">{sidebarContent}</div>

      {isOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={onClose}
          />
          <div className="absolute left-0 top-0 h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  )
}
