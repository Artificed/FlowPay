import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Link, useNavigate } from "react-router-dom"
import { useState } from "react"
import { ArrowRight } from "lucide-react"

import { authService } from "@/features/auth"
import { useAuth } from "@/providers/auth-provider"
import AuthLayout from "@/components/layout/auth-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const schema = z.object({
  display_name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Must be at least 8 characters"),
})

type FormData = z.infer<typeof schema>

export default function RegisterPage() {
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
      const result = await authService.register(data)
      login(result)
      navigate("/dashboard")
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Registration failed")
    }
  }

  return (
    <AuthLayout>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Create account</h2>
        <p className="text-muted-foreground text-sm">
          Get started with FlowPay in seconds
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="display_name">Full name</Label>
          <Input
            id="display_name"
            placeholder="Dummy User"
            autoComplete="name"
            className="h-10"
            {...register("display_name")}
          />
          {errors.display_name && (
            <p className="text-destructive text-xs">{errors.display_name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="dummy@google.com"
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
            autoComplete="new-password"
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
            "Creating account…"
          ) : (
            <>
              Create account
              <ArrowRight className="ml-1 size-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </Button>
      </form>

      <p className="text-muted-foreground text-center text-sm">
        Already have an account?{" "}
        <Link
          to="/login"
          className="text-foreground font-medium underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
