import { NavLink } from "react-router-dom"
import { Zap, House, ArrowLeftRight, CalendarClock, CircleUser, LogOut } from "lucide-react"
import { useAuth } from "@/providers/AuthProvider"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

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
    <div className="flex h-full w-64 flex-col bg-zinc-950/80 backdrop-blur-xl border-r border-white/5">
      <div className="flex h-16 items-center gap-3 px-5 border-b border-white/5">
        <div className="flex size-8 items-center justify-center rounded-xl bg-white">
          <Zap className="size-4 fill-zinc-950 text-zinc-950" />
        </div>
        <span className="text-base font-semibold tracking-tight text-white">FlowPay</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {nav.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${isActive
                    ? "bg-white/12 text-white font-medium"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/8"
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
        <Avatar className="size-8">
          <AvatarFallback className="bg-indigo-500/20 text-sm font-medium text-indigo-300">
            {user?.display_name[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="flex-1 truncate text-sm text-zinc-300">{user?.display_name}</span>
        <button onClick={logout} className="shrink-0">
          <LogOut className="size-4 text-zinc-500 transition-colors hover:text-zinc-300" />
        </button>
      </div>
    </div>
  )

  return (
    <>
      <div className="hidden md:flex">{sidebarContent}</div>

      <div className={`fixed inset-0 z-40 md:hidden transition-all duration-300 ${isOpen ? "visible" : "invisible"}`}>
        <div
          className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"}`}
          onClick={onClose}
        />
        <div className={`absolute left-0 top-0 h-full transition-transform duration-300 ease-in-out ${isOpen ? "translate-x-0" : "-translate-x-full"}`}>
          {sidebarContent}
        </div>
      </div>
    </>
  )
}
