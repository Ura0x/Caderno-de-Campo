import { FileSpreadsheet, LogOut, Sprout, Users } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { signOut, useAuth } from '@/lib/auth'
import { cx } from './ui'

const links = [
  { to: '/', label: 'Planilhas', icon: FileSpreadsheet, end: true },
  { to: '/cadastros', label: 'Cadastros', icon: Users, end: false },
]

export function Layout() {
  const { session } = useAuth()
  const user = session?.user
  const avatar = user?.user_metadata?.avatar_url as string | undefined

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-emerald-900/10 bg-emerald-800 text-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
          <NavLink to="/" className="mr-2 flex items-center gap-2 font-semibold">
            <Sprout size={22} />
            <span className="hidden sm:inline">Caderno de Campo</span>
          </NavLink>
          <nav className="flex gap-1">
            {links.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cx(
                    'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium',
                    isActive ? 'bg-white/15' : 'text-emerald-50/80 hover:bg-white/10',
                  )
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {avatar && <img src={avatar} alt="" className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />}
            <button
              onClick={signOut}
              className="rounded-lg p-2 text-emerald-50/80 hover:bg-white/10"
              title="Sair"
              aria-label="Sair"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5 md:py-8">
        <Outlet />
      </main>
    </div>
  )
}
