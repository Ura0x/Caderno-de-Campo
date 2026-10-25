import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { Layout } from './components/Layout'
import { Button, ErrorText, PageLoader } from './components/ui'
import { useIsAllowed } from './lib/api'
import { signOut, useAuth } from './lib/auth'
import { isSupabaseConfigured } from './lib/supabase'
import { LoginPage } from './pages/LoginPage'
import { RegistryPage } from './pages/RegistryPage'
import { SheetEditorPage } from './pages/SheetEditorPage'
import { SheetsPage } from './pages/SheetsPage'

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const allowed = useIsAllowed(session?.user.id)
  if (loading) return <PageLoader />
  if (!session) return <Navigate to="/login" replace />
  if (allowed.isPending) return <PageLoader />
  if (allowed.error) return <AccessProblem email={session.user.email} error={allowed.error} />
  if (!allowed.data) return <AccessProblem email={session.user.email} />
  return children
}

/** Conta logada fora da lista de acesso (ou falha ao verificar). */
function AccessProblem({ email, error }: { email?: string; error?: unknown }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
          <Lock size={26} />
        </div>
        <h1 className="text-lg font-semibold text-slate-900">Acesso não liberado</h1>
        {error ? (
          <div className="mt-3">
            <ErrorText error={error} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            O e-mail <b className="text-slate-700">{email}</b> ainda não tem acesso. Peça ao administrador para liberá-lo.
          </p>
        )}
        <Button className="mt-6 w-full justify-center" onClick={signOut}>
          Sair e entrar com outra conta
        </Button>
      </div>
    </div>
  )
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
