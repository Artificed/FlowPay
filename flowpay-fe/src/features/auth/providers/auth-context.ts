import { createContext } from "react"
import type { AuthResult, User } from "@/features/auth/types"

export type AuthContextValue = {
  user: User | null
  token: string | null
  login: (result: AuthResult) => void
  logout: () => void
  updateUser: (user: User) => void
  isAuthenticated: boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)
