import { describe, it, expect, beforeEach, afterEach } from "vitest"
import MockAdapter from "axios-mock-adapter"
import { apiClient } from "./client"

const mock = new MockAdapter(apiClient)

beforeEach(() => {
  mock.reset()
  localStorage.clear()
  Object.defineProperty(window, "location", {
    value: { href: "" },
    writable: true,
    configurable: true,
  })
})

afterEach(() => {
  mock.reset()
})

describe("request interceptor", () => {
  it("attaches Authorization header when token is in localStorage", async () => {
    localStorage.setItem("flowpay_token", "test-token-123")
    mock.onGet("/test").reply(200, {})

    await apiClient.get("/test")

    expect(mock.history.get[0].headers?.Authorization).toBe("Bearer test-token-123")
  })

  it("does not attach Authorization header when no token stored", async () => {
    mock.onGet("/test").reply(200, {})

    await apiClient.get("/test")

    expect(mock.history.get[0].headers?.Authorization).toBeUndefined()
  })
})

describe("response interceptor", () => {
  it("on 401 clears both localStorage keys and rejects with Session expired", async () => {
    localStorage.setItem("flowpay_token", "tok")
    localStorage.setItem("flowpay_user", JSON.stringify({ id: "1" }))
    mock.onGet("/test").reply(401)

    await expect(apiClient.get("/test")).rejects.toThrow("Session expired")
    expect(localStorage.getItem("flowpay_token")).toBeNull()
    expect(localStorage.getItem("flowpay_user")).toBeNull()
  })

  it("on 401 from /auth/login does not clear storage or redirect", async () => {
    localStorage.setItem("flowpay_token", "tok")
    localStorage.setItem("flowpay_user", JSON.stringify({ id: "1" }))
    mock.onPost("/auth/login").reply(401, { error: "invalid email or password" })

    await expect(apiClient.post("/auth/login", {})).rejects.toThrow("invalid email or password")
    expect(localStorage.getItem("flowpay_token")).toBe("tok")
    expect(localStorage.getItem("flowpay_user")).not.toBeNull()
    expect(window.location.href).not.toBe("/")
  })

  it("on 401 from /auth/register does not clear storage or redirect", async () => {
    mock.onPost("/auth/register").reply(401, { error: "unauthorized" })

    await expect(apiClient.post("/auth/register", {})).rejects.toThrow("unauthorized")
    expect(window.location.href).not.toBe("/")
  })

  it("extracts error message from response data.error", async () => {
    mock.onGet("/test").reply(400, { error: "insufficient funds" })

    await expect(apiClient.get("/test")).rejects.toThrow("insufficient funds")
  })

  it("falls back to axios error message when response has no data.error", async () => {
    mock.onGet("/test").reply(500, {})

    await expect(apiClient.get("/test")).rejects.toThrow()
  })
})
