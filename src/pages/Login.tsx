import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Cable, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { isNative, useAuth } from '@/lib/auth'

function ArteFibra() {
  const cores = ['#22d3ee', '#a78bfa', '#34d399', '#f472b6', '#facc15']
  return (
    <svg viewBox="0 0 600 800" className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="bg" cx="50%" cy="40%" r="80%">
          <stop offset="0" stopColor="#1e1b4b" /><stop offset="1" stopColor="#020617" />
        </radialGradient>
        <filter id="glow"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <rect width="600" height="800" fill="url(#bg)" />
      {cores.flatMap((c, i) =>
        [0, 1, 2].map((j) => (
          <path key={`${i}-${j}`} d={`M-20 ${120 + i * 130 + j * 14} C 200 ${40 + i * 160}, 380 ${700 - i * 90}, 640 ${180 + i * 120 + j * 14}`}
            fill="none" stroke={c} strokeWidth={j === 1 ? 3 : 1.2} opacity={j === 1 ? 0.95 : 0.4} filter="url(#glow)" />
        )),
      )}
      {[[170, 330], [300, 420], [420, 300], [250, 580], [460, 560]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="7" fill={cores[i]} filter="url(#glow)" />
      ))}
    </svg>
  )
}

export default function Login() {
  const { usuario, entrar } = useAuth()
  const [email, setEmail] = useState('')
  const [nome, setNome] = useState('')
  const [busy, setBusy] = useState(false)
  if (usuario) return <Navigate to="/" replace />

  const google = async () => {
    setBusy(true)
    // No APK: abrir OAuth com @capacitor/browser e retornar por com.geocampo.app://auth/callback
    // (requer instalar as dependências Capacitor e Supabase). Nesta versão: entrada local de demonstração.
    void isNative()
    setBusy(false)
  }

  return (
    <main className="grid min-h-svh md:grid-cols-2">
      <section className="flex flex-col justify-between bg-slate-950 p-8 text-slate-100 md:p-14">
        <div className="flex items-center gap-2 text-xl font-bold tracking-widest">
          <Cable className="text-cyan-400" /> MAPREDE
        </div>
        <div className="max-w-sm space-y-6">
          <h1 className="text-3xl font-semibold leading-tight">Engenharia FTTH, GIS e viabilidade de redes em um só lugar.</h1>
          <p className="text-sm text-slate-400">Mapa offline, diagrama unifilar óptico e cálculo de perdas para projetos de fibra.</p>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (email) entrar(email, nome || email.split('@')[0]) }}>
            <Input placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} className="bg-slate-900" />
            <Input type="email" required placeholder="E-mail Google" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-slate-900" />
            <Button type="submit" size="lg" className="w-full bg-cyan-500 text-slate-950 hover:bg-cyan-400" onClick={google} disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} Entrar com Google
            </Button>
          </form>
          <p className="text-xs text-slate-500">Novos usuários ficam como “Pendente” até aprovação do administrador.</p>
        </div>
        <footer className="flex gap-4 text-xs text-slate-500">
          <Link to="/privacidade" className="hover:text-slate-300">Privacidade</Link>
          <Link to="/termos" className="hover:text-slate-300">Termos</Link>
        </footer>
      </section>
      <section className="hidden md:block"><ArteFibra /></section>
    </main>
  )
}
