import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import HomePage from "./home-page"

vi.mock("@/features/auth", () => ({
  useAuth: () => ({ user: { display_name: "Paul Tsai", id: "user-1" } }),
}))

const mockGetWallet = vi.fn()
const mockListTransfers = vi.fn()

vi.mock("@/features/wallet", () => ({
  walletService: { getWallet: (...args: unknown[]) => mockGetWallet(...args) },
  WalletIDCopy: ({ id }: { id: string }) => <span>{id}</span>,
  AddFundsModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="add-funds-modal">
      <button onClick={onClose}>Close modal</button>
    </div>
  ),
}))

vi.mock("@/features/transfer", () => ({
  transferService: { listTransfers: (...args: unknown[]) => mockListTransfers(...args) },
  useSSETransactions: () => {},
  ActivityChart: () => <div data-testid="activity-chart" />,
  TransactionRow: ({ transaction }: { transaction: { id: string } }) => (
    <div data-testid={`txn-row-${transaction.id}`} />
  ),
  SendMoneyModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="send-money-modal">
      <button onClick={onClose}>Close modal</button>
    </div>
  ),
  getFilteredTransactions: (txns: unknown[]) => txns,
}))

vi.mock("@/shared/lib/formatting", () => ({
  formatAmount: (amount: number, currency: string) => `${currency} ${amount}`,
  getGreeting: () => "Good morning",
}))

const mockWallet = {
  id: "wallet-123",
  user_id: "user-1",
  balances: [{ id: "b1", currency: "USD", total_amount: 10000, available_amount: 9500 }],
}

const mockTxns = [
  {
    id: "txn-1",
    type: "deposit",
    amount: 500,
    currency: "USD",
    status: "completed",
    note: "",
    reference_code: "FP-20240101-AABB",
    sender_wallet_id: null,
    recipient_wallet_id: "wallet-123",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]

describe("HomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetWallet.mockResolvedValue(mockWallet)
    mockListTransfers.mockResolvedValue({ data: mockTxns, total: 1 })
  })

  function renderPage() {
    return render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
  }

  it("shows loading skeleton before data arrives", () => {
    mockGetWallet.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.queryByText(/good morning/i)).not.toBeInTheDocument()
  })

  it("renders greeting with user first name after data loads", async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText(/good morning, paul/i)).toBeInTheDocument())
  })

  it("renders available balance", async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText("USD 9500")).toBeInTheDocument())
  })

  it("renders activity chart after load", async () => {
    renderPage()
    await waitFor(() => expect(screen.getByTestId("activity-chart")).toBeInTheDocument())
  })

  it("shows 'No transactions yet' when transaction list is empty", async () => {
    mockListTransfers.mockResolvedValue({ data: [], total: 0 })
    renderPage()
    await waitFor(() => expect(screen.getByText(/no transactions yet/i)).toBeInTheDocument())
  })

  it("renders a row for each recent transaction", async () => {
    renderPage()
    await waitFor(() => expect(screen.getByTestId("txn-row-txn-1")).toBeInTheDocument())
  })

  it("shows SendMoneyModal when Send money button is clicked", async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByRole("button", { name: /send money/i }))
    await user.click(screen.getByRole("button", { name: /send money/i }))
    expect(screen.getByTestId("send-money-modal")).toBeInTheDocument()
  })

  it("shows AddFundsModal when Add funds button is clicked", async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByRole("button", { name: /add funds/i }))
    await user.click(screen.getByRole("button", { name: /add funds/i }))
    expect(screen.getByTestId("add-funds-modal")).toBeInTheDocument()
  })

  it("renders page and shows toast when fetch fails", async () => {
    mockGetWallet.mockRejectedValue(new Error("Network failure"))
    renderPage()
    await waitFor(() => expect(screen.getByText(/good morning/i)).toBeInTheDocument())
  })
})
