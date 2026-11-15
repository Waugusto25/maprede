import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { LogOut, Network, Wifi, WifiOff } from 'lucide-react'
import { useAuth } from '@/lib/auth'

const ABAS = [
  { to: '/', label: 'Mapa' },
  { to: '/projetos', label: 'Projetos' },
  { to: '/viabilidade-ftth', label: 'Viabilidade FTTH' },
  { to: '/viabilidade-radio', label: 'Viabilidade Via Rádio' },
  { to: '/viabilidades', label: 'Viabilidades' },
  { to: '/offline', label: 'Mapa Offline' },
  { to: '/diagrama', label: 'Diagrama Unifilar' },
]

export function TopBar() {
  const { usuario, isAdmin, sair } = useAuth()
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true); const off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  const abas = isAdmin ? [...ABAS, { to: '/admin', label: 'Minha Equipe' }] : ABAS
  return (
    <header className="z-30 flex h-14 shrink-0 items-center gap-3 border-b border-slate-700 bg-[#0f172a] px-3 text-slate-200">
      <div className="flex items-center gap-2 font-bold text-white">
        <span className="grid size-8 place-items-center rounded-lg bg-[#f97316]"><Network className="size-5" /></span>
        <span className="hidden sm:inline">MAPREDE</span>
      </div>
      <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
        {abas.map((a) => (
          <NavLink key={a.to} to={a.to} end={a.to === '/'}
            className={({ isActive }) => `whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors ${isActive ? 'bg-[#f97316] font-medium text-white' : 'text-slate-300 hover:bg-[#1e293b]'}`}>
            {a.label}
          </NavLink>
        ))}
      </nav>
      <span className={`hidden items-center gap-1 text-xs md:flex ${online ? 'text-emerald-400' : 'text-amber-400'}`}>
        {online ? <Wifi className="size-4" /> : <WifiOff className="size-4" />}{online ? 'Online' : 'Offline'}
      </span>
      <span className="hidden max-w-32 truncate text-sm lg:inline">{usuario?.nome ?? usuario?.email}</span>
      <button onClick={() => void sair()} className="flex items-center gap-1 rounded-md bg-[#1e293b] px-3 py-1.5 text-sm hover:bg-slate-700"><LogOut className="size-4" /> Sair</button>
    </header>
  )
}

export function EmBreve({ titulo, etapa }: { titulo: string; etapa: number }) {
  return (
    <div className="grid flex-1 place-items-center bg-[#0f172a] p-6 text-center text-slate-300">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-white">{titulo}</h1>
        <p className="text-sm">Este módulo será construído na etapa {etapa}.</p>
      </div>
    </div>
  )
}
