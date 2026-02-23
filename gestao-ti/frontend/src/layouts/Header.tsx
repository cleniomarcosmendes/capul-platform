import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { notificacaoService } from '../services/notificacao.service';
import { User, Bell } from 'lucide-react';

export function Header({ title }: { title: string }) {
  const { usuario, gestaoTiRole } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchCount = () => {
      notificacaoService.contarNaoLidas().then((r) => setUnreadCount(r.count)).catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 60_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
      <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
      <div className="flex items-center gap-4">
        <Link to="/gestao-ti/notificacoes" className="relative text-slate-500 hover:text-slate-700 transition-colors">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4.5 h-4.5 flex items-center justify-center min-w-[18px] h-[18px] px-1">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>
        <span className="text-xs px-2 py-1 rounded-full bg-capul-100 text-capul-700 font-medium">
          {gestaoTiRole}
        </span>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <User className="w-4 h-4" />
          {usuario?.nome}
        </div>
      </div>
    </header>
  );
}
