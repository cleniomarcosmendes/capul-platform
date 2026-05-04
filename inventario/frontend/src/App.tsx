import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { MainLayout } from './layouts/MainLayout';
import { DashboardPage } from './pages/DashboardPage';
import { InventariosListPage } from './pages/inventarios/InventariosListPage';
import { InventarioCreatePage } from './pages/inventarios/InventarioCreatePage';
import { InventarioDetalhePage } from './pages/inventarios/InventarioDetalhePage';
import { ContagemSelectorPage } from './pages/contagem/ContagemSelectorPage';
import { ContagemDesktopPage } from './pages/contagem/ContagemDesktopPage';
import { ContagemMobilePage } from './pages/contagem/ContagemMobilePage';
import { ProdutosPage } from './pages/ProdutosPage';
import { ArmazensPage } from './pages/ArmazensPage';
import { ImportPage } from './pages/ImportPage';
import MonitoramentoPage from './pages/MonitoramentoPage';
import DivergenciasPage from './pages/DivergenciasPage';
import IntegracoesPage from './pages/IntegracoesPage';
import IntegracaoDetalhePage from './pages/IntegracaoDetalhePage';
import IntegracaoNovaPage from './pages/IntegracaoNovaPage';
import type { ReactNode } from 'react';

/** Redireciona /inventario/comparacao e /inventario/relatorios pra a tab equivalente em /divergencias. */
function RedirectToAnaliseTab({ tab }: { tab: 'historica' | 'relatorios' }) {
  const [params] = useSearchParams();
  const queryStr = params.toString();
  const target = `/inventario/divergencias?tab=${tab}${queryStr ? '&' + queryStr : ''}`;
  return <Navigate to={target} replace />;
}

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

  const temAcesso = usuario.modulos.some((m) => m.codigo === 'INVENTARIO');
  if (!temAcesso) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-700 mb-2">Acesso Negado</p>
          <p className="text-slate-500 mb-4">Voce nao tem permissao para acessar o Inventario.</p>
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
      {/* Rotas com MainLayout (sidebar) */}
      <Route
        path="/inventario"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="inventarios" element={<InventariosListPage />} />
        <Route path="inventarios/novo" element={<InventarioCreatePage />} />
        <Route path="inventarios/:id" element={<InventarioDetalhePage />} />
        <Route path="contagem" element={<ContagemSelectorPage />} />
        <Route path="contagem/:inventoryId/desktop" element={<ContagemDesktopPage />} />
        <Route path="produtos" element={<ProdutosPage />} />
        <Route path="armazens" element={<ArmazensPage />} />
        <Route path="importacao" element={<ImportPage />} />
        <Route path="monitoramento" element={<MonitoramentoPage />} />
        <Route path="divergencias" element={<DivergenciasPage />} />
        {/* Redirects de URLs antigas (compat: bookmarks externos) */}
        <Route path="comparacao" element={<RedirectToAnaliseTab tab="historica" />} />
        <Route path="relatorios" element={<RedirectToAnaliseTab tab="relatorios" />} />
        <Route path="integracoes" element={<IntegracoesPage />} />
        <Route path="integracoes/nova" element={<IntegracaoNovaPage />} />
        <Route path="integracoes/:id" element={<IntegracaoDetalhePage />} />
      </Route>

      {/* Contagem Mobile — fullscreen, SEM sidebar */}
      <Route
        path="/inventario/contagem/:inventoryId/mobile"
        element={
          <ProtectedRoute>
            <ContagemMobilePage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/inventario" replace />} />
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
