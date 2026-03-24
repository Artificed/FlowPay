import type { ReactNode } from "react"
import { AuthProvider } from "@/features/auth"

export default function Providers({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}
