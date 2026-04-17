import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth, hasMinRole } from './contexts/AuthContext';
import { ToastProvider } from './components/Toast';
import { ConfirmProvider } from './components/ConfirmDialog';
import { MainLayout } from './layouts/MainLayout';
import { DashboardPage } from './pages/DashboardPage';
import { NfeConsultaPage } from './pages/NfeConsultaPage';
import { CteConsultaPage } from './pages/CteConsultaPage';
import { CadastroConsultaPage } from './pages/CadastroConsultaPage';
import { AdminPage } from './pages/AdminPage';
import { ExecucoesListPage } from './pages/ExecucoesListPage';
import { ExecucaoDetalhePage } from './pages/ExecucaoDetalhePage';
import { AlertasHistoricoPage } from './pages/AlertasHistoricoPage';
import type { RoleFiscal } from './types';

function ProtectedRoute({
  children,
  minRole,
}: {
  children: ReactNode;
  minRole?: RoleFiscal;
}) {
  const { usuario, loading, fiscalRole } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Carregando…
      </div>
    );
  }

  if (!usuario) {
    window.location.href = '/login';
    return null;
  }

  const temAcesso = usuario.modulos.some((m) => m.codigo === 'FISCAL');
  if (!temAcesso) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="max-w-md rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
          <h2 className="text-lg font-semibold text-amber-900">Sem acesso ao Módulo Fiscal</h2>
          <p className="mt-2 text-sm text-amber-800">
            Seu usuário não possui a role necessária. Solicite acesso ao ADMIN_TI.
          </p>
        </div>
      </div>
    );
  }

  if (minRole && !hasMinRole(fiscalRole, minRole)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          <BrowserRouter basename="/fiscal">
            <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="nfe" element={<NfeConsultaPage />} />
            <Route path="cte" element={<CteConsultaPage />} />
            <Route path="cadastro" element={<CadastroConsultaPage />} />
            <Route
              path="execucoes"
              element={
                <ProtectedRoute minRole="ANALISTA_CADASTRO">
                  <ExecucoesListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="execucoes/:id"
              element={
                <ProtectedRoute minRole="ANALISTA_CADASTRO">
                  <ExecucaoDetalhePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="alertas"
              element={
                <ProtectedRoute minRole="GESTOR_FISCAL">
                  <AlertasHistoricoPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin"
              element={
                <ProtectedRoute minRole="ADMIN_TI">
                  <AdminPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
          </BrowserRouter>
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
