import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AppDataProvider } from './context/AppDataContext'
import Layout from './components/Layout'
import { Spinner } from './components/ui'
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'
import CreditPage from './pages/CreditPage'
import ExpensesPage from './pages/ExpensesPage'
import GaragePage from './pages/GaragePage'

function FullScreenLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#0E1013]">
      <Spinner />
    </div>
  )
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  if (!user) return <Navigate to="/auth" replace />
  return <>{children}</>
}

function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  if (user) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    // HashRouter — для корректной работы роутинга на GitHub Pages без 404-хака
    <HashRouter>
      <AuthProvider>
        <Routes>
          <Route
            path="/auth"
            element={
              <RedirectIfAuthed>
                <AuthPage />
              </RedirectIfAuthed>
            }
          />
          <Route
            element={
              <RequireAuth>
                <AppDataProvider>
                  <Layout />
                </AppDataProvider>
              </RequireAuth>
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route path="/credit" element={<CreditPage />} />
            <Route path="/expenses" element={<ExpensesPage />} />
            <Route path="/garage" element={<GaragePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </HashRouter>
  )
}
