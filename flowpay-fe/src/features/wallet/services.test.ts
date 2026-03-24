import { describe, it, expect, afterEach } from "vitest"
import MockAdapter from "axios-mock-adapter"
import { apiClient } from "@/shared/lib/api/client"
import { walletService } from "./services"

const mock = new MockAdapter(apiClient)

afterEach(() => mock.reset())

const mockWallet = {
  id: "w1",
  user_id: "u1",
  balances: [{ id: "b1", wallet_id: "w1", currency: "USD", total_amount: 10000, available_amount: 10000 }],
}

describe("walletService.getWallet", () => {
  it("GET /api/wallet and returns wallet", async () => {
    mock.onGet("/wallet").reply(200, mockWallet)

    const wallet = await walletService.getWallet()

    expect(wallet.id).toBe("w1")
    expect(wallet.balances).toHaveLength(1)
    expect(wallet.balances[0].currency).toBe("USD")
  })
})

describe("walletService.deposit", () => {
  it("POST /api/wallet/deposit with amount and currency", async () => {
    const mockBalance = { id: "b1", wallet_id: "w1", currency: "USD", total_amount: 15000, available_amount: 15000 }
    mock.onPost("/wallet/deposit").reply(200, mockBalance)

    const result = await walletService.deposit({ amount: 5000, currency: "USD" })

    expect(result.total_amount).toBe(15000)

    const body = JSON.parse(mock.history.post[0].data)
    expect(body.amount).toBe(5000)
    expect(body.currency).toBe("USD")
  })

  it("propagates error from server", async () => {
    mock.onPost("/wallet/deposit").reply(400, { error: "unsupported currency" })

    await expect(walletService.deposit({ amount: 100, currency: "XYZ" })).rejects.toThrow("unsupported currency")
  })
})

describe("walletService.getCurrencies", () => {
  it("GET /api/currencies and returns list", async () => {
    const currencies = [{ code: "USD", name: "US Dollar" }]
    mock.onGet("/currencies").reply(200, currencies)

    const result = await walletService.getCurrencies()

    expect(result).toHaveLength(1)
    expect(result[0].code).toBe("USD")
  })
})
