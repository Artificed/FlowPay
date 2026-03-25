import type { ReactNode } from "react"
import { AuthProvider } from "@/features/auth"
import { Toaster } from "@/shared/ui/primitives/sonner"

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <Toaster />
    </AuthProvider>
  )
}
