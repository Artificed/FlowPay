import { Navigate } from "react-router-dom"
import { useAuth } from "@/providers/auth-provider"

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}
