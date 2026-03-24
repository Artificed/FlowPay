import axios, { type AxiosRequestConfig } from "axios"

const TOKEN_KEY = "flowpay_token"

export const BASE_URL = "/api"

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: {
    "Content-Type": "application/json",
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const url = err.config?.url ?? ""
      const isAuthRoute = url.includes("/auth/login") || url.includes("/auth/register")
      if (!isAuthRoute) {
        localStorage.removeItem("flowpay_token")
        localStorage.removeItem("flowpay_user")
        window.location.href = "/"
        return Promise.reject(new Error("Session expired"))
      }
    }
    const message = err.response?.data?.error ?? err.message ?? "Request failed"
    return Promise.reject(new Error(message))
  }
)

export type { AxiosRequestConfig }
