import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/lib/auth'
import Login from '@/pages/Login'
import Home from '@/pages/Home'
import Admin from '@/pages/Admin'
import Diagrama from '@/pages/Diagrama'
import Projetos from '@/pages/Projetos'
import { Legal } from '@/pages/Legal'
import { EmBreve } from '@/components/TopBar'
import { ViabilidadeFtth, ViabilidadeRadio, Viabilidades } from '@/pages/Viabilidades'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/projetos" element={<Home><Projetos /></Home>} />
          <Route path="/viabilidade-ftth" element={<Home><ViabilidadeFtth /></Home>} />
          <Route path="/viabilidade-radio" element={<Home><ViabilidadeRadio /></Home>} />
          <Route path="/viabilidades" element={<Home><Viabilidades /></Home>} />
          <Route path="/offline" element={<Home><EmBreve titulo="Mapa Offline" etapa={2} /></Home>} />
          <Route path="/diagrama" element={<Home><Diagrama /></Home>} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/privacidade" element={<Legal titulo="Política de Privacidade" texto="O MAPREDE coleta apenas nome e e-mail da conta Google para autenticação e controle de acesso. Dados de projetos ficam armazenados no seu dispositivo." />} />
          <Route path="/termos" element={<Legal titulo="Termos de Uso" texto="O acesso ao MAPREDE depende de aprovação do administrador e pode ser bloqueado a qualquer momento." />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </AuthProvider>
  )
}
