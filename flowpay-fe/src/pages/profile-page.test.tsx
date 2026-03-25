import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import ProfilePage from "./profile-page"

const mockUpdateUser = vi.fn()
const mockChangePassword = vi.fn()
const mockUpdateProfile = vi.fn()

vi.mock("@/features/auth", () => ({
  useAuth: () => ({
    user: {
      id: "user-1",
      display_name: "Paul Tsai",
      email: "paul@example.com",
      avatar_url: null,
      created_at: "2024-01-15T00:00:00Z",
    },
    updateUser: mockUpdateUser,
  }),
}))

vi.mock("@/features/profile/services", () => ({
  profileService: {
    uploadAvatar: vi.fn(),
    removeAvatar: vi.fn(),
    updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
    changePassword: (...args: unknown[]) => mockChangePassword(...args),
  },
}))

vi.mock("@/features/wallet", () => ({
  walletService: { getWallet: () => Promise.resolve({ id: "wallet-123", user_id: "user-1", balances: [] }) },
  WalletIDCopy: ({ id }: { id: string }) => <span data-testid="wallet-id">{id}</span>,
}))

vi.mock("@/features/transfer/services", () => ({
  transferService: { listTransfers: () => Promise.resolve({ data: [], total: 42 }) },
}))

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockChangePassword.mockResolvedValue(undefined)
    mockUpdateProfile.mockResolvedValue({ display_name: "Paul Tsai", email: "paul@example.com" })
  })

  function renderPage() {
    return render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )
  }

  it("renders the user display name and email", () => {
    renderPage()
    expect(screen.getByText("Paul Tsai")).toBeInTheDocument()
    expect(screen.getByText("paul@example.com")).toBeInTheDocument()
  })

  it("renders the transaction count after fetch", async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText("42")).toBeInTheDocument())
  })

  it("renders the wallet ID after fetch", async () => {
    renderPage()
    await waitFor(() => expect(screen.getByTestId("wallet-id")).toBeInTheDocument())
  })

  it("shows error when new password and confirm password do not match", async () => {
    const user = userEvent.setup()
    const { container } = renderPage()

    const [currentInput, newInput, confirmInput] = container.querySelectorAll("input[type=password]")
    await user.type(currentInput, "old-password")
    await user.type(newInput, "new-password-1")
    await user.type(confirmInput, "new-password-2")

    await user.click(screen.getByRole("button", { name: /update password/i }))

    expect(screen.getByText(/passwords don't match/i)).toBeInTheDocument()
    expect(mockChangePassword).not.toHaveBeenCalled()
  })

  it("calls changePassword and shows success when passwords match", async () => {
    const user = userEvent.setup()
    const { container } = renderPage()

    const [currentInput, newInput, confirmInput] = container.querySelectorAll("input[type=password]")
    await user.type(currentInput, "old-password")
    await user.type(newInput, "new-password")
    await user.type(confirmInput, "new-password")

    await user.click(screen.getByRole("button", { name: /update password/i }))

    await waitFor(() =>
      expect(mockChangePassword).toHaveBeenCalledWith({
        current_password: "old-password",
        new_password: "new-password",
      }),
    )
    await waitFor(() =>
      expect(screen.getByText(/password updated successfully/i)).toBeInTheDocument(),
    )
  })

  it("shows password error from server when change fails", async () => {
    mockChangePassword.mockRejectedValue(new Error("Incorrect current password"))
    const user = userEvent.setup()
    const { container } = renderPage()

    const [currentInput, newInput, confirmInput] = container.querySelectorAll("input[type=password]")
    await user.type(currentInput, "wrong-old")
    await user.type(newInput, "new-password")
    await user.type(confirmInput, "new-password")

    await user.click(screen.getByRole("button", { name: /update password/i }))

    await waitFor(() =>
      expect(screen.getByText("Incorrect current password")).toBeInTheDocument(),
    )
  })

  it("shows Change photo and member since section", () => {
    renderPage()
    expect(screen.getByRole("button", { name: /change photo/i })).toBeInTheDocument()
    expect(screen.getByText(/since/i)).toBeInTheDocument()
  })
})
