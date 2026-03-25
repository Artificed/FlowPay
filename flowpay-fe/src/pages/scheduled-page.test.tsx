import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import ScheduledPage from "./scheduled-page"

const mockList = vi.fn()
const mockCancel = vi.fn()
const mockReactivate = vi.fn()

vi.mock("@/features/scheduled", () => ({
  scheduledPaymentService: {
    list: (...args: unknown[]) => mockList(...args),
    cancel: (...args: unknown[]) => mockCancel(...args),
    reactivate: (...args: unknown[]) => mockReactivate(...args),
  },
  CreateScheduledModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="create-modal">
      <button onClick={onClose}>Close</button>
    </div>
  ),
  PaymentRow: ({
    payment,
    onCancel,
    onReactivate,
  }: {
    payment: { id: string }
    onCancel?: () => void
    onReactivate?: () => void
  }) => (
    <div data-testid={`payment-row-${payment.id}`}>
      {onCancel && <button onClick={onCancel}>Cancel {payment.id}</button>}
      {onReactivate && <button onClick={onReactivate}>Reactivate {payment.id}</button>}
    </div>
  ),
}))

vi.mock("@/shared/lib/formatting", () => ({
  formatAmount: (amount: number, currency: string) => `${currency} ${amount}`,
}))

const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

const activePayment = {
  id: "sp-active-1",
  amount: 5000,
  currency: "USD",
  interval_days: 30,
  next_run_at: futureDate,
  status: "active",
  note: "Rent",
}

const inactivePayment = {
  id: "sp-inactive-1",
  amount: 2000,
  currency: "USD",
  interval_days: 7,
  next_run_at: futureDate,
  status: "inactive",
  note: "Groceries",
}

describe("ScheduledPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockList.mockImplementation(({ status }: { status: string }) => {
      if (status === "active") return Promise.resolve({ data: [activePayment], total: 1 })
      return Promise.resolve({ data: [inactivePayment], total: 1 })
    })
    mockCancel.mockResolvedValue(undefined)
    mockReactivate.mockResolvedValue(undefined)
  })

  function renderPage() {
    return render(
      <MemoryRouter>
        <ScheduledPage />
      </MemoryRouter>,
    )
  }

  it("shows loading skeleton before data arrives", () => {
    mockList.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.queryByTestId("payment-row-sp-active-1")).not.toBeInTheDocument()
  })

  it("renders active payments after fetch", async () => {
    renderPage()
    await waitFor(() => expect(screen.getByTestId("payment-row-sp-active-1")).toBeInTheDocument())
  })

  it("shows active count in the stats section", async () => {
    renderPage()
    await waitFor(() => screen.getByTestId("payment-row-sp-active-1"))
    expect(screen.getByText("1")).toBeInTheDocument()
  })

  it("shows 'No scheduled payments yet' when there are no active payments", async () => {
    mockList.mockImplementation(() => Promise.resolve({ data: [], total: 0 }))
    renderPage()
    await waitFor(() => expect(screen.getByText(/no scheduled payments yet/i)).toBeInTheDocument())
  })

  it("fetches inactive payments when Inactive tab is clicked", async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByTestId("payment-row-sp-active-1"))

    await user.click(screen.getByRole("button", { name: /^inactive$/i }))

    await waitFor(() => expect(screen.getByTestId("payment-row-sp-inactive-1")).toBeInTheDocument())
    expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ status: "inactive" }))
  })

  it("calls scheduledPaymentService.cancel with the correct id", async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByTestId("payment-row-sp-active-1"))

    await user.click(screen.getByRole("button", { name: /cancel sp-active-1/i }))

    await waitFor(() => expect(mockCancel).toHaveBeenCalledWith("sp-active-1"))
  })

  it("calls scheduledPaymentService.reactivate with the correct id from inactive tab", async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByTestId("payment-row-sp-active-1"))

    await user.click(screen.getByRole("button", { name: /^inactive$/i }))
    await waitFor(() => screen.getByTestId("payment-row-sp-inactive-1"))

    await user.click(screen.getByRole("button", { name: /reactivate sp-inactive-1/i }))

    await waitFor(() => expect(mockReactivate).toHaveBeenCalledWith("sp-inactive-1"))
  })

  it("shows CreateScheduledModal when Schedule payment button is clicked", async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByRole("button", { name: /schedule payment/i }))

    await user.click(screen.getByRole("button", { name: /schedule payment/i }))

    expect(screen.getByTestId("create-modal")).toBeInTheDocument()
  })
})
