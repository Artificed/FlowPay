import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import ProtectedRoute from "@/components/layout/ProtectedRoute"
import AppLayout from "@/components/layout/AppLayout"
import LoginPage from "@/pages/LoginPage"
import RegisterPage from "@/pages/RegisterPage"
import HomePage from "@/pages/HomePage"
import TransactionsPage from "@/pages/TransactionsPage"
import ScheduledPage from "@/pages/ScheduledPage"
import ProfilePage from "@/pages/ProfilePage"

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
