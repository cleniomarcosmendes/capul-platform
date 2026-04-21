import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './components/Toast';
import { ConfirmProvider } from './components/ConfirmDialog';
import { MainLayout } from './layouts/MainLayout';
import { DashboardPage } from './pages/DashboardPage';
import { EmpresaFiliaisPage } from './pages/empresa/EmpresaFiliaisPage';
import { TiposDepartamentoPage } from './pages/tipos-departamento/TiposDepartamentoPage';
import { DepartamentosPage } from './pages/departamentos/DepartamentosPage';
import { CentrosCustoPage } from './pages/centros-custo/CentrosCustoPage';
import { UsuariosListPage } from './pages/usuarios/UsuariosListPage';
import { UsuarioFormPage } from './pages/usuarios/UsuarioFormPage';
import { IntegracoesPage } from './pages/integracoes/IntegracoesPage';
import { CertificadoFiscalPage } from './pages/certificado/CertificadoFiscalPage';
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

  const temAcesso = usuario.modulos.some((m) => m.codigo === 'CONFIGURADOR');
  if (!temAcesso) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-700 mb-2">Acesso Negado</p>
          <p className="text-slate-500 mb-4">Voce nao tem permissao para acessar o Configurador.</p>
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
        path="/configurador"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="empresa" element={<EmpresaFiliaisPage />} />
        <Route path="tipos-departamento" element={<TiposDepartamentoPage />} />
        <Route path="departamentos" element={<DepartamentosPage />} />
        <Route path="centros-custo" element={<CentrosCustoPage />} />
        <Route path="usuarios" element={<UsuariosListPage />} />
        <Route path="usuarios/novo" element={<UsuarioFormPage />} />
        <Route path="usuarios/:id" element={<UsuarioFormPage />} />
        <Route path="integracoes" element={<IntegracoesPage />} />
        <Route path="certificado-fiscal" element={<CertificadoFiscalPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/configurador" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ConfirmProvider>
            <AppRoutes />
          </ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
