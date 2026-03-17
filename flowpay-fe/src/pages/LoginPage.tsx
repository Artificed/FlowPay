import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Link, useNavigate } from "react-router-dom"
import { useState } from "react"
import { ArrowRight } from "lucide-react"

import { authService } from "@/features/auth"
import { useAuth } from "@/providers/AuthProvider"
import AuthLayout from "@/components/layout/AuthLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
})

type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setServerError(null)
    try {
      const result = await authService.login(data)
      login(result)
      navigate("/dashboard")
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Login failed")
    }
  }

  return (
    <AuthLayout>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
        <p className="text-muted-foreground text-sm">Enter your credentials to continue</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            className="h-10"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-destructive text-xs">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            className="h-10"
            {...register("password")}
          />
          {errors.password && (
            <p className="text-destructive text-xs">{errors.password.message}</p>
          )}
        </div>

        {serverError && (
          <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2.5 text-sm">
            {serverError}
          </p>
        )}

        <Button type="submit" disabled={isSubmitting} className="group h-10 w-full">
          {isSubmitting ? (
            "Signing in…"
          ) : (
            <>
              Sign in
              <ArrowRight className="ml-1 size-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </Button>
      </form>

      <p className="text-muted-foreground text-center text-sm">
        No account?{" "}
        <Link
          to="/register"
          className="text-foreground font-medium underline underline-offset-4"
        >
          Create one
        </Link>
      </p>
    </AuthLayout>
  )
}
