import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Status = 'pendente' | 'aprovado' | 'rejeitado' | 'bloqueado'
export interface Usuario { email: string; nome: string; status: Status; criado: string }

const K_USERS = 'maprede.users'
const K_SESSION = 'maprede.session'
const K_ADMIN = 'maprede.adminEmail'

const ler = <T,>(k: string, d: T): T => {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d } catch { return d }
}

export const isNative = () =>
  Boolean((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.())

interface Ctx {
  carregando: boolean
  usuario: Usuario | null
  usuarios: Usuario[]
  adminEmail: string
  isAdmin: boolean
  entrar: (email: string, nome: string) => void
  sair: () => void
  setStatus: (email: string, s: Status) => void
  setAdminEmail: (e: string) => void
}
const AuthCtx = createContext<Ctx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [carregando, setCarregando] = useState(true)
  const [usuarios, setUsuarios] = useState<Usuario[]>(() => ler<Usuario[]>(K_USERS, []))
  const [sessao, setSessao] = useState<string | null>(null)
  const [adminEmail, setAdmin] = useState<string>(() => ler<string>(K_ADMIN, ''))

  useEffect(() => {
    // Verificação de sessão com timeout máximo de 3s (nunca trava offline)
    const t = setTimeout(() => setCarregando(false), 3000)
    setSessao(ler<string | null>(K_SESSION, null))
    setCarregando(false)
    return () => clearTimeout(t)
  }, [])

  const salvar = (u: Usuario[]) => { setUsuarios(u); localStorage.setItem(K_USERS, JSON.stringify(u)) }

  const entrar = (email: string, nome: string) => {
    email = email.trim().toLowerCase()
    let lista = usuarios
    if (!lista.find((u) => u.email === email)) {
      // primeiro usuário vira admin se nenhum admin foi configurado
      const ehAdmin = !adminEmail && lista.length === 0
      if (ehAdmin) { setAdmin(email); localStorage.setItem(K_ADMIN, JSON.stringify(email)) }
      lista = [...lista, { email, nome, status: ehAdmin || email === adminEmail ? 'aprovado' : 'pendente', criado: new Date().toISOString() }]
      salvar(lista)
      // TODO: notificação WhatsApp (Evolution API) deve ser disparada por função de servidor
    }
    setSessao(email); localStorage.setItem(K_SESSION, JSON.stringify(email))
  }
  const sair = () => { setSessao(null); localStorage.removeItem(K_SESSION) }
  const setStatus = (email: string, s: Status) => salvar(usuarios.map((u) => (u.email === email ? { ...u, status: s } : u)))
  const setAdminEmail = (e: string) => { e = e.trim().toLowerCase(); setAdmin(e); localStorage.setItem(K_ADMIN, JSON.stringify(e)) }

  const usuario = usuarios.find((u) => u.email === sessao) ?? null
  const isAdmin = !!usuario && usuario.email === adminEmail
  return (
    <AuthCtx.Provider value={{ carregando, usuario, usuarios, adminEmail, isAdmin, entrar, sair, setStatus, setAdminEmail }}>
      {children}
    </AuthCtx.Provider>
  )
}

export function useAuth() {
  const c = useContext(AuthCtx)
  if (!c) throw new Error('useAuth fora do AuthProvider')
  return c
}
