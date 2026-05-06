import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuth } from '../contexts/AuthContext';
import { usePresencaHeartbeat, AvisoPlataformaBanner } from '../hooks/usePresencaHeartbeat';

export function MainLayout() {
  const { usuario } = useAuth();
  const { aviso } = usePresencaHeartbeat(!!usuario);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-y-auto">
        <AvisoPlataformaBanner aviso={aviso} />
        <Outlet />
      </main>
    </div>
  );
}
