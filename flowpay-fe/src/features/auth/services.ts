import { http } from "@/lib/http"
import type { AuthResult } from "./types"

export const authService = {
  register: (body: { email: string; password: string; display_name: string }) =>
    http.post<AuthResult>("/api/auth/register", body).then((r) => r.data),

  login: (body: { email: string; password: string }) =>
    http.post<AuthResult>("/api/auth/login", body).then((r) => r.data),
}
