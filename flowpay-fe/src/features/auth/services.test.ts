import { describe, it, expect, afterEach } from "vitest"
import MockAdapter from "axios-mock-adapter"
import { api } from "@/lib/api"
import { authService } from "./services"

const mock = new MockAdapter(api)

afterEach(() => mock.reset())

const mockAuthResult = {
  token: "jwt-token",
  user: { id: "u1", email: "dummy@google.com", display_name: "Dummy" },
}

describe("authService.login", () => {
  it("posts to /api/auth/login and returns auth result", async () => {
    mock.onPost("/auth/login").reply(200, mockAuthResult)

    const result = await authService.login({ email: "dummy@google.com", password: "password" })

    expect(result.token).toBe("jwt-token")
    expect(result.user.display_name).toBe("Dummy")

    const body = JSON.parse(mock.history.post[0].data)
    expect(body.email).toBe("dummy@google.com")
    expect(body.password).toBe("password")
  })

  it("propagates error message from server", async () => {
    mock.onPost("/auth/login").reply(422, { error: "invalid email or password" })

    await expect(authService.login({ email: "a@b.com", password: "wrong" })).rejects.toThrow(
      "invalid email or password",
    )
  })
})

describe("authService.register", () => {
  it("posts to /api/auth/register and returns auth result", async () => {
    mock.onPost("/auth/register").reply(201, mockAuthResult)

    const result = await authService.register({
      email: "dummy@google.com",
      password: "password123",
      display_name: "Dummy",
    })

    expect(result.token).toBe("jwt-token")

    const body = JSON.parse(mock.history.post[0].data)
    expect(body.display_name).toBe("Dummy")
  })

  it("propagates conflict error when email is already taken", async () => {
    mock.onPost("/auth/register").reply(409, { error: "email already in use" })

    await expect(
      authService.register({ email: "taken@google.com", password: "pass", display_name: "Test" }),
    ).rejects.toThrow("email already in use")
  })
})
