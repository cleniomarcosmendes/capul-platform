import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './components/Toast';
import { Layout } from './layouts/Layout';
import { HomePage } from './pages/HomePage';
import { PainelPage } from './pages/PainelPage';
import { ClientesPage } from './pages/ClientesPage';
import { EntregaNovaPage } from './pages/EntregaNovaPage';
import { EntregasPage } from './pages/EntregasPage';
import { EntregaDetalhePage } from './pages/EntregaDetalhePage';
import { VeiculosPage } from './pages/VeiculosPage';
import { VeiculoFormPage } from './pages/VeiculoFormPage';
import { ViagensPage } from './pages/ViagensPage';
import { MontarViagemPage } from './pages/MontarViagemPage';
import { ViagemDetalhePage } from './pages/ViagemDetalhePage';
import { EtiquetasPage } from './pages/EtiquetasPage';
import { RomaneioPage } from './pages/RomaneioPage';
import { ComprovantesPage } from './pages/ComprovantesPage';

function Protected() {
  const { loading, logisticaRole } = useAuth();
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">Carregando…</div>;
  }
  if (!logisticaRole) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-center text-slate-600">
        Você não tem acesso ao módulo Logística. Solicite a um administrador no Configurador.
      </div>
    );
  }
  return (
    <Routes>
      {/* Impressão de etiquetas: fora do Layout (sem sidebar/header) */}
      <Route path="/etiquetas/viagem/:id" element={<EtiquetasPage modo="viagem" />} />
      <Route path="/etiquetas/entrega/:id" element={<EtiquetasPage modo="entrega" />} />
      <Route path="/romaneio/viagem/:id" element={<RomaneioPage />} />
      <Route
        path="/*"
        element={
          <Layout>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/painel" element={<PainelPage />} />
              <Route path="/clientes" element={<ClientesPage />} />
              <Route path="/entregas" element={<EntregasPage />} />
              <Route path="/entregas/nova" element={<EntregaNovaPage />} />
              <Route path="/entregas/:id" element={<EntregaDetalhePage />} />
              <Route path="/entregas/:id/editar" element={<EntregaNovaPage />} />
              <Route path="/veiculos" element={<VeiculosPage />} />
              <Route path="/veiculos/novo" element={<VeiculoFormPage />} />
              <Route path="/veiculos/:id/editar" element={<VeiculoFormPage />} />
              <Route path="/viagens" element={<ViagensPage />} />
              <Route path="/viagens/montar" element={<MontarViagemPage />} />
              <Route path="/viagens/:id" element={<ViagemDetalhePage />} />
              <Route path="/comprovantes" element={<ComprovantesPage />} />
            </Routes>
          </Layout>
        }
      />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter basename="/entregas">
      <AuthProvider>
        <ToastProvider>
          <Protected />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
