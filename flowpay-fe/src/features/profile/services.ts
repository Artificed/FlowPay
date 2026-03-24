import { apiClient } from "@/shared/lib/api/client"
import type { User } from "@/features/auth/types"

export const profileService = {
  async uploadAvatar(file: File): Promise<User> {
    const form = new FormData()
    form.append("file", file)
    return apiClient.put<User>("/profile/avatar", form).then((r) => r.data)
  },

  async removeAvatar(): Promise<void> {
    await apiClient.delete("/profile/avatar")
  },

  async updateProfile(data: { display_name: string }): Promise<User> {
    return apiClient.patch<User>("/profile", data).then((r) => r.data)
  },

  async changePassword(data: { current_password: string; new_password: string }): Promise<void> {
    await apiClient.patch("/profile/password", data)
  },
}
