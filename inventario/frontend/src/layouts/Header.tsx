import { useAuth } from '../contexts/AuthContext';
import { User } from 'lucide-react';

export function Header({ title }: { title: string }) {
  const { usuario, inventarioRole } = useAuth();

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
      <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
      <div className="flex items-center gap-4">
        <span className="text-xs px-2 py-1 rounded-full bg-capul-100 text-capul-700 font-medium">
          {inventarioRole}
        </span>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <User className="w-4 h-4" />
          {usuario?.nome}
        </div>
      </div>
    </header>
  );
}
