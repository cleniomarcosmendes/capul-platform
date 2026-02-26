import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import { RelatoriosPage } from './pages/RelatoriosPage';
import { SincronizacaoPage } from './pages/SincronizacaoPage';
import { ImportPage } from './pages/ImportPage';
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
        <Route path="relatorios" element={<RelatoriosPage />} />
        <Route path="sincronizacao" element={<SincronizacaoPage />} />
        <Route path="importacao" element={<ImportPage />} />
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
