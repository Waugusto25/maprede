import { Link } from 'react-router-dom'

export function Legal({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-8">
      <h1 className="text-2xl font-semibold">{titulo}</h1>
      <p className="text-muted-foreground">{texto}</p>
      <Link to="/login" className="text-primary underline">Voltar ao login</Link>
    </main>
  )
}
