export type User = {
  id: string
  email: string
  display_name: string
  created_at: string
  updated_at: string
}

export type AuthResult = {
  token: string
  user: User
}
