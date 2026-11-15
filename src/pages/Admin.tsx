import { useEffect } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAuth, type Status } from '@/lib/auth'

export default function Admin() {
  const { isAdmin, carregando, usuario, usuarios, setStatus, recarregarUsuarios } = useAuth()
  useEffect(() => { if (isAdmin) void recarregarUsuarios() }, [isAdmin, recarregarUsuarios])
  if (carregando) return <div className="grid min-h-svh place-items-center">Carregando…</div>
  if (!isAdmin) return <Navigate to="/" replace />
  const mudar = (id: string, s: Status) => setStatus(id, s).then(() => toast.success('Atualizado')).catch((e: Error) => toast.error(e.message))
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Painel do Administrador</h1>
        <Button variant="outline" asChild><Link to="/">Voltar</Link></Button>
      </div>
      <section className="space-y-2">
        <h2 className="font-medium">Usuários</h2>
        {usuarios.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
            <div><p className="text-sm font-medium">{u.nome}</p><p className="text-xs text-muted-foreground">{u.email} · {u.role} · {u.status}</p></div>
            {u.id !== usuario?.id && (
              <div className="flex gap-1">
                <Button size="sm" onClick={() => mudar(u.id, 'aprovado')}>Aprovar</Button>
                <Button size="sm" variant="secondary" onClick={() => mudar(u.id, 'pendente')}>Pendente</Button>
                <Button size="sm" variant="destructive" onClick={() => mudar(u.id, 'bloqueado')}>Bloquear</Button>
              </div>
            )}
          </div>
        ))}
      </section>
    </main>
  )
}
