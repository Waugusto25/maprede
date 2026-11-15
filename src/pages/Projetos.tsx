import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Download, Folder, FolderPlus, MapPin, Plus, Trash2, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { carregarItens, type Item, type Tipo } from '@/lib/projeto'

interface Proj { id: string; name: string; escopo: string; pasta: string | null; created_at: string }

const btn = 'inline-flex items-center gap-1.5 rounded-md bg-[#f97316] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#ea580c]'
const btn2 = 'rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700'

function baixar(nome: string, texto: string, mime: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([texto], { type: mime }))
  a.download = nome
  a.click()
}

function paraGeoJSON(itens: Item[]) {
  return {
    type: 'FeatureCollection',
    features: itens.map((i) => ({
      type: 'Feature',
      properties: { name: i.nome, pasta: i.pasta, tipo: i.tipo },
      geometry: i.tipo === 'ponto' ? { type: 'Point', coordinates: i.coords[0] } : i.tipo === 'linha' ? { type: 'LineString', coordinates: i.coords } : { type: 'Polygon', coordinates: [[...i.coords, i.coords[0]]] },
    })),
  }
}

type Feat = { properties?: Record<string, unknown> | null; geometry?: { type: string; coordinates: unknown } | null }

function deGeoJSON(texto: string): Item[] {
  const j = JSON.parse(texto) as { features?: Feat[] } & Feat
  const fs: Feat[] = j.features ?? [j]
  const out: Item[] = []
  fs.forEach((f, n) => {
    const g = f.geometry
    if (!g) return
    const nome = String(f.properties?.name ?? f.properties?.nome ?? `Item ${n + 1}`)
    const mk = (tipo: Tipo, coords: [number, number][]) => out.push({ id: crypto.randomUUID(), nome, tipo, pasta: 'Importados', coords })
    const c = g.coordinates as number[] & number[][] & number[][][]
    if (g.type === 'Point') mk('ponto', [[c[0], c[1]]])
    else if (g.type === 'LineString') mk('linha', (c as number[][]).map((p) => [p[0], p[1]]))
    else if (g.type === 'Polygon') mk('poligono', (c as unknown as number[][][])[0].slice(0, -1).map((p) => [p[0], p[1]]))
  })
  return out
}

function deCSV(texto: string): Item[] {
  const linhas = texto.split(/\r?\n/).filter(Boolean)
  const sep = linhas[0].includes(';') ? ';' : ','
  const cab = linhas[0].toLowerCase().split(sep).map((s) => s.trim())
  const ilat = cab.findIndex((c) => c.startsWith('lat'))
  const ilon = cab.findIndex((c) => c.startsWith('lon') || c === 'lng')
  const inome = cab.findIndex((c) => c === 'nome' || c === 'name')
  if (ilat < 0 || ilon < 0) throw new Error('CSV precisa das colunas lat e lon')
  return linhas.slice(1).flatMap((l, n) => {
    const p = l.split(sep)
    const lat = Number(p[ilat].replace(',', '.'))
    const lon = Number(p[ilon].replace(',', '.'))
    if (isNaN(lat) || isNaN(lon)) return []
    return [{ id: crypto.randomUUID(), nome: inome >= 0 ? p[inome] : `Ponto ${n + 1}`, tipo: 'ponto' as Tipo, pasta: 'Importados', coords: [[lon, lat]] as [number, number][] }]
  })
}

export default function Projetos() {
  const nav = useNavigate()
  const [lista, setLista] = useState<Proj[]>([])
  const [busca, setBusca] = useState('')
  const [ordem, setOrdem] = useState<'nome' | 'data'>('data')
  const [carregando, setCarregando] = useState(true)
  const arq = useRef<HTMLInputElement>(null)

  const recarregar = useCallback(async () => {
    const { data } = await supabase.from('projects').select('id,name,escopo,pasta,created_at')
    setLista((data ?? []) as Proj[])
    setCarregando(false)
  }, [])
  useEffect(() => { void recarregar() }, [recarregar])

  const filtrada = useMemo(() => {
    const l = lista.filter((p) => (p.name + (p.pasta ?? '')).toLowerCase().includes(busca.toLowerCase()))
    return l.sort((a, b) => (ordem === 'nome' ? a.name.localeCompare(b.name) : b.created_at.localeCompare(a.created_at)))
  }, [lista, busca, ordem])

  async function criar(escopo: string) {
    const name = prompt('Nome do projeto')?.trim()
    if (!name) return
    const pasta = prompt('Pasta (opcional)')?.trim() || null
    const { error } = await supabase.from('projects').insert({ name, escopo, pasta })
    if (error) toast.error(error.message)
    else void recarregar()
  }

  async function novaPasta(escopo: string) {
    const pasta = prompt('Nome da pasta')?.trim()
    if (!pasta) return
    const { error } = await supabase.from('projects').insert({ name: 'Novo projeto', escopo, pasta })
    if (error) toast.error(error.message)
    else void recarregar()
  }

  async function apagar(p: Proj) {
    if (!confirm(`Apagar "${p.name}" e todos os seus itens?`)) return
    await supabase.from('project_items').delete().eq('project_id', p.id)
    await supabase.from('projects').delete().eq('id', p.id)
    void recarregar()
  }

  async function exportar(p: Proj, fmt: 'geojson' | 'csv') {
    const itens = await carregarItens(p.id)
    if (fmt === 'geojson') baixar(`${p.name}.geojson`, JSON.stringify(paraGeoJSON(itens)), 'application/geo+json')
    else baixar(`${p.name}.csv`, 'nome;tipo;pasta;lat;lon\n' + itens.map((i) => `${i.nome};${i.tipo};${i.pasta};${i.coords[0]?.[1] ?? ''};${i.coords[0]?.[0] ?? ''}`).join('\n'), 'text/csv')
  }

  async function importar(f: File, escopo: string) {
    try {
      const ext = f.name.split('.').pop()?.toLowerCase()
      if (ext !== 'geojson' && ext !== 'json' && ext !== 'csv') throw new Error('Formato ainda não suportado. Use GeoJSON ou CSV.')
      const texto = await f.text()
      const itens = ext === 'csv' ? deCSV(texto) : deGeoJSON(texto)
      if (!itens.length) throw new Error('Nenhum item encontrado no arquivo')
      const { data, error } = await supabase.from('projects').insert({ name: f.name.replace(/\.[^.]+$/, ''), escopo }).select('id').single()
      if (error || !data) throw new Error(error?.message ?? 'Falha ao criar projeto')
      const pid = (data as { id: string }).id
      const { error: e2 } = await supabase.from('project_items').insert(itens.map((i) => ({ id: i.id, project_id: pid, type: i.tipo, name: i.nome, geometry: { coords: i.coords }, properties: { pasta: i.pasta } })))
      if (e2) throw new Error(e2.message)
      toast.success(`${itens.length} itens importados`)
      void recarregar()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const alvo = useRef('pessoal')

  function coluna(titulo: string, escopo: string) {
    const ps = filtrada.filter((p) => p.escopo === escopo)
    const pastas = [...new Set(ps.map((p) => p.pasta ?? ''))].sort()
    return (
      <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-700 bg-[#1e293b] p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto font-semibold text-white">{titulo}</h2>
          <button className={btn} onClick={() => void criar(escopo)}><Plus className="size-4" />Projeto</button>
          <button className={btn} onClick={() => void novaPasta(escopo)}><FolderPlus className="size-4" />Pasta</button>
          <button className={btn} onClick={() => { alvo.current = escopo; arq.current?.click() }}><Upload className="size-4" />Importar Arquivo</button>
        </div>
        <div className="space-y-3 overflow-auto">
          {carregando && <p className="text-sm text-slate-400">Carregando…</p>}
          {!carregando && !ps.length && <p className="text-sm text-slate-400">Nenhum projeto.</p>}
          {pastas.map((pa) => (
            <div key={pa}>
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase text-[#f97316]"><Folder className="size-3.5" />{pa || 'Sem pasta'}</div>
              <ul className="space-y-1">
                {ps.filter((p) => (p.pasta ?? '') === pa).map((p) => (
                  <li key={p.id} className="flex items-center gap-2 rounded-md bg-[#0f172a] px-3 py-2 text-sm text-slate-100">
                    <button className="flex flex-1 items-center gap-2 text-left hover:text-[#f97316]" onClick={() => nav(`/?p=${p.id}`)}>
                      <MapPin className="size-4" />{p.name}
                      <span className="ml-auto text-xs text-slate-500">{new Date(p.created_at).toLocaleDateString('pt-BR')}</span>
                    </button>
                    <button className={btn2} title="Exportar GeoJSON" onClick={() => void exportar(p, 'geojson')}><Download className="inline size-3" /> GeoJSON</button>
                    <button className={btn2} title="Exportar CSV" onClick={() => void exportar(p, 'csv')}>CSV</button>
                    <button className={btn2} title="Apagar" onClick={() => void apagar(p)}><Trash2 className="size-3" /></button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
      <div className="flex gap-2">
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar projeto ou pasta" className="flex-1 rounded-md border border-slate-600 bg-[#1e293b] px-3 py-2 text-sm text-white placeholder:text-slate-400" />
        <select value={ordem} onChange={(e) => setOrdem(e.target.value as 'nome' | 'data')} className="rounded-md border border-slate-600 bg-[#1e293b] px-2 text-sm text-white">
          <option value="data">Mais recentes</option>
          <option value="nome">Nome (A-Z)</option>
        </select>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 md:flex-row">
        {coluna('Projetos da Empresa', 'empresa')}
        {coluna('Projetos Pessoais', 'pessoal')}
      </div>
      <input ref={arq} type="file" accept=".geojson,.json,.csv,.kml,.kmz,.shp,.xlsx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importar(f, alvo.current); e.target.value = '' }} />
    </div>
  )
}
