import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import TransactionsPage from "./transactions-page"

const mockGetWallet = vi.fn()
const mockListTransfers = vi.fn()

vi.mock("@/features/wallet", () => ({
  walletService: { getWallet: (...args: unknown[]) => mockGetWallet(...args) },
}))

vi.mock("@/features/transfer", () => ({
  transferService: { listTransfers: (...args: unknown[]) => mockListTransfers(...args) },
  useSSETransactions: () => {},
  TransactionRow: ({ transaction }: { transaction: { id: string } }) => (
    <div data-testid={`txn-row-${transaction.id}`} />
  ),
  TransactionDetailModal: () => <div data-testid="detail-modal" />,
  SendMoneyModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="send-money-modal">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}))

const WALLET_ID = "wallet-123"

const mockWallet = { id: WALLET_ID, user_id: "user-1", balances: [] }

const sentTxn = {
  id: "sent-1",
  type: "transfer",
  amount: 200,
  currency: "USD",
  status: "completed",
  note: "lunch",
  reference_code: "FP-SENT",
  sender_wallet_id: WALLET_ID,
  recipient_wallet_id: "wallet-456",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

const receivedTxn = {
  id: "received-1",
  type: "transfer",
  amount: 300,
  currency: "USD",
  status: "completed",
  note: "invoice",
  reference_code: "FP-RECV",
  sender_wallet_id: "wallet-456",
  recipient_wallet_id: WALLET_ID,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

const depositTxn = {
  id: "deposit-1",
  type: "deposit",
  amount: 1000,
  currency: "USD",
  status: "completed",
  note: "",
  reference_code: "FP-DEP",
  sender_wallet_id: null,
  recipient_wallet_id: WALLET_ID,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

describe("TransactionsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetWallet.mockResolvedValue(mockWallet)
    mockListTransfers.mockResolvedValue({ data: [sentTxn, receivedTxn, depositTxn], total: 3 })
  })

  function renderPage() {
    return render(
      <MemoryRouter>
        <TransactionsPage />
      </MemoryRouter>,
    )
  }

  it("shows loading skeleton before data arrives", () => {
    mockListTransfers.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.queryByTestId("txn-row-sent-1")).not.toBeInTheDocument()
  })

  it("renders all transactions after fetch", async () => {
    renderPage()
    await waitFor(() => expect(screen.getByTestId("txn-row-sent-1")).toBeInTheDocument())
    expect(screen.getByTestId("txn-row-received-1")).toBeInTheDocument()
    expect(screen.getByTestId("txn-row-deposit-1")).toBeInTheDocument()
  })

  it("shows 'No transactions yet' when list is empty", async () => {
    mockListTransfers.mockResolvedValue({ data: [], total: 0 })
    renderPage()
    await waitFor(() => expect(screen.getByText(/no transactions yet/i)).toBeInTheDocument())
  })

  it("filters to only sent transactions when Sent tab is clicked", async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByTestId("txn-row-sent-1"))

    await user.click(screen.getByRole("button", { name: /^sent$/i }))

    expect(screen.getByTestId("txn-row-sent-1")).toBeInTheDocument()
    expect(screen.queryByTestId("txn-row-received-1")).not.toBeInTheDocument()
    expect(screen.queryByTestId("txn-row-deposit-1")).not.toBeInTheDocument()
  })

  it("filters to only deposits when Deposits tab is clicked", async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByTestId("txn-row-deposit-1"))

    await user.click(screen.getByRole("button", { name: /deposits/i }))

    expect(screen.getByTestId("txn-row-deposit-1")).toBeInTheDocument()
    expect(screen.queryByTestId("txn-row-sent-1")).not.toBeInTheDocument()
    expect(screen.queryByTestId("txn-row-received-1")).not.toBeInTheDocument()
  })

  it("hides transactions that don't match the search term", async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByTestId("txn-row-sent-1"))

    await user.type(screen.getByPlaceholderText(/search by note or reference/i), "lunch")

    expect(screen.getByTestId("txn-row-sent-1")).toBeInTheDocument()
    expect(screen.queryByTestId("txn-row-received-1")).not.toBeInTheDocument()
    expect(screen.queryByTestId("txn-row-deposit-1")).not.toBeInTheDocument()
  })

  it("shows 'No matching transactions' when search finds nothing", async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByTestId("txn-row-sent-1"))

    await user.type(screen.getByPlaceholderText(/search by note or reference/i), "zzznomatch")

    await waitFor(() => expect(screen.getByText(/no matching transactions/i)).toBeInTheDocument())
  })

  it("groups today's transactions under a 'Today' label", async () => {
    renderPage()
    await waitFor(() => screen.getByTestId("txn-row-sent-1"))
    expect(screen.getByText("Today")).toBeInTheDocument()
  })

  it("shows SendMoneyModal when Send money button is clicked", async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => screen.getByRole("button", { name: /send money/i }))
    await user.click(screen.getByRole("button", { name: /send money/i }))
    expect(screen.getByTestId("send-money-modal")).toBeInTheDocument()
  })
})
