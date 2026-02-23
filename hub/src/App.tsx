import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import HubPage from './pages/HubPage';
import PerfilPage from './pages/PerfilPage';
import UsuariosPage from './pages/UsuariosPage';
import UsuarioFormPage from './pages/UsuarioFormPage';
import './index.css';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { usuario } = useAuth();
  if (!usuario) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { usuario } = useAuth();
  if (usuario) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HubPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/perfil"
        element={
          <ProtectedRoute>
            <PerfilPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/usuarios"
        element={
          <ProtectedRoute>
            <UsuariosPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/usuarios/novo"
        element={
          <ProtectedRoute>
            <UsuarioFormPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/usuarios/:id"
        element={
          <ProtectedRoute>
            <UsuarioFormPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
