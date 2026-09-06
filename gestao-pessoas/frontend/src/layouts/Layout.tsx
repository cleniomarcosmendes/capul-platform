import { Outlet } from 'react-router-dom';
import { Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

/**
 * Cabeçalho enxuto de propósito: a tela do avaliador é uma tarefa, não um
 * painel. Menu, filtros e navegação lateral entram quando existirem as telas
 * de RH — aqui só atrapalhariam quem está respondendo no celular.
 */
export default function Layout() {
  const { usuario } = useAuth();
  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-capul-600">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          <Users size={18} className="text-white/80" aria-hidden />
          <h1 className="flex-1 font-semibold text-white">Avaliação de Desempenho</h1>
          {usuario?.nome && (
            <span className="truncate text-sm text-white/80">{usuario.nome}</span>
          )}
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
