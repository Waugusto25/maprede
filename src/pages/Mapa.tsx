import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { PMTiles, Protocol, FileSource } from 'pmtiles'
import { Folder, LogOut, MapPin, Minus, Pentagon, Search, ShieldCheck, Upload, Check, Download, Menu, Workflow } from 'lucide-react'
import { carregarItens, comprimento, fmtM, projetoPadrao, salvarItens } from '@/lib/projeto'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/lib/auth'

type Tipo = 'ponto' | 'linha' | 'poligono'
interface Item { id: string; nome: string; tipo: Tipo; pasta: string; coords: [number, number][] }
type Base = 'vetorial' | 'satelite' | 'relevo'

const raster = (tiles: string[], maxzoom: number, attribution: string): maplibregl.StyleSpecification => ({
  version: 8,
  sources: { base: { type: 'raster', tiles, tileSize: 256, maxzoom, attribution } },
  layers: [{ id: 'base', type: 'raster', source: 'base' }],
})
const ESTILOS: Record<Base, string | maplibregl.StyleSpecification> = {
  vetorial: 'https://tiles.openfreemap.org/styles/liberty',
  satelite: raster(['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], 17, 'Esri'),
  relevo: raster(['https://a.tile.opentopomap.org/{z}/{x}/{y}.png'], 17, 'OpenTopoMap'),
}
const K = 'maprede.itens'

function toGeo(itens: Item[], rascunho: [number, number][], tool: Tipo | null): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = itens.map((i) => ({
    type: 'Feature', properties: { nome: i.nome },
    geometry: i.tipo === 'ponto' ? { type: 'Point', coordinates: i.coords[0] }
      : i.tipo === 'linha' ? { type: 'LineString', coordinates: i.coords }
      : { type: 'Polygon', coordinates: [[...i.coords, i.coords[0]]] },
  }))
  if (tool && tool !== 'ponto') {
    rascunho.forEach((c) => features.push({ type: 'Feature', properties: { nome: '' }, geometry: { type: 'Point', coordinates: c } }))
    if (rascunho.length > 1) features.push({ type: 'Feature', properties: { nome: '' }, geometry: { type: 'LineString', coordinates: rascunho } })
  }
  return { type: 'FeatureCollection', features }
}

export default function Mapa() {
  const { usuario, isAdmin, sair } = useAuth()
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const arq = useRef<HTMLInputElement>(null)
  const [base, setBase] = useState<Base>('vetorial')
  const [itens, setItens] = useState<Item[]>(() => { try { return JSON.parse(localStorage.getItem(K) ?? '[]') as Item[] } catch { return [] } })
  const [tool, setTool] = useState<Tipo | null>(null)
  const [rascunho, setRascunho] = useState<[number, number][]>([])
  const [busca, setBusca] = useState('')
  const itensR = useRef(itens); const toolR = useRef(tool); const rascR = useRef(rascunho)
  const pm = useRef<(() => void)[]>([])
  const proto = useRef<Protocol | null>(null)
  const pid = useRef<string | null>(null)
  const antigos = useRef<string[]>([])
  const pronto = useRef(false)
  const [menu, setMenu] = useState(true)
  itensR.current = itens; toolR.current = tool; rascR.current = rascunho

  const desenhar = useCallback(() => {
    const m = map.current
    if (!m || !m.isStyleLoaded()) return
    const data = toGeo(itensR.current, rascR.current, toolR.current)
    const src = m.getSource('dados') as maplibregl.GeoJSONSource | undefined
    if (src) { src.setData(data); return }
    m.addSource('dados', { type: 'geojson', data })
    m.addLayer({ id: 'dados-fill', type: 'fill', source: 'dados', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': '#22d3ee', 'fill-opacity': 0.25 } })
    m.addLayer({ id: 'dados-line', type: 'line', source: 'dados', filter: ['!=', '$type', 'Point'], paint: { 'line-color': '#06b6d4', 'line-width': 3 } })
    m.addLayer({ id: 'dados-pt', type: 'circle', source: 'dados', filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 6, 'circle-color': '#f43f5e', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } })
    m.addLayer({ id: 'dados-lbl', type: 'symbol', source: 'dados', filter: ['==', '$type', 'Point'], layout: { 'text-field': ['get', 'nome'], 'text-offset': [0, 1.2], 'text-size': 12 }, paint: { 'text-halo-color': '#fff', 'text-halo-width': 1 } })
  }, [])

  useEffect(() => {
    if (!el.current) return
    const protocol = new Protocol()
    proto.current = protocol
    maplibregl.addProtocol('pmtiles', protocol.tile)
    const m = new maplibregl.Map({ container: el.current, style: ESTILOS.vetorial, center: [-46.63, -23.55], zoom: 11, maxZoom: 22 })
    map.current = m
    m.addControl(new maplibregl.NavigationControl(), 'bottom-right')
    m.addControl(new maplibregl.GeolocateControl({ trackUserLocation: true, positionOptions: { enableHighAccuracy: true } }), 'bottom-right')
    let fallback = false
    m.on('error', () => {
      if (fallback || m.isStyleLoaded()) return
      fallback = true
      m.setStyle(raster(['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], 19, '© OpenStreetMap'))
      toast.error('Mapa vetorial indisponível; usando mapa básico')
    })
    m.on('load', () => m.resize())
    setTimeout(() => m.resize(), 300)
    m.on('style.load', () => { desenhar(); pm.current.forEach((f) => f()) })
    m.on('click', (e) => {
      const t = toolR.current
      if (!t) return
      const c: [number, number] = [e.lngLat.lng, e.lngLat.lat]
      if (t === 'ponto') {
        setItens((l) => [...l, { id: crypto.randomUUID(), nome: `Ponto ${l.filter((i) => i.tipo === 'ponto').length + 1}`, tipo: 'ponto', pasta: 'Pontos', coords: [c] }])
      } else setRascunho((r) => [...r, c])
    })
    return () => { maplibregl.removeProtocol('pmtiles'); m.remove(); map.current = null }
  }, [desenhar])

  useEffect(() => { localStorage.setItem(K, JSON.stringify(itens)); desenhar() }, [itens, rascunho, tool, desenhar])

  useEffect(() => {
    void (async () => {
      try {
        const id = await projetoPadrao()
        if (!id) return
        pid.current = id
        const remotos = await carregarItens(id)
        if (remotos.length) setItens(remotos)
        antigos.current = remotos.map((r) => r.id)
      } catch { /* offline: segue com dados locais */ }
      pronto.current = true
    })()
  }, [])

  useEffect(() => {
    if (!pronto.current || !pid.current) return
    const t = setTimeout(() => {
      salvarItens(pid.current as string, itens, antigos.current).then(() => { antigos.current = itens.map((i) => i.id) }).catch(() => undefined)
    }, 1000)
    return () => clearTimeout(t)
  }, [itens])

  const exportar = () => {
    const blob = new Blob([JSON.stringify(toGeo(itens, [], null))], { type: 'application/geo+json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = 'maprede.geojson'; a.click()
    URL.revokeObjectURL(a.href)
  }
  const fibraTotal = itens.filter((i) => i.tipo === 'linha').reduce((s, i) => s + comprimento(i.coords), 0)

  const trocarBase = (b: Base) => { setBase(b); map.current?.setStyle(ESTILOS[b]) }

  const concluir = () => {
    const min = tool === 'linha' ? 2 : 3
    if (!tool || rascunho.length < min) { toast.error(`Mínimo de ${min} vértices`); return }
    setItens((l) => [...l, { id: crypto.randomUUID(), nome: `${tool === 'linha' ? 'Linha' : 'Polígono'} ${l.filter((i) => i.tipo === tool).length + 1}`, tipo: tool, pasta: tool === 'linha' ? 'Linhas' : 'Polígonos', coords: rascunho }])
    setRascunho([]); setTool(null)
  }

  const importar = async (f: File) => {
    try {
      const p = new PMTiles(new FileSource(f))
      proto.current?.add(p)
      const h = await p.getHeader()
      const meta = (await p.getMetadata()) as { vector_layers?: { id: string }[] }
      const id = `pm-${f.name}`
      const add = () => {
        const m = map.current; if (!m || m.getSource(id)) return
        if (h.tileType === 1) {
          m.addSource(id, { type: 'vector', url: `pmtiles://${p.source.getKey()}` })
          ;(meta.vector_layers ?? []).forEach((l) => {
            m.addLayer({ id: `${id}-${l.id}-f`, type: 'fill', source: id, 'source-layer': l.id, filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': '#a78bfa', 'fill-opacity': 0.3 } })
            m.addLayer({ id: `${id}-${l.id}-l`, type: 'line', source: id, 'source-layer': l.id, filter: ['!=', '$type', 'Point'], paint: { 'line-color': '#8b5cf6' } })
          })
        } else m.addSource(id, { type: 'raster', url: `pmtiles://${p.source.getKey()}`, tileSize: 256 }), m.addLayer({ id, type: 'raster', source: id })
      }
      pm.current.push(add); add()
      m_fit(h)
      toast.success(`${f.name} carregado`)
    } catch { toast.error('Arquivo .pmtiles inválido') }
  }
  const m_fit = (h: { minLon: number; minLat: number; maxLon: number; maxLat: number }) =>
    map.current?.fitBounds([[h.minLon, h.minLat], [h.maxLon, h.maxLat]], { padding: 40, duration: 600 })

  const buscar = () => {
    const q = busca.trim().toLowerCase()
    if (!q) return
    const ll = q.match(/^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/)
    if (ll) { map.current?.flyTo({ center: [Number(ll[2]), Number(ll[1])], zoom: 16 }); return }
    const it = itens.find((i) => i.nome.toLowerCase().includes(q))
    if (it) { map.current?.flyTo({ center: it.coords[0], zoom: 16 }); return }
    fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(busca)}`)
      .then((r) => r.json() as Promise<{ lat: string; lon: string }[]>)
      .then((r) => r[0] ? map.current?.flyTo({ center: [Number(r[0].lon), Number(r[0].lat)], zoom: 15 }) : toast.error('Nada encontrado'))
      .catch(() => toast.error('Busca online indisponível'))
  }

  const pastas = [...new Set(itens.map((i) => i.pasta))]
  const btn = (t: Tipo, Icon: typeof MapPin, label: string) => (
    <Button size="sm" variant={tool === t ? 'default' : 'secondary'} onClick={() => { setRascunho([]); setTool(tool === t ? null : t) }}><Icon /> {label}</Button>
  )

  return (
    <div className="relative h-svh w-full">
      <div ref={el} className="absolute inset-0" />
      <div className="absolute left-3 right-3 top-3 z-10 flex flex-wrap items-center gap-2">
        <form className="flex min-w-52 flex-1 gap-1 sm:max-w-md" onSubmit={(e) => { e.preventDefault(); buscar() }}>
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar endereço, item ou lat,lng" className="bg-background" />
          <Button type="submit" size="icon" aria-label="Buscar"><Search /></Button>
        </form>
        <div className="flex gap-1 rounded-md bg-background p-1 shadow">
          {(['vetorial', 'satelite', 'relevo'] as Base[]).map((b) => (
            <Button key={b} size="sm" variant={base === b ? 'default' : 'ghost'} onClick={() => trocarBase(b)} className="capitalize">{b === 'satelite' ? 'Satélite' : b}</Button>
          ))}
        </div>
        <Button size="sm" variant="secondary" onClick={() => arq.current?.click()}><Upload /> .pmtiles</Button>
        <input ref={arq} type="file" accept=".pmtiles" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importar(f); e.target.value = '' }} />
        <Button size="sm" variant="outline" onClick={exportar}><Download /> GeoJSON</Button>
        <Button size="sm" variant="outline" asChild><Link to="/diagrama"><Workflow /> Diagrama</Link></Button>
        {isAdmin && <Button size="sm" variant="outline" asChild><Link to="/admin"><ShieldCheck /> Admin</Link></Button>}
        <Button size="sm" variant="outline" onClick={() => void sair()} title={usuario?.email}><LogOut /> Sair</Button>
      </div>
      <Button size="icon" variant="secondary" className="absolute bottom-3 left-3 z-20" aria-label="Menu" onClick={() => setMenu((v) => !v)}><Menu /></Button>
      {menu && <aside className="absolute bottom-16 left-3 z-10 max-h-[55svh] w-56 space-y-2 overflow-auto rounded-lg bg-background/95 p-3 text-sm shadow">
        <div className="flex flex-wrap gap-1">{btn('ponto', MapPin, 'Ponto')}{btn('linha', Minus, 'Linha')}{btn('poligono', Pentagon, 'Pol.')}</div>
        {tool && tool !== 'ponto' && <Button size="sm" className="w-full" onClick={concluir}><Check /> Concluir ({rascunho.length})</Button>}
        {tool && <p className="text-xs text-muted-foreground">Clique no mapa para adicionar.</p>}
        <p className="flex items-center gap-1 font-medium"><Folder className="size-4" /> Projeto</p>
        <p className="text-xs text-muted-foreground">Fibra total: {fmtM(fibraTotal)} · {itens.filter((i) => i.tipo === 'ponto').length} pontos</p>
        {pastas.length === 0 && <p className="text-xs text-muted-foreground">Sem elementos.</p>}
        {pastas.map((p) => (
          <details key={p} open>
            <summary className="cursor-pointer">{p}</summary>
            <ul className="ml-4 space-y-1">
              {itens.filter((i) => i.pasta === p).map((i) => (
                <li key={i.id} className="flex justify-between gap-1">
                  <button className="truncate text-left hover:underline" onClick={() => map.current?.flyTo({ center: i.coords[0], zoom: 17 })}>{i.nome}{i.tipo === 'linha' ? ` (${fmtM(comprimento(i.coords))})` : ''}</button>
                  <button className="text-destructive" aria-label="Excluir" onClick={() => setItens((l) => l.filter((x) => x.id !== i.id))}>×</button>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </aside>}
    </div>
  )
}
