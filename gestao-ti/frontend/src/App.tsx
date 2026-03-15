import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { MainLayout } from './layouts/MainLayout';
import { DashboardPage } from './pages/DashboardPage';
import { EquipesListPage } from './pages/equipes/EquipesListPage';
import { EquipeFormPage } from './pages/equipes/EquipeFormPage';
import { EquipeDetalhePage } from './pages/equipes/EquipeDetalhePage';
import { DepartamentosPage } from './pages/departamentos/DepartamentosPage';
import { CentrosCustoPage } from './pages/centros-custo/CentrosCustoPage';
import { ChamadosListPage } from './pages/chamados/ChamadosListPage';
import { ChamadoCreatePage } from './pages/chamados/ChamadoCreatePage';
import { ChamadoDetalhePage } from './pages/chamados/ChamadoDetalhePage';
import { OrdensServicoPage } from './pages/ordens-servico/OrdensServicoPage';

import { CatalogoServicosPage } from './pages/catalogo/CatalogoServicosPage';
import { SlaPage } from './pages/sla/SlaPage';
import { SoftwaresListPage } from './pages/portfolio/SoftwaresListPage';
import { SoftwareFormPage } from './pages/portfolio/SoftwareFormPage';
import { SoftwareDetalhePage } from './pages/portfolio/SoftwareDetalhePage';
import { LicencasPage } from './pages/portfolio/LicencasPage';
import { ContratosListPage } from './pages/contratos/ContratosListPage';
import { ContratoFormPage } from './pages/contratos/ContratoFormPage';
import { ContratoDetalhePage } from './pages/contratos/ContratoDetalhePage';
import { ParadasListPage } from './pages/sustentacao/ParadasListPage';
import { ParadaFormPage } from './pages/sustentacao/ParadaFormPage';
import { ParadaDetalhePage } from './pages/sustentacao/ParadaDetalhePage';
import { MotivosParadaPage } from './pages/sustentacao/MotivosParadaPage';
import { ProjetosListPage } from './pages/projetos/ProjetosListPage';
import { ProjetoFormPage } from './pages/projetos/ProjetoFormPage';
import { ProjetoDetalhePage } from './pages/projetos/ProjetoDetalhePage';
import { PendenciaDetalhePage } from './pages/projetos/PendenciaDetalhePage';
import { AtivosListPage } from './pages/ativos/AtivosListPage';
import { AtivoFormPage } from './pages/ativos/AtivoFormPage';
import { AtivoDetalhePage } from './pages/ativos/AtivoDetalhePage';
import { ConhecimentoListPage } from './pages/conhecimento/ConhecimentoListPage';
import { ConhecimentoFormPage } from './pages/conhecimento/ConhecimentoFormPage';
import { ConhecimentoDetalhePage } from './pages/conhecimento/ConhecimentoDetalhePage';

import { AcompanhamentoPage } from './pages/acompanhamento/AcompanhamentoPage';
import { HorariosTrabalhoPage } from './pages/horarios/HorariosTrabalhoPage';
import { MonitorPlayerPage } from './pages/monitor/MonitorPlayerPage';
import { NotificacoesPage } from './pages/notificacoes/NotificacoesPage';
import { ImportPage } from './pages/import/ImportPage';
import { NaturezasPage } from './pages/cadastros/NaturezasPage';
import { TiposContratoPage } from './pages/cadastros/TiposContratoPage';
import { FornecedoresPage } from './pages/cadastros/FornecedoresPage';
import { ProdutosPage } from './pages/cadastros/ProdutosPage';
import { ToastProvider } from './components/Toast';
import type { ReactNode } from 'react';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { usuario, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-500">Carregando...</div>
      </div>
    );
  }

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  const temAcesso = usuario.modulos.some((m) => m.codigo === 'GESTAO_TI');
  if (!temAcesso) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-700 mb-2">Acesso Negado</p>
          <p className="text-slate-500 mb-4">Voce nao tem permissao para acessar a Gestao de T.I.</p>
          <a href="/" className="text-capul-600 hover:underline">Voltar ao Hub</a>
        </div>
      </div>
    );
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/gestao-ti"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="monitor" element={<MonitorPlayerPage />} />
        <Route path="acompanhamento" element={<AcompanhamentoPage />} />
        <Route path="chamados" element={<ChamadosListPage />} />
        <Route path="chamados/novo" element={<ChamadoCreatePage />} />
        <Route path="chamados/:id" element={<ChamadoDetalhePage />} />
        <Route path="ordens-servico" element={<OrdensServicoPage />} />

        <Route path="equipes" element={<EquipesListPage />} />
        <Route path="equipes/nova" element={<EquipeFormPage />} />
        <Route path="equipes/:id" element={<EquipeDetalhePage />} />
        <Route path="equipes/:id/editar" element={<EquipeFormPage />} />
        <Route path="softwares" element={<SoftwaresListPage />} />
        <Route path="softwares/novo" element={<SoftwareFormPage />} />
        <Route path="softwares/:id" element={<SoftwareDetalhePage />} />
        <Route path="softwares/:id/editar" element={<SoftwareFormPage />} />
        <Route path="licencas" element={<LicencasPage />} />
        <Route path="contratos" element={<ContratosListPage />} />
        <Route path="contratos/novo" element={<ContratoFormPage />} />
        <Route path="contratos/:id" element={<ContratoDetalhePage />} />
        <Route path="contratos/:id/editar" element={<ContratoFormPage />} />
        <Route path="paradas" element={<ParadasListPage />} />
        <Route path="paradas/nova" element={<ParadaFormPage />} />
        <Route path="paradas/:id" element={<ParadaDetalhePage />} />
        <Route path="paradas/:id/editar" element={<ParadaFormPage />} />
        <Route path="motivos-parada" element={<MotivosParadaPage />} />
        <Route path="projetos" element={<ProjetosListPage />} />
        <Route path="projetos/novo" element={<ProjetoFormPage />} />
        <Route path="projetos/:id" element={<ProjetoDetalhePage />} />
        <Route path="projetos/:id/editar" element={<ProjetoFormPage />} />
        <Route path="projetos/:projetoId/pendencias/:pendenciaId" element={<PendenciaDetalhePage />} />
        <Route path="ativos" element={<AtivosListPage />} />
        <Route path="ativos/novo" element={<AtivoFormPage />} />
        <Route path="ativos/:id" element={<AtivoDetalhePage />} />
        <Route path="ativos/:id/editar" element={<AtivoFormPage />} />
        <Route path="conhecimento" element={<ConhecimentoListPage />} />
        <Route path="conhecimento/novo" element={<ConhecimentoFormPage />} />
        <Route path="conhecimento/:id" element={<ConhecimentoDetalhePage />} />
        <Route path="conhecimento/:id/editar" element={<ConhecimentoFormPage />} />

        <Route path="notificacoes" element={<NotificacoesPage />} />
        <Route path="importar" element={<ImportPage />} />
        <Route path="horarios-trabalho" element={<HorariosTrabalhoPage />} />
        <Route path="catalogo" element={<CatalogoServicosPage />} />
        <Route path="sla" element={<SlaPage />} />
        <Route path="departamentos" element={<DepartamentosPage />} />
        <Route path="centros-custo" element={<CentrosCustoPage />} />
        <Route path="naturezas" element={<NaturezasPage />} />
        <Route path="tipos-contrato" element={<TiposContratoPage />} />
        <Route path="fornecedores" element={<FornecedoresPage />} />
        <Route path="produtos" element={<ProdutosPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/gestao-ti" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
