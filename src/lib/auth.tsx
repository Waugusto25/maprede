import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { supabase, supabaseConfigurado } from '@/lib/supabase'

export type Status = 'pendente' | 'aprovado' | 'bloqueado'
export interface Usuario { id: string; email: string; nome: string; status: Status; role: 'admin' | 'user'; criado: string }

const K_CACHE = 'maprede.profile'
const DEEP_LINK = 'com.geocampo.app://auth/callback'
const DB_STATUS: Record<string, Status> = { pending: 'pendente', approved: 'aprovado', blocked: 'bloqueado' }
const TO_DB: Record<Status, string> = { pendente: 'pending', aprovado: 'approved', bloqueado: 'blocked' }

export const isNative = () => Capacitor.isNativePlatform()

interface Row { id: string; email: string | null; full_name: string | null; role: string; status: string; created_at: string }
const paraUsuario = (r: Row): Usuario => ({
  id: r.id,
  email: r.email ?? '',
  nome: r.full_name || (r.email ?? '').split('@')[0],
  status: DB_STATUS[r.status] ?? 'pendente',
  role: r.role === 'admin' ? 'admin' : 'user',
  criado: r.created_at,
})

const comTimeout = <T,>(p: PromiseLike<T>, ms: number) =>
  Promise.race([Promise.resolve(p), new Promise<null>((r) => setTimeout(() => r(null), ms))])

interface Ctx {
  carregando: boolean
  usuario: Usuario | null
  usuarios: Usuario[]
  isAdmin: boolean
  entrar: (email: string, senha: string) => Promise<void>
  cadastrar: (email: string, senha: string, nome: string) => Promise<string>
  sair: () => Promise<void>
  setStatus: (id: string, s: Status) => Promise<void>
  recarregarUsuarios: () => Promise<void>
}
const AuthCtx = createContext<Ctx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [carregando, setCarregando] = useState(true)
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])

  const carregarPerfil = useCallback(async (uid: string) => {
    const r = await comTimeout(supabase.from('profiles').select('*').eq('id', uid).maybeSingle(), 3000)
    if (r && r.data) {
      const u = paraUsuario(r.data as Row)
      setUsuario(u)
      localStorage.setItem(K_CACHE, JSON.stringify(u))
    } else {
      // offline: usa último perfil conhecido
      try {
        const c = localStorage.getItem(K_CACHE)
        if (c) { const u = JSON.parse(c) as Usuario; if (u.id === uid) setUsuario(u) }
      } catch { /* ignora */ }
    }
  }, [])

  useEffect(() => {
    let vivo = true
    const fim = setTimeout(() => { if (vivo) setCarregando(false) }, 3000)
    ;(async () => {
      try {
        const r = await comTimeout(supabase.auth.getSession(), 3000)
        const sess = r?.data.session
        if (sess) await carregarPerfil(sess.user.id)
      } catch { /* offline */ }
      if (vivo) setCarregando(false)
    })()

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!s) { setUsuario(null); return }
      setTimeout(() => { void carregarPerfil(s.user.id) }, 0)
    })

    let remover: (() => void) | undefined
    if (isNative()) {
      void CapApp.addListener('appUrlOpen', async ({ url }) => {
        if (!url.startsWith(DEEP_LINK)) return
        try { await Browser.close() } catch { /* ignora */ }
        const u = new URL(url.replace('#', '?'))
        const code = u.searchParams.get('code')
        const at = u.searchParams.get('access_token')
        const rt = u.searchParams.get('refresh_token')
        if (code) await supabase.auth.exchangeCodeForSession(code)
        else if (at && rt) await supabase.auth.setSession({ access_token: at, refresh_token: rt })
      }).then((h) => { remover = () => { void h.remove() } })
    }
    return () => { vivo = false; clearTimeout(fim); sub.subscription.unsubscribe(); remover?.() }
  }, [carregarPerfil])

  const entrar = async (email: string, senha: string) => {
    if (!supabaseConfigurado) throw new Error('Supabase não configurado (VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY).')
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) throw error
  }

  const cadastrar = async (email: string, senha: string, nome: string) => {
    if (!supabaseConfigurado) throw new Error('Supabase não configurado (VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY).')
    const { data, error } = await supabase.auth.signUp({ email, password: senha, options: { data: { full_name: nome } } })
    if (error) throw error
    return data.session ? 'Conta criada.' : 'Conta criada. Confirme o e-mail, se solicitado, e entre.'
  }

  const sair = async () => {
    localStorage.removeItem(K_CACHE)
    setUsuario(null)
    try { await supabase.auth.signOut() } catch { /* offline */ }
  }

  const recarregarUsuarios = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    setUsuarios(((data ?? []) as Row[]).map(paraUsuario))
  }, [])

  const setStatus = async (id: string, s: Status) => {
    const { error } = await supabase.from('profiles').update({ status: TO_DB[s] }).eq('id', id)
    if (error) throw error
    await recarregarUsuarios()
  }

  const isAdmin = usuario?.role === 'admin' && usuario.status === 'aprovado'
  return (
    <AuthCtx.Provider value={{ carregando, usuario, usuarios, isAdmin, entrar, cadastrar, sair, setStatus, recarregarUsuarios }}>
      {children}
    </AuthCtx.Provider>
  )
}

export function useAuth() {
  const c = useContext(AuthCtx)
  if (!c) throw new Error('useAuth fora do AuthProvider')
  return c
}
