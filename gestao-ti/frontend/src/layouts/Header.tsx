import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { notificacaoService } from '../services/notificacao.service';
import { coreApi } from '../services/api';
import { User, Bell, Radio } from 'lucide-react';

export function Header({ title }: { title: string }) {
  const { usuario, gestaoTiRole } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [apiAmbiente, setApiAmbiente] = useState<string | null>(null);

  useEffect(() => {
    const fetchCount = () => {
      notificacaoService.contarNaoLidas().then((r) => setUnreadCount(r.count)).catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    coreApi.get('/integracoes')
      .then(({ data }) => {
        const protheus = data.find((i: any) => i.codigo === 'PROTHEUS');
        if (protheus) setApiAmbiente(protheus.ambiente);
      })
      .catch(() => {});
  }, []);

  const isProd = apiAmbiente === 'PRODUCAO';

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
      <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
      <div className="flex items-center gap-4">
        {apiAmbiente && (
          <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${
            isProd
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            <Radio className={`w-3 h-3 ${isProd ? 'text-red-500' : 'text-amber-500'}`} />
            API-{isProd ? 'PRD' : 'HLG'}
          </div>
        )}
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
