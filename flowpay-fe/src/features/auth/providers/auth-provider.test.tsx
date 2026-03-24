import { describe, it, expect, vi } from "vitest"
import { render, screen, act } from "@testing-library/react"
import { AuthProvider, useAuth } from "./auth-provider"
import type { AuthResult } from "@/features/auth/types"

const mockUser = { id: "u1", email: "dummy@google.com", display_name: "Dummy", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }
const mockResult: AuthResult = { token: "tok-123", user: mockUser }

function TestConsumer() {
  const { user, isAuthenticated, login, logout } = useAuth()
  return (
    <>
      <div data-testid="auth">{String(isAuthenticated)}</div>
      <div data-testid="user">{user?.display_name ?? "null"}</div>
      <button onClick={() => login(mockResult)}>Login</button>
      <button onClick={logout}>Logout</button>
    </>
  )
}

describe("auth-provider", () => {
  it("initializes as unauthenticated when no token in localStorage", () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )
    expect(screen.getByTestId("auth")).toHaveTextContent("false")
    expect(screen.getByTestId("user")).toHaveTextContent("null")
  })

  it("initializes as authenticated when token and user exist in localStorage", () => {
    localStorage.setItem("flowpay_token", "existing-tok")
    localStorage.setItem("flowpay_user", JSON.stringify(mockUser))

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )

    expect(screen.getByTestId("auth")).toHaveTextContent("true")
    expect(screen.getByTestId("user")).toHaveTextContent("Dummy")
  })

  it("login stores token and user in state and localStorage", () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )

    act(() => screen.getByText("Login").click())

    expect(screen.getByTestId("auth")).toHaveTextContent("true")
    expect(screen.getByTestId("user")).toHaveTextContent("Dummy")
    expect(localStorage.getItem("flowpay_token")).toBe("tok-123")
    expect(JSON.parse(localStorage.getItem("flowpay_user")!).display_name).toBe("Dummy")
  })

  it("logout clears state and localStorage", () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )

    act(() => screen.getByText("Login").click())
    act(() => screen.getByText("Logout").click())

    expect(screen.getByTestId("auth")).toHaveTextContent("false")
    expect(screen.getByTestId("user")).toHaveTextContent("null")
    expect(localStorage.getItem("flowpay_token")).toBeNull()
    expect(localStorage.getItem("flowpay_user")).toBeNull()
  })

  it("throws when useAuth is used outside AuthProvider", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => { })
    expect(() => render(<TestConsumer />)).toThrow("useAuth must be used within AuthProvider")
    consoleSpy.mockRestore()
  })
})
