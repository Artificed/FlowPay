import axios, { type AxiosRequestConfig } from "axios"

const TOKEN_KEY = "flowpay_token"

export const http = axios.create({
  baseURL: "",
  timeout: 15_000,
  headers: {
    "Content-Type": "application/json",
  },
})

http.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

http.interceptors.response.use(
  (res) => res,
  (err) => {
    const message = err.response?.data?.error ?? err.message ?? "Request failed"
    return Promise.reject(new Error(message))
  }
)

export type { AxiosRequestConfig }
