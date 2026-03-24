import { apiClient } from "@/shared/lib/api/client"
import type { AuthResult } from "./types"

export const authService = {
  register: (body: { email: string; password: string; display_name: string }) =>
    apiClient.post<AuthResult>("/auth/register", body).then((r) => r.data),

  login: (body: { email: string; password: string }) =>
    apiClient.post<AuthResult>("/auth/login", body).then((r) => r.data),
}
