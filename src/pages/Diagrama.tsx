import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Background, Controls, ReactFlow, addEdge, applyEdgeChanges, applyNodeChanges } from '@xyflow/react'
import type { Connection, Edge, EdgeChange, Node, NodeChange } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

const K = 'maprede.diagrama'
// perdas típicas (dB)
const PERDA: Record<string, number> = { OLT: 0, DIO: 0.5, 'Splitter 1:2': 3.7, 'Splitter 1:4': 7.2, 'Splitter 1:8': 10.5, 'Splitter 1:16': 13.8, CEO: 0.1, CTO: 0.1, ONU: 0 }
const TIPOS = Object.keys(PERDA)
const FIBRA_DB_KM = 0.35

interface Estado { nodes: Node[]; edges: Edge[]; km: Record<string, number> }

const inicial: Estado = {
  nodes: [
    { id: 'n1', position: { x: 0, y: 120 }, data: { label: 'OLT' } },
    { id: 'n2', position: { x: 220, y: 120 }, data: { label: 'Splitter 1:8' } },
    { id: 'n3', position: { x: 460, y: 120 }, data: { label: 'ONU' } },
  ],
  edges: [
    { id: 'e1', source: 'n1', target: 'n2' },
    { id: 'e2', source: 'n2', target: 'n3' },
  ],
  km: { e1: 5, e2: 0.3 },
}

function carregar(): Estado {
  try { return (JSON.parse(localStorage.getItem(K) ?? 'null') as Estado | null) ?? inicial } catch { return inicial }
}

export default function Diagrama() {
  const [est, setEst] = useState<Estado>(carregar)
  const [sel, setSel] = useState<string | null>(null)
  useEffect(() => { localStorage.setItem(K, JSON.stringify(est)) }, [est])

  const onNodes = useCallback((c: NodeChange[]) => setEst((s) => ({ ...s, nodes: applyNodeChanges(c, s.nodes) })), [])
  const onEdges = useCallback((c: EdgeChange[]) => setEst((s) => ({ ...s, edges: applyEdgeChanges(c, s.edges) })), [])
  const onConnect = useCallback((c: Connection) => setEst((s) => {
    const e = addEdge(c, s.edges)
    return { ...s, edges: e, km: { ...s.km, [e[e.length - 1].id]: 0.1 } }
  }), [])

  const add = (tipo: string) => setEst((s) => ({ ...s, nodes: [...s.nodes, { id: `n${Date.now()}`, position: { x: 40 + (s.nodes.length % 6) * 40, y: 40 + (s.nodes.length % 6) * 50 }, data: { label: tipo } }] }))
  const remover = () => setEst((s) => ({
    nodes: s.nodes.filter((n) => n.id !== sel),
    edges: s.edges.filter((e) => e.source !== sel && e.target !== sel && e.id !== sel),
    km: s.km,
  }))

  // perda total: soma o caminho mais longo a partir de cada nó sem entrada
  const total = useMemo(() => {
    const out = new Map<string, Edge[]>()
    est.edges.forEach((e) => out.set(e.source, [...(out.get(e.source) ?? []), e]))
    const rotulo = (id: string) => String(est.nodes.find((n) => n.id === id)?.data.label ?? '')
    const visit = (id: string, vistos: string[]): number => {
      if (vistos.includes(id)) return 0
      const base = PERDA[rotulo(id)] ?? 0
      const filhos = out.get(id) ?? []
      const melhor = Math.max(0, ...filhos.map((e) => (est.km[e.id] ?? 0) * FIBRA_DB_KM + visit(e.target, [...vistos, id])))
      return base + melhor
    }
    const alvos = new Set(est.edges.map((e) => e.target))
    return Math.max(0, ...est.nodes.filter((n) => !alvos.has(n.id)).map((n) => visit(n.id, [])))
  }, [est])

  const arestaSel = est.edges.find((e) => e.id === sel)
  const potencia = 3 - total // OLT +3 dBm
  const ok = potencia >= -27

  return (
    <div className="flex h-svh flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b p-2">
        <Button size="sm" variant="outline" asChild><Link to="/"><ArrowLeft /> Mapa</Link></Button>
        <h1 className="font-semibold">Diagrama unifilar óptico</h1>
        <div className="flex flex-wrap gap-1">
          {TIPOS.map((t) => <Button key={t} size="sm" variant="secondary" onClick={() => add(t)}><Plus /> {t}</Button>)}
        </div>
        <Button size="sm" variant="destructive" disabled={!sel} onClick={remover}><Trash2 /> Remover</Button>
      </header>
      <div className="relative flex-1">
        <ReactFlow
          nodes={est.nodes} edges={est.edges.map((e) => ({ ...e, label: `${est.km[e.id] ?? 0} km`, selected: e.id === sel }))}
          onNodesChange={onNodes} onEdgesChange={onEdges} onConnect={onConnect}
          onNodeClick={(_, n) => setSel(n.id)} onEdgeClick={(_, e) => setSel(e.id)} onPaneClick={() => setSel(null)}
          fitView
        >
          <Background /><Controls />
        </ReactFlow>
        <div className="absolute right-3 top-3 z-10 w-60 space-y-2 rounded-lg bg-background/95 p-3 text-sm shadow">
          <p className="font-medium">Orçamento de potência</p>
          <p>Perda total: <b>{total.toFixed(2)} dB</b></p>
          <p>Potência na ONU (OLT +3 dBm): <b className={ok ? 'text-green-600' : 'text-destructive'}>{potencia.toFixed(2)} dBm</b></p>
          <p className="text-xs text-muted-foreground">{ok ? 'Dentro da sensibilidade (-27 dBm).' : 'Abaixo de -27 dBm: inviável.'} Fibra: {FIBRA_DB_KM} dB/km.</p>
          {arestaSel && (
            <label className="block text-xs">Comprimento do trecho (km)
              <input type="number" min={0} step={0.1} className="mt-1 w-full rounded border bg-background px-2 py-1"
                value={est.km[arestaSel.id] ?? 0}
                onChange={(e) => setEst((s) => ({ ...s, km: { ...s.km, [arestaSel.id]: Math.max(0, Number(e.target.value)) } }))} />
            </label>
          )}
          <p className="text-xs text-muted-foreground">Arraste entre os nós para ligar. Clique em um trecho para editar o comprimento.</p>
        </div>
      </div>
    </div>
  )
}
