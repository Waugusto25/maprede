import { supabase, supabaseConfigurado } from '@/lib/supabase'

export type Tipo = 'ponto' | 'linha' | 'poligono'
export interface Item { id: string; nome: string; tipo: Tipo; pasta: string; coords: [number, number][] }

export function distancia(a: [number, number], b: [number, number]): number {
  const r = Math.PI / 180
  const dLat = (b[1] - a[1]) * r
  const dLon = (b[0] - a[0]) * r
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLon / 2) ** 2
  return 12742000 * Math.asin(Math.sqrt(h))
}

export function comprimento(coords: [number, number][]): number {
  let t = 0
  for (let i = 1; i < coords.length; i++) t += distancia(coords[i - 1], coords[i])
  return t
}

export const fmtM = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`)

export async function projetoPadrao(): Promise<string | null> {
  if (!supabaseConfigurado) return null
  const { data } = await supabase.from('projects').select('id').order('created_at').limit(1)
  if (data && data[0]) return (data[0] as { id: string }).id
  const { data: novo } = await supabase.from('projects').insert({ name: 'Meu projeto' }).select('id').single()
  return novo ? (novo as { id: string }).id : null
}

export async function carregarItens(pid: string): Promise<Item[]> {
  const { data } = await supabase.from('project_items').select('id,name,type,geometry,properties').eq('project_id', pid).in('type', ['ponto', 'linha', 'poligono'])
  return ((data ?? []) as { id: string; name: string; type: Tipo; geometry: { coords?: [number, number][] } | null; properties: { pasta?: string } }[])
    .map((r) => ({ id: r.id, nome: r.name, tipo: r.type, pasta: r.properties?.pasta ?? 'Itens', coords: r.geometry?.coords ?? [] }))
}

export async function salvarItens(pid: string, itens: Item[], antigos: string[]): Promise<void> {
  const ids = new Set(itens.map((i) => i.id))
  const apagar = antigos.filter((id) => !ids.has(id))
  if (apagar.length) await supabase.from('project_items').delete().in('id', apagar)
  if (itens.length) {
    await supabase.from('project_items').upsert(itens.map((i) => ({ id: i.id, project_id: pid, type: i.tipo, name: i.nome, geometry: { coords: i.coords }, properties: { pasta: i.pasta } })))
  }
}
