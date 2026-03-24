import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import ProtectedRoute from "@/components/layout/protected-route"
import AppLayout from "@/components/layout/app-layout"
import Login from "@/pages/login"
import Register from "@/pages/register"
import Home from "@/pages/home"
import Transactions from "@/pages/transactions"
import Scheduled from "@/pages/scheduled"
import Profile from "@/pages/profile"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="home" replace />} />
          <Route path="home" element={<Home />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="scheduled" element={<Scheduled />} />
          <Route path="profile" element={<Profile />} />
        </Route>
        <Route path="/dashboard" element={<Navigate to="/app/home" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
