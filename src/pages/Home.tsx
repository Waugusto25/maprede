import { Link, Navigate } from 'react-router-dom'
import { LogOut, ShieldCheck, Clock, Ban } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'

export default function Home() {
  const { usuario, carregando, isAdmin, sair } = useAuth()
  if (carregando) return <div className="grid min-h-svh place-items-center">Carregando…</div>
  if (!usuario) return <Navigate to="/login" replace />

  if (usuario.status !== 'aprovado') {
    const bloq = usuario.status === 'bloqueado'
    return (
      <div className="grid min-h-svh place-items-center p-6">
        <div role="dialog" aria-modal="true" className="max-w-sm space-y-4 rounded-xl border p-6 text-center">
          {bloq ? <Ban className="mx-auto size-10 text-destructive" /> : <Clock className="mx-auto size-10 text-amber-500" />}
          <h2 className="text-lg font-semibold">{bloq ? 'Sistema em manutenção' : usuario.status === 'rejeitado' ? 'Acesso rejeitado' : 'Aguardando aprovação'}</h2>
          <p className="text-sm text-muted-foreground">
            {bloq ? 'Seu acesso está temporariamente indisponível.' : 'O administrador analisará sua solicitação.'}
          </p>
          <Button variant="outline" onClick={sair}>Sair</Button>
        </div>
      </div>
    )
  }
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-8">
      <h1 className="text-2xl font-semibold">Olá, {usuario.nome}</h1>
      <p className="text-muted-foreground">Acesso aprovado. Os módulos de mapa, viabilidade e diagrama unifilar serão as próximas etapas.</p>
      <div className="flex gap-2">
        {isAdmin && <Button asChild><Link to="/admin"><ShieldCheck /> Painel Admin</Link></Button>}
        <Button variant="outline" onClick={sair}><LogOut /> Sair</Button>
      </div>
    </main>
  )
}
