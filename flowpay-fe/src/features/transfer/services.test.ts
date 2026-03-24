import { describe, it, expect, afterEach } from "vitest"
import MockAdapter from "axios-mock-adapter"
import { api } from "@/lib/api"
import { transferService } from "./services"

const mock = new MockAdapter(api)

afterEach(() => mock.reset())

const mockTxn = {
  id: "t1",
  reference_code: "FP-20260320-ABCD1234",
  sender_wallet_id: "w1",
  recipient_wallet_id: "w2",
  amount: 5000,
  currency: "USD",
  status: "completed",
  note: "",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

describe("transferService.createTransfer", () => {
  it("POST /api/transfers with Idempotency-Key header", async () => {
    mock.onPost("/transfers").reply(201, mockTxn)

    const result = await transferService.createTransfer(
      { recipient_wallet_id: "w2", amount: 5000, currency: "USD" },
      "idem-key-abc",
    )

    expect(result.id).toBe("t1")
    expect(mock.history.post[0].headers?.["Idempotency-Key"]).toBe("idem-key-abc")
  })

  it("propagates business error from server", async () => {
    mock.onPost("/transfers").reply(422, { error: "insufficient funds" })

    await expect(
      transferService.createTransfer({ recipient_wallet_id: "w2", amount: 99999999, currency: "USD" }, "key"),
    ).rejects.toThrow("insufficient funds")
  })
})

describe("transferService.listTransfers", () => {
  it("GET /api/transfers and returns paginated result", async () => {
    mock.onGet("/transfers").reply(200, { data: [mockTxn], total: 1 })

    const result = await transferService.listTransfers({ limit: 10, offset: 0 })

    expect(result.data).toHaveLength(1)
    expect(result.total).toBe(1)
    expect(result.data[0].reference_code).toBe("FP-20260320-ABCD1234")
  })

  it("passes limit and offset as query params", async () => {
    mock.onGet("/transfers").reply(200, { data: [], total: 0 })

    await transferService.listTransfers({ limit: 5, offset: 10 })

    expect(mock.history.get[0].params).toMatchObject({ limit: 5, offset: 10 })
  })
})

describe("transferService.getTransfer", () => {
  it("GET /api/transfers/:id", async () => {
    mock.onGet("/transfers/t1").reply(200, mockTxn)

    const result = await transferService.getTransfer("t1")

    expect(result.id).toBe("t1")
  })
})
