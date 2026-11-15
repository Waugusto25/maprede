import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/lib/auth'
import Login from '@/pages/Login'
import Home from '@/pages/Home'
import Admin from '@/pages/Admin'
import Diagrama from '@/pages/Diagrama'
import { Legal } from '@/pages/Legal'
import { EmBreve } from '@/components/TopBar'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/projetos" element={<Home><EmBreve titulo="Projetos" etapa={2} /></Home>} />
          <Route path="/viabilidade-ftth" element={<Home><EmBreve titulo="Viabilidade FTTH" etapa={3} /></Home>} />
          <Route path="/viabilidade-radio" element={<Home><EmBreve titulo="Viabilidade Via Rádio" etapa={3} /></Home>} />
          <Route path="/viabilidades" element={<Home><EmBreve titulo="Viabilidades" etapa={3} /></Home>} />
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
