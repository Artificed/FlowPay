import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { useCurrencies } from "./use-currencies"
import { walletService } from "./services"

vi.mock("./services")

const mockCurrencies = [
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
]

describe("use-currencies", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("returns empty currencies and no error initially", () => {
    vi.mocked(walletService.getCurrencies).mockResolvedValue([])
    const { result } = renderHook(() => useCurrencies())
    expect(result.current.currencies).toHaveLength(0)
    expect(result.current.currencyError).toBeNull()
  })

  it("populates currencies on successful fetch", async () => {
    vi.mocked(walletService.getCurrencies).mockResolvedValue(mockCurrencies)
    const { result } = renderHook(() => useCurrencies())

    await waitFor(() => expect(result.current.currencies).toHaveLength(2))
    expect(result.current.currencies[0].code).toBe("USD")
    expect(result.current.currencyError).toBeNull()
  })

  it("sets currencyError when fetch fails", async () => {
    vi.mocked(walletService.getCurrencies).mockRejectedValue(new Error("Network error"))
    const { result } = renderHook(() => useCurrencies())

    await waitFor(() => expect(result.current.currencyError).toBe("Network error"))
    expect(result.current.currencies).toHaveLength(0)
  })

  it("sets generic message when error is not an Error instance", async () => {
    vi.mocked(walletService.getCurrencies).mockRejectedValue("oops")
    const { result } = renderHook(() => useCurrencies())

    await waitFor(() => expect(result.current.currencyError).toBe("Failed to load currencies"))
  })
})
