import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { PageLoader } from './components/ui'
import { useAuth } from './lib/auth'
import { isSupabaseConfigured } from './lib/supabase'
import { LoginPage } from './pages/LoginPage'
import { RegistryPage } from './pages/RegistryPage'
import { SheetEditorPage } from './pages/SheetEditorPage'
import { SheetsPage } from './pages/SheetsPage'

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <PageLoader />
  if (!session) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto max-w-md p-8 text-sm text-slate-700">
        <h1 className="mb-2 text-lg font-semibold">Supabase não configurado</h1>
        Copie <code>.env.example</code> para <code>.env</code> e preencha a URL e a chave do projeto.
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<SheetsPage />} />
        <Route path="planilhas/:id" element={<SheetEditorPage />} />
        <Route path="cadastros" element={<RegistryPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
