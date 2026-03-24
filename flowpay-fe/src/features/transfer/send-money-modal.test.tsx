import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import SendMoneyModal from "./send-money-modal"

vi.mock("@/features/wallet/use-currencies", () => ({
  useCurrencies: () => ({
    currencies: [
      { code: "USD", name: "US Dollar" },
      { code: "EUR", name: "Euro" },
    ],
    currencyError: null,
  }),
}))

const mockCreateTransfer = vi.fn()
vi.mock("./services", () => ({
  transferService: {
    createTransfer: (...args: unknown[]) => mockCreateTransfer(...args),
  },
}))

const VALID_UUID = "12345678-1234-4234-8234-123456789012"

describe("SendMoneyModal — form validation", () => {
  const onClose = vi.fn()
  const onSuccess = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateTransfer.mockResolvedValue({ id: "t1" })
  })

  it("shows error when recipient wallet ID is not a valid UUID", async () => {
    const user = userEvent.setup()
    render(<SendMoneyModal onClose={onClose} onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText(/recipient wallet id/i), "not-a-uuid")
    await user.type(screen.getByLabelText(/amount/i), "10.00")
    await user.click(screen.getByRole("button", { name: /send money/i }))

    await waitFor(() => expect(screen.getByText(/must be a valid wallet id/i)).toBeInTheDocument())
    expect(mockCreateTransfer).not.toHaveBeenCalled()
  })

  it("shows error when amount is zero", async () => {
    const user = userEvent.setup()
    render(<SendMoneyModal onClose={onClose} onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText(/recipient wallet id/i), VALID_UUID)
    await user.type(screen.getByLabelText(/amount/i), "0")
    await user.click(screen.getByRole("button", { name: /send money/i }))

    await waitFor(() => expect(screen.getByText(/amount must be greater than zero/i)).toBeInTheDocument())
    expect(mockCreateTransfer).not.toHaveBeenCalled()
  })

  it("shows error when amount is not a valid number", async () => {
    const user = userEvent.setup()
    render(<SendMoneyModal onClose={onClose} onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText(/recipient wallet id/i), VALID_UUID)
    await user.type(screen.getByLabelText(/amount/i), "abc")
    await user.click(screen.getByRole("button", { name: /send money/i }))

    await waitFor(() => expect(screen.getByText(/enter a valid amount/i)).toBeInTheDocument())
    expect(mockCreateTransfer).not.toHaveBeenCalled()
  })

  it("converts decimal dollars to integer cents when submitting", async () => {
    const user = userEvent.setup()
    render(<SendMoneyModal onClose={onClose} onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText(/recipient wallet id/i), VALID_UUID)
    await user.type(screen.getByLabelText(/amount/i), "10.50")
    await user.click(screen.getByRole("button", { name: /send money/i }))

    await waitFor(() =>
      expect(mockCreateTransfer).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 1050, currency: "USD" }),
        expect.any(String),
      ),
    )
  })

  it("calls onSuccess and onClose after successful transfer", async () => {
    const user = userEvent.setup()
    render(<SendMoneyModal onClose={onClose} onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText(/recipient wallet id/i), VALID_UUID)
    await user.type(screen.getByLabelText(/amount/i), "25.00")
    await user.click(screen.getByRole("button", { name: /send money/i }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
    expect(onClose).toHaveBeenCalled()
  })

  it("shows server error message when transfer fails", async () => {
    mockCreateTransfer.mockRejectedValue(new Error("insufficient funds"))
    const user = userEvent.setup()
    render(<SendMoneyModal onClose={onClose} onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText(/recipient wallet id/i), VALID_UUID)
    await user.type(screen.getByLabelText(/amount/i), "999999.00")
    await user.click(screen.getByRole("button", { name: /send money/i }))

    await waitFor(() => expect(screen.getByText("insufficient funds")).toBeInTheDocument())
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it("calls onClose when Cancel is clicked", async () => {
    const user = userEvent.setup()
    render(<SendMoneyModal onClose={onClose} onSuccess={onSuccess} />)

    await user.click(screen.getByRole("button", { name: /cancel/i }))

    expect(onClose).toHaveBeenCalled()
  })
})
