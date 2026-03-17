import { useNavigate } from "react-router-dom"
import { useAuth } from "@/providers/AuthProvider"
import { Button } from "@/components/ui/button"

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate("/login")
  }

  return (
    <div className="flex min-h-svh flex-col p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">FlowPay</h1>
        <Button variant="outline" onClick={handleLogout}>
          Sign out
        </Button>
      </div>
      <div className="mt-8">
        <p className="text-muted-foreground text-sm">Welcome back,</p>
        <p className="text-2xl font-semibold">{user?.display_name}</p>
      </div>
    </div>
  )
}
