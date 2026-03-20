import { describe, it, expect, afterEach } from "vitest"
import MockAdapter from "axios-mock-adapter"
import { http } from "@/lib/http"
import { authService } from "./services"

const mock = new MockAdapter(http)

afterEach(() => mock.reset())

const mockAuthResult = {
  token: "jwt-token",
  user: { id: "u1", email: "alice@example.com", display_name: "Alice" },
}

describe("authService.login", () => {
  it("posts to /api/v1/auth/login and returns auth result", async () => {
    mock.onPost("/api/v1/auth/login").reply(200, mockAuthResult)

    const result = await authService.login({ email: "alice@example.com", password: "password" })

    expect(result.token).toBe("jwt-token")
    expect(result.user.display_name).toBe("Alice")

    const body = JSON.parse(mock.history.post[0].data)
    expect(body.email).toBe("alice@example.com")
    expect(body.password).toBe("password")
  })

  it("propagates error message from server", async () => {
    mock.onPost("/api/v1/auth/login").reply(422, { error: "invalid email or password" })

    await expect(authService.login({ email: "a@b.com", password: "wrong" })).rejects.toThrow(
      "invalid email or password",
    )
  })
})

describe("authService.register", () => {
  it("posts to /api/v1/auth/register and returns auth result", async () => {
    mock.onPost("/api/v1/auth/register").reply(201, mockAuthResult)

    const result = await authService.register({
      email: "alice@example.com",
      password: "password123",
      display_name: "Alice",
    })

    expect(result.token).toBe("jwt-token")

    const body = JSON.parse(mock.history.post[0].data)
    expect(body.display_name).toBe("Alice")
  })

  it("propagates conflict error when email is already taken", async () => {
    mock.onPost("/api/v1/auth/register").reply(409, { error: "email already in use" })

    await expect(
      authService.register({ email: "taken@example.com", password: "pass", display_name: "Bob" }),
    ).rejects.toThrow("email already in use")
  })
})
