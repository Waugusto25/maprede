import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/lib/auth'

export default function Admin() {
  const { isAdmin, usuarios, setStatus, adminEmail, setAdminEmail } = useAuth()
  const [email, setEmail] = useState(adminEmail)
  if (!isAdmin) return <Navigate to="/" replace />
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Painel do Administrador</h1>
        <Button variant="outline" asChild><Link to="/">Voltar</Link></Button>
      </div>
      <section className="space-y-2 rounded-lg border p-4">
        <h2 className="font-medium">E-mail do Admin</h2>
        <div className="flex gap-2">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button onClick={() => { if (confirm('Alterar o e-mail do administrador?')) { setAdminEmail(email); toast.success('Atualizado') } }}>Salvar</Button>
        </div>
      </section>
      <section className="space-y-2">
        <h2 className="font-medium">Usuários</h2>
        {usuarios.map((u) => (
          <div key={u.email} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
            <div><p className="text-sm font-medium">{u.nome}</p><p className="text-xs text-muted-foreground">{u.email} · {u.status}</p></div>
            {u.email !== adminEmail && (
              <div className="flex gap-1">
                <Button size="sm" onClick={() => setStatus(u.email, 'aprovado')}>Aprovar</Button>
                <Button size="sm" variant="secondary" onClick={() => setStatus(u.email, 'rejeitado')}>Rejeitar</Button>
                <Button size="sm" variant="destructive" onClick={() => setStatus(u.email, 'bloqueado')}>Bloquear</Button>
              </div>
            )}
          </div>
        ))}
      </section>
    </main>
  )
}
