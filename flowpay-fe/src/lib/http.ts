import axios, { type AxiosRequestConfig } from "axios"

export const http = axios.create({
  baseURL: "",
  headers: {
    "Content-Type": "application/json",
  },
})

http.interceptors.response.use(
  (res) => res,
  (err) => {
    const message = err.response?.data?.error ?? err.message ?? "Request failed"
    return Promise.reject(new Error(message))
  }
)

export function setAuthToken(token: string | null) {
  if (token) {
    http.defaults.headers.common["Authorization"] = `Bearer ${token}`
  } else {
    delete http.defaults.headers.common["Authorization"]
  }
}

export type { AxiosRequestConfig }
