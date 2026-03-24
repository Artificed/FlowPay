import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import ProtectedRoute from "@/components/layout/protected-route"
import AppLayout from "@/components/layout/app-layout"
import LoginPage from "@/pages/login-page"
import RegisterPage from "@/pages/register-page"
import HomePage from "@/pages/home-page"
import TransactionsPage from "@/pages/transactions-page"
import ScheduledPage from "@/pages/scheduled-page"
import ProfilePage from "@/pages/profile-page"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="home" replace />} />
          <Route path="home" element={<HomePage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="scheduled" element={<ScheduledPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
        <Route path="/dashboard" element={<Navigate to="/app/home" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
