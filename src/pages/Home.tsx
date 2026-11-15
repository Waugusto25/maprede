import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { Clock, Ban } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { TopBar } from '@/components/TopBar'
import Mapa from '@/pages/Mapa'

export default function Home({ children }: { children?: ReactNode }) {
  const { usuario, carregando, sair } = useAuth()
  if (carregando) return <div className="grid min-h-svh place-items-center">Carregando…</div>
  if (!usuario) return <Navigate to="/login" replace />

  if (usuario.status !== 'aprovado') {
    const bloq = usuario.status === 'bloqueado'
    return (
      <div className="grid min-h-svh place-items-center p-6">
        <div role="dialog" aria-modal="true" className="max-w-sm space-y-4 rounded-xl border p-6 text-center">
          {bloq ? <Ban className="mx-auto size-10 text-destructive" /> : <Clock className="mx-auto size-10 text-amber-500" />}
          <h2 className="text-lg font-semibold">{bloq ? 'Sistema em manutenção' : 'Aguardando aprovação'}</h2>
          <p className="text-sm text-muted-foreground">
            {bloq ? 'Seu acesso está temporariamente indisponível.' : 'O administrador analisará sua solicitação.'}
          </p>
          <Button variant="outline" onClick={() => void sair()}>Sair</Button>
        </div>
      </div>
    )
  }
  return (
    <div className="flex h-svh w-full flex-col overflow-hidden bg-[#0f172a]">
      <TopBar />
      <main className="relative flex min-h-0 flex-1 flex-col overflow-auto">{children ?? <Mapa />}</main>
    </div>
  )
}
