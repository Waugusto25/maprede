import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { carregarItens, distancia, fmtM, projetoPadrao, type Item } from '@/lib/projeto'
import { supabaseConfigurado } from '@/lib/supabase'

interface Registro { id: string; tipo: 'FTTH' | 'Rádio'; titulo: string; resultado: string; viavel: boolean; data: string }
const CHAVE = 'maprede_viabilidades'
const ler = (): Registro[] => { try { return JSON.parse(localStorage.getItem(CHAVE) ?? '[]') as Registro[] } catch { return [] } }
const gravar = (r: Registro) => { localStorage.setItem(CHAVE, JSON.stringify([r, ...ler()])) }

function parseCoord(t: string): [number, number] | null {
  const m = t.match(/-?\d+(?:[.,]\d+)?/g)
  if (!m || m.length < 2) return null
  const lat = parseFloat(m[0].replace(',', '.'))
  const lon = parseFloat(m[1].replace(',', '.'))
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  return [lon, lat]
}

const Caixa = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-[calc(100svh-56px)] bg-[#0f172a] p-4 text-slate-100"><div className="mx-auto max-w-xl space-y-4 rounded-xl border border-slate-700 bg-[#1e293b] p-5">{children}</div></div>
)
const Campo = ({ l, v, s, p }: { l: string; v: string; s: (v: string) => void; p?: string }) => (
  <label className="block text-sm text-slate-300">{l}<Input className="mt-1 border-slate-600 bg-[#0f172a] text-slate-100" value={v} placeholder={p} onChange={(e) => s(e.target.value)} /></label>
)
const Res = ({ ok, texto }: { ok: boolean; texto: string }) => (
  <div className={`rounded-lg border p-3 text-sm ${ok ? 'border-green-500 bg-green-500/10 text-green-300' : 'border-red-500 bg-red-500/10 text-red-300'}`}>{texto}</div>
)

export function ViabilidadeFtth() {
  const [itens, setItens] = useState<Item[]>([])
  const [cli, setCli] = useState('')
  const [limite, setLimite] = useState('250')
  const [res, setRes] = useState<{ ok: boolean; texto: string } | null>(null)
  useEffect(() => {
    if (!supabaseConfigurado) return
    void projetoPadrao().then((p) => (p ? carregarItens(p).then(setItens) : undefined))
  }, [])
  const calcular = () => {
    const c = parseCoord(cli)
    if (!c) return toast.error('Informe a coordenada: lat, lon')
    const pts = itens.filter((i) => i.tipo === 'ponto' && i.coords[0])
    if (!pts.length) return toast.error('O projeto não tem pontos (CTO/CEO) cadastrados')
    let melhor = pts[0]; let d = distancia(c, pts[0].coords[0])
    for (const p of pts) { const x = distancia(c, p.coords[0]); if (x < d) { d = x; melhor = p } }
    const ok = d <= (parseFloat(limite) || 250)
    setRes({ ok, texto: `${ok ? 'VIÁVEL' : 'INVIÁVEL'}: ponto mais próximo "${melhor.nome}" a ${fmtM(d)} (limite ${limite} m).` })
  }
  const salvar = () => {
    if (!res) return
    gravar({ id: crypto.randomUUID(), tipo: 'FTTH', titulo: cli, resultado: res.texto, viavel: res.ok, data: new Date().toISOString() })
    toast.success('Salvo em Viabilidades')
  }
  return (
    <Caixa>
      <h1 className="text-lg font-semibold text-[#f97316]">Viabilidade FTTH</h1>
      <p className="text-xs text-slate-400">{itens.filter((i) => i.tipo === 'ponto').length} ponto(s) no projeto atual.</p>
      <Campo l="Coordenada do cliente" v={cli} s={setCli} p="-23.55, -46.63" />
      <Campo l="Distância máxima de drop (m)" v={limite} s={setLimite} />
      <div className="flex gap-2"><Button className="bg-[#f97316] text-white hover:bg-[#ea580c]" onClick={calcular}>Calcular</Button>{res && <Button variant="outline" className="border-slate-600 bg-transparent" onClick={salvar}>Salvar</Button>}</div>
      {res && <Res {...res} />}
    </Caixa>
  )
}

export function ViabilidadeRadio() {
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [f, setF] = useState('5.8')
  const [tx, setTx] = useState('23')
  const [g, setG] = useState('23')
  const [sens, setSens] = useState('-75')
  const [res, setRes] = useState<{ ok: boolean; texto: string } | null>(null)
  const calcular = () => {
    const p1 = parseCoord(a); const p2 = parseCoord(b)
    if (!p1 || !p2) return toast.error('Informe as duas coordenadas: lat, lon')
    const km = distancia(p1, p2) / 1000
    const fs = 92.45 + 20 * Math.log10(Math.max(km, 0.001)) + 20 * Math.log10(parseFloat(f) || 5.8)
    const rx = (parseFloat(tx) || 0) + 2 * (parseFloat(g) || 0) - fs
    const margem = rx - (parseFloat(sens) || -75)
    const ok = margem >= 10
    setRes({ ok, texto: `${ok ? 'VIÁVEL' : 'INVIÁVEL'}: ${km.toFixed(2)} km, perda ${fs.toFixed(1)} dB, sinal ${rx.toFixed(1)} dBm, margem ${margem.toFixed(1)} dB (mín. 10 dB). Não considera obstáculos nem Fresnel.` })
  }
  const salvar = () => {
    if (!res) return
    gravar({ id: crypto.randomUUID(), tipo: 'Rádio', titulo: `${a} → ${b}`, resultado: res.texto, viavel: res.ok, data: new Date().toISOString() })
    toast.success('Salvo em Viabilidades')
  }
  return (
    <Caixa>
      <h1 className="text-lg font-semibold text-[#f97316]">Viabilidade Via Rádio</h1>
      <Campo l="Ponto A (torre)" v={a} s={setA} p="-23.55, -46.63" />
      <Campo l="Ponto B (cliente)" v={b} s={setB} p="-23.56, -46.64" />
      <div className="grid grid-cols-2 gap-3">
        <Campo l="Frequência (GHz)" v={f} s={setF} />
        <Campo l="Potência TX (dBm)" v={tx} s={setTx} />
        <Campo l="Ganho de cada antena (dBi)" v={g} s={setG} />
        <Campo l="Sensibilidade RX (dBm)" v={sens} s={setSens} />
      </div>
      <div className="flex gap-2"><Button className="bg-[#f97316] text-white hover:bg-[#ea580c]" onClick={calcular}>Calcular</Button>{res && <Button variant="outline" className="border-slate-600 bg-transparent" onClick={salvar}>Salvar</Button>}</div>
      {res && <Res {...res} />}
    </Caixa>
  )
}

export function Viabilidades() {
  const [lista, setLista] = useState<Registro[]>(ler())
  const apagar = (id: string) => { const n = ler().filter((r) => r.id !== id); localStorage.setItem(CHAVE, JSON.stringify(n)); setLista(n) }
  return (
    <Caixa>
      <h1 className="text-lg font-semibold text-[#f97316]">Viabilidades (histórico)</h1>
      {lista.length === 0 && <p className="text-sm text-slate-400">Nenhuma viabilidade salva ainda.</p>}
      {lista.map((r) => (
        <div key={r.id} className="space-y-1 rounded-lg border border-slate-700 p-3 text-sm">
          <div className="flex justify-between"><b>{r.tipo} · {r.titulo}</b><button className="text-xs text-red-400" onClick={() => apagar(r.id)}>Apagar</button></div>
          <div className={r.viavel ? 'text-green-300' : 'text-red-300'}>{r.resultado}</div>
          <div className="text-xs text-slate-500">{new Date(r.data).toLocaleString('pt-BR')}</div>
        </div>
      ))}
    </Caixa>
  )
}
