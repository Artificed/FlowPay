import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import AddFundsModal from "./add-funds-modal"

vi.mock("../hooks/use-currencies", () => ({
  useCurrencies: () => ({
    currencies: [
      { code: "USD", name: "US Dollar" },
      { code: "EUR", name: "Euro" },
    ],
    currencyError: null,
  }),
}))

const mockDeposit = vi.fn()
vi.mock("../services", () => ({
  walletService: {
    deposit: (...args: unknown[]) => mockDeposit(...args),
  },
}))

describe("AddFundsModal — form validation", () => {
  const onClose = vi.fn()
  const onSuccess = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockDeposit.mockResolvedValue({ id: "b1", total_amount: 10000, available_amount: 10000, currency: "USD" })
  })

  it("shows error when amount is zero", async () => {
    const user = userEvent.setup()
    render(<AddFundsModal onClose={onClose} onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText(/amount/i), "0")
    await user.click(screen.getByRole("button", { name: /add funds/i }))

    await waitFor(() => expect(screen.getByText(/amount must be greater than zero/i)).toBeInTheDocument())
    expect(mockDeposit).not.toHaveBeenCalled()
  })

  it("shows error when amount is not a valid number", async () => {
    const user = userEvent.setup()
    render(<AddFundsModal onClose={onClose} onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText(/amount/i), "abc")
    await user.click(screen.getByRole("button", { name: /add funds/i }))

    await waitFor(() => expect(screen.getByText(/enter a valid amount/i)).toBeInTheDocument())
    expect(mockDeposit).not.toHaveBeenCalled()
  })

  it("converts decimal dollars to integer cents when depositing", async () => {
    const user = userEvent.setup()
    render(<AddFundsModal onClose={onClose} onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText(/amount/i), "50.25")
    await user.click(screen.getByRole("button", { name: /add funds/i }))

    await waitFor(() =>
      expect(mockDeposit).toHaveBeenCalledWith(expect.objectContaining({ amount: 5025, currency: "USD" })),
    )
  })

  it("calls onSuccess and onClose after successful deposit", async () => {
    const user = userEvent.setup()
    render(<AddFundsModal onClose={onClose} onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText(/amount/i), "100.00")
    await user.click(screen.getByRole("button", { name: /add funds/i }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
    expect(onClose).toHaveBeenCalled()
  })

  it("shows server error when deposit fails", async () => {
    mockDeposit.mockRejectedValue(new Error("unsupported currency"))
    const user = userEvent.setup()
    render(<AddFundsModal onClose={onClose} onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText(/amount/i), "100.00")
    await user.click(screen.getByRole("button", { name: /add funds/i }))

    await waitFor(() => expect(screen.getByText("unsupported currency")).toBeInTheDocument())
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it("calls onClose when Cancel is clicked", async () => {
    const user = userEvent.setup()
    render(<AddFundsModal onClose={onClose} onSuccess={onSuccess} />)

    await user.click(screen.getByRole("button", { name: /cancel/i }))

    expect(onClose).toHaveBeenCalled()
  })
})
