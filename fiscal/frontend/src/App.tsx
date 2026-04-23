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
import { ExecucoesListPage } from './pages/ExecucoesListPage';
import { ExecucaoDetalhePage } from './pages/ExecucaoDetalhePage';
import { AlertasHistoricoPage } from './pages/AlertasHistoricoPage';
import { DivergenciasListPage } from './pages/DivergenciasListPage';
import { OperacaoControlePage } from './pages/operacao/OperacaoControlePage';
import { OperacaoDiagnosticoPage } from './pages/operacao/OperacaoDiagnosticoPage';
import { AmbienteTab } from './pages/operacao/tabs/AmbienteTab';
import { AgendamentosTab } from './pages/operacao/tabs/AgendamentosTab';
import { FreioDeMaoTab } from './pages/operacao/tabs/FreioDeMaoTab';
import { LimitesTab } from './pages/operacao/tabs/LimitesTab';
import { CircuitBreakerTab } from './pages/operacao/tabs/CircuitBreakerTab';
import { CadeiaTlsTab } from './pages/operacao/tabs/CadeiaTlsTab';
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
    // Operador/Analista nao tem acesso a Dashboard ou rotas avancadas —
    // manda para a primeira tela permitida (Consulta NF-e).
    return <Navigate to="/nfe" replace />;
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
            <Route
              index
              element={
                <ProtectedRoute minRole="GESTOR_FISCAL">
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route path="nfe" element={<NfeConsultaPage />} />
            <Route path="cte" element={<CteConsultaPage />} />
            <Route path="cadastro" element={<CadastroConsultaPage />} />
            <Route
              path="execucoes"
              element={
                <ProtectedRoute minRole="GESTOR_FISCAL">
                  <ExecucoesListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="execucoes/:id"
              element={
                <ProtectedRoute minRole="GESTOR_FISCAL">
                  <ExecucaoDetalhePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="divergencias"
              element={
                <ProtectedRoute minRole="GESTOR_FISCAL">
                  <DivergenciasListPage />
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
            {/* Hub Operação: Controle Operacional (ações) */}
            <Route
              path="operacao/controle"
              element={
                <ProtectedRoute minRole="GESTOR_FISCAL">
                  <OperacaoControlePage />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="ambiente" replace />} />
              <Route
                path="ambiente"
                element={
                  <ProtectedRoute minRole="GESTOR_FISCAL">
                    <AmbienteTab />
                  </ProtectedRoute>
                }
              />
              <Route
                path="agendamentos"
                element={
                  <ProtectedRoute minRole="GESTOR_FISCAL">
                    <AgendamentosTab />
                  </ProtectedRoute>
                }
              />
              <Route
                path="freio"
                element={
                  <ProtectedRoute minRole="GESTOR_FISCAL">
                    <FreioDeMaoTab />
                  </ProtectedRoute>
                }
              />
              <Route
                path="limites"
                element={
                  <ProtectedRoute minRole="GESTOR_FISCAL">
                    <LimitesTab />
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* Hub Operação: Diagnóstico (troubleshooting) */}
            <Route
              path="operacao/diagnostico"
              element={
                <ProtectedRoute minRole="GESTOR_FISCAL">
                  <OperacaoDiagnosticoPage />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="circuit-breaker" replace />} />
              <Route
                path="circuit-breaker"
                element={
                  <ProtectedRoute minRole="GESTOR_FISCAL">
                    <CircuitBreakerTab />
                  </ProtectedRoute>
                }
              />
              <Route
                path="tls"
                element={
                  <ProtectedRoute minRole="ADMIN_TI">
                    <CadeiaTlsTab />
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* Redirects das URLs antigas — preserva bookmarks existentes */}
            <Route path="operacao" element={<Navigate to="/operacao/controle" replace />} />
            <Route path="operacao/ambiente" element={<Navigate to="/operacao/controle/ambiente" replace />} />
            <Route path="operacao/agendamentos" element={<Navigate to="/operacao/controle/agendamentos" replace />} />
            <Route path="operacao/limites" element={<Navigate to="/operacao/controle/limites" replace />} />
            <Route path="operacao/circuit-breaker" element={<Navigate to="/operacao/diagnostico/circuit-breaker" replace />} />
            <Route path="operacao/tls" element={<Navigate to="/operacao/diagnostico/tls" replace />} />

            <Route path="admin" element={<Navigate to="/operacao/controle" replace />} />
            {/* Fallback: roles baixas serao redirecionadas pelo ProtectedRoute do `/` para /nfe */}
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
