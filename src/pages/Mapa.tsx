import { useCallback, useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { PMTiles, Protocol, FileSource } from 'pmtiles'
import { Folder, MapPin, Minus, Pentagon, Search, Upload, Check, Menu, Compass, Lock, Unlock, Ruler, LocateFixed, Plus, Save, Eraser } from 'lucide-react'
import { carregarItens, comprimento, fmtM, projetoPadrao, salvarItens } from '@/lib/projeto'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

type Tipo = 'ponto' | 'linha' | 'poligono'
interface Item { id: string; nome: string; tipo: Tipo; pasta: string; coords: [number, number][] }
type Base = 'vetorial' | 'satelite' | 'relevo'

const raster = (tiles: string[], maxzoom: number, attribution: string): maplibregl.StyleSpecification => ({
  version: 8,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
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
    type: 'Feature', properties: { nome: i.nome, id: i.id },
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
  const [travado, setTravado] = useState(true)
  const [medir, setMedir] = useState(false)
  const [gps, setGps] = useState<{ lng: number; lat: number; acc: number } | null>(null)
  const gpsR = useRef(gps); gpsR.current = gps
  const travR = useRef(travado); travR.current = travado
  const medR = useRef(medir); medR.current = medir
  itensR.current = itens; toolR.current = tool ?? (medir ? 'linha' : null); rascR.current = rascunho

  const desenhar = useCallback(() => {
    const m = map.current
    if (!m || !m.getStyle()) return
    const data = toGeo(itensR.current, rascR.current, toolR.current)
    let src = m.getSource('dados') as maplibregl.GeoJSONSource | undefined
    if (src) src.setData(data)
    else { m.addSource('dados', { type: 'geojson', data }); src = m.getSource('dados') as maplibregl.GeoJSONSource }
    if (m.getLayer('dados-lbl')) return
    try {
    m.addLayer({ id: 'dados-fill', type: 'fill', source: 'dados', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': '#22d3ee', 'fill-opacity': 0.25 } })
    m.addLayer({ id: 'dados-line', type: 'line', source: 'dados', filter: ['!=', '$type', 'Point'], paint: { 'line-color': '#06b6d4', 'line-width': 3 } })
    m.addLayer({ id: 'dados-pt', type: 'circle', source: 'dados', filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 6, 'circle-color': '#f43f5e', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } })
    m.addLayer({ id: 'dados-lbl', type: 'symbol', source: 'dados', filter: ['==', '$type', 'Point'], layout: { 'text-field': ['get', 'nome'], 'text-font': ['Noto Sans Regular'], 'text-offset': [0, 1.2], 'text-size': 12 }, paint: { 'text-color': '#0f172a', 'text-halo-color': '#fff', 'text-halo-width': 1.5 } })
    } catch (err) { console.error('Erro ao criar camadas', err) }
  }, [])

  useEffect(() => {
    if (!el.current) return
    const protocol = new Protocol()
    proto.current = protocol
    maplibregl.addProtocol('pmtiles', protocol.tile)
    const m = new maplibregl.Map({ container: el.current, style: ESTILOS.vetorial, center: [-46.63, -23.55], zoom: 11, maxZoom: 22 })
    map.current = m
    let fallback = false
    m.on('error', (ev) => {
      console.error('Erro no mapa:', ev.error)
      if (fallback || m.isStyleLoaded()) return
      fallback = true
      m.setStyle(raster(['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], 19, '© OpenStreetMap'))
      toast.error('Mapa vetorial indisponível; usando mapa básico')
    })
    m.on('load', () => m.resize())
    setTimeout(() => m.resize(), 300)
    m.on('style.load', () => { desenhar(); pm.current.forEach((f) => f()) })
    m.on('mouseenter', 'dados-pt', () => { if (!travR.current && !toolR.current) m.getCanvas().style.cursor = 'move' })
    m.on('mouseleave', 'dados-pt', () => { m.getCanvas().style.cursor = '' })
    m.on('mousedown', 'dados-pt', (e) => {
      if (travR.current || toolR.current) return
      const id = e.features?.[0]?.properties?.id as string | undefined
      if (!id) return
      e.preventDefault()
      m.dragPan.disable()
      const mv = (ev: maplibregl.MapMouseEvent) => {
        const c: [number, number] = [ev.lngLat.lng, ev.lngLat.lat]
        setItens((l) => l.map((i) => (i.id === id ? { ...i, coords: [c] } : i)))
      }
      const up = () => { m.off('mousemove', mv); m.dragPan.enable() }
      m.on('mousemove', mv)
      m.once('mouseup', up)
    })
    m.on('touchstart', 'dados-pt', (e) => {
      if (travR.current || toolR.current || e.points.length > 1) return
      const id = e.features?.[0]?.properties?.id as string | undefined
      if (!id) return
      e.preventDefault()
      m.dragPan.disable()
      const mv = (ev: maplibregl.MapTouchEvent) => {
        const c: [number, number] = [ev.lngLat.lng, ev.lngLat.lat]
        setItens((l) => l.map((i) => (i.id === id ? { ...i, coords: [c] } : i)))
      }
      const up = () => { m.off('touchmove', mv); m.dragPan.enable() }
      m.on('touchmove', mv)
      m.once('touchend', up)
    })
    m.on('click', (e) => {
      const c: [number, number] = [e.lngLat.lng, e.lngLat.lat]
      if (medR.current) { setRascunho((r) => [...r, c]); return }
      const t = toolR.current
      if (!t || travR.current) return
      if (t === 'ponto') {
        setItens((l) => [...l, { id: crypto.randomUUID(), nome: `Ponto ${l.filter((i) => i.tipo === 'ponto').length + 1}`, tipo: 'ponto', pasta: 'Pontos', coords: [c] }])
      } else setRascunho((r) => [...r, c])
    })
    return () => { maplibregl.removeProtocol('pmtiles'); m.remove(); map.current = null }
  }, [desenhar])

  useEffect(() => {
    if (!('geolocation' in navigator)) return
    const id = navigator.geolocation.watchPosition(
      (p) => setGps({ lng: p.coords.longitude, lat: p.coords.latitude, acc: p.coords.accuracy }),
      () => setGps(null), { enableHighAccuracy: true })
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  useEffect(() => { localStorage.setItem(K, JSON.stringify(itens)); desenhar() }, [itens, rascunho, tool, medir, desenhar])

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
  const escolher = (t: Tipo) => {
    if (travado) { toast.info('Destrave o cadeado de edição para desenhar'); return }
    setMedir(false); setRascunho([]); setTool(tool === t ? null : t)
  }
  const fab = (t: Tipo, Icon: typeof MapPin, label: string) => (
    <button key={t} title={label} aria-label={label} onClick={() => escolher(t)}
      className={`grid size-11 place-items-center rounded-full text-white shadow-lg ${tool === t ? 'bg-[#ea580c] ring-2 ring-white' : 'bg-[#f97316] hover:bg-[#ea580c]'}`}><Icon className="size-5" /></button>
  )
  const ctl = 'grid size-10 place-items-center rounded-lg border border-slate-600 bg-[#1e293b]/95 text-slate-200 shadow hover:bg-slate-700'
  const centralizar = () => {
    const g = gpsR.current
    if (!g) { toast.error('GPS indisponível'); return }
    map.current?.flyTo({ center: [g.lng, g.lat], zoom: 17 })
  }
  const limpar = () => { setRascunho([]); setTool(null); setMedir(false); setBusca('') }
  const salvarAgora = () => {
    if (!pid.current) { toast.success('Salvo no aparelho'); return }
    salvarItens(pid.current, itens, antigos.current)
      .then(() => { antigos.current = itens.map((i) => i.id); toast.success('Projeto salvo') })
      .catch(() => toast.error('Falha ao salvar; mantido no aparelho'))
  }
  const distMedida = medir && rascunho.length > 1 ? comprimento(rascunho) : 0

  return (
    <div className="relative min-h-[400px] w-full flex-1">
      <div ref={el} className="absolute inset-0 h-full w-full bg-[#1e293b]" />
      <div className="absolute left-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-2 lg:max-w-[55%]">
        <button onClick={salvarAgora} className="flex h-9 items-center gap-1 rounded-md bg-[#f97316] px-3 text-sm font-medium text-white shadow hover:bg-[#ea580c]"><Save className="size-4" /> Salvar</button>
        <button onClick={limpar} className="flex h-9 items-center gap-1 rounded-md border border-slate-600 bg-[#1e293b]/95 px-3 text-sm text-slate-200 shadow hover:bg-slate-700"><Eraser className="size-4" /> Limpar</button>
        <form className="flex min-w-52 flex-1 gap-1 sm:max-w-md" onSubmit={(e) => { e.preventDefault(); buscar() }}>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Coordenada, link ou endereço" className="h-9 w-full rounded-md border border-slate-600 bg-[#1e293b]/95 px-3 text-sm text-slate-100 placeholder:text-slate-400" />
          <button type="submit" aria-label="Buscar" className="grid size-9 shrink-0 place-items-center rounded-md bg-[#f97316] text-white hover:bg-[#ea580c]"><Search className="size-4" /></button>
        </form>
      </div>

      <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-2">
        <div className="flex items-center gap-1 rounded-full border border-slate-600 bg-[#0f172a]/95 p-1 shadow">
          {(['vetorial', 'satelite', 'relevo'] as Base[]).map((b) => (
            <button key={b} onClick={() => trocarBase(b)} className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${base === b ? 'bg-[#f97316] text-white' : 'text-slate-300 hover:bg-[#1e293b]'}`}>{b === 'satelite' ? 'Satélite' : b}</button>
          ))}
          <button onClick={() => arq.current?.click()} className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-slate-300 hover:bg-[#1e293b]"><Upload className="size-3" /> .pmtiles</button>
          <input ref={arq} type="file" accept=".pmtiles" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importar(f); e.target.value = '' }} />
        </div>
        <button className={ctl} title="Norte" aria-label="Norte" onClick={() => map.current?.easeTo({ bearing: 0, pitch: 0 })}><Compass className="size-5" /></button>
        <button className={`${ctl} ${travado ? '' : 'border-[#f97316] text-[#f97316]'}`} title={travado ? 'Edição travada' : 'Edição liberada'} aria-label="Cadeado de edição" onClick={() => { setTravado((v) => !v); if (!travado) { setTool(null); setRascunho([]) } }}>{travado ? <Lock className="size-5" /> : <Unlock className="size-5" />}</button>
        <button className={`${ctl} ${medir ? 'border-[#f97316] text-[#f97316]' : ''}`} title="Medir distância" aria-label="Medidor" onClick={() => { setTool(null); setRascunho([]); setMedir((v) => !v) }}><Ruler className="size-5" /></button>
        {medir && <span className="rounded-md bg-[#0f172a]/95 px-2 py-1 text-xs text-slate-100 shadow">{fmtM(distMedida)}</span>}
        <button className={ctl} title="Centralizar no GPS" aria-label="Centralizar GPS" onClick={centralizar}><LocateFixed className="size-5" /></button>
      </div>

      <div className="absolute bottom-10 right-3 z-10 flex flex-col items-center gap-2">
        {fab('poligono', Pentagon, 'Polígono')}{fab('linha', Minus, 'Linha')}{fab('ponto', MapPin, 'Ponto')}
        <div className="mt-1 flex flex-col overflow-hidden rounded-lg border border-slate-600 bg-[#1e293b]/95 shadow">
          <button aria-label="Aumentar zoom" className="grid size-10 place-items-center text-slate-200 hover:bg-slate-700" onClick={() => map.current?.zoomIn()}><Plus className="size-5" /></button>
          <button aria-label="Diminuir zoom" className="grid size-10 place-items-center border-t border-slate-600 text-slate-200 hover:bg-slate-700" onClick={() => map.current?.zoomOut()}><Minus className="size-5" /></button>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center">
        <span className="rounded-t-md bg-[#0f172a]/80 px-3 py-1 text-xs text-slate-300">{gps ? `GPS ±${Math.round(gps.acc)}m` : 'GPS indisponível'}</span>
      </div>

      <button className={`${ctl} absolute bottom-3 left-3 z-20`} aria-label="Menu" onClick={() => setMenu((v) => !v)}><Menu className="size-5" /></button>
      {menu && <aside className="absolute bottom-16 left-3 z-10 max-h-[55svh] w-56 space-y-2 overflow-auto rounded-lg border border-slate-600 bg-[#0f172a]/90 p-3 text-sm text-slate-200 shadow">
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
