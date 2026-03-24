import { api } from "@/lib/api"
import type { AuthResult } from "./types"

export const authService = {
  register: (body: { email: string; password: string; display_name: string }) =>
    api.post<AuthResult>("/auth/register", body).then((r) => r.data),

  login: (body: { email: string; password: string }) =>
    api.post<AuthResult>("/auth/login", body).then((r) => r.data),
}
