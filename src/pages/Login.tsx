import { useState } from 'react'
import { toast } from 'sonner'
import { Link, Navigate } from 'react-router-dom'
import { Cable, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'

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
  const { usuario, entrar, cadastrar } = useAuth()
  const [busy, setBusy] = useState(false)
  const [modo, setModo] = useState<'entrar' | 'cadastro'>('entrar')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [nome, setNome] = useState('')
  if (usuario) return <Navigate to="/" replace />

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      if (modo === 'entrar') await entrar(email.trim(), senha)
      else toast.success(await cadastrar(email.trim(), senha, nome.trim()))
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Falha no login') }
    setBusy(false)
  }
  const campo = 'w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400'

  return (
    <main className="grid min-h-svh md:grid-cols-2">
      <section className="flex flex-col justify-between bg-slate-950 p-8 text-slate-100 md:p-14">
        <div className="flex items-center gap-2 text-xl font-bold tracking-widest">
          <Cable className="text-cyan-400" /> MAPREDE
        </div>
        <div className="max-w-sm space-y-6">
          <h1 className="text-3xl font-semibold leading-tight">Engenharia FTTH, GIS e viabilidade de redes em um só lugar.</h1>
          <p className="text-sm text-slate-400">Mapa offline, diagrama unifilar óptico e cálculo de perdas para projetos de fibra.</p>
          <form onSubmit={enviar} className="space-y-3">
            {modo === 'cadastro' && (
              <input className={campo} placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
            )}
            <input className={campo} type="email" placeholder="E-mail" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input className={campo} type="password" placeholder="Senha (mín. 6 caracteres)" autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} minLength={6} value={senha} onChange={(e) => setSenha(e.target.value)} required />
            <Button type="submit" size="lg" className="w-full bg-cyan-500 text-slate-950 hover:bg-cyan-400" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} {modo === 'entrar' ? 'Entrar' : 'Criar conta'}
            </Button>
            <button type="button" className="w-full text-xs text-cyan-400 hover:underline" onClick={() => setModo(modo === 'entrar' ? 'cadastro' : 'entrar')}>
              {modo === 'entrar' ? 'Não tem conta? Criar conta' : 'Já tem conta? Entrar'}
            </button>
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
