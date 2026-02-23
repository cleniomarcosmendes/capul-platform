import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { notificacaoService } from '../../services/notificacao.service';
import {
  Bell, Ticket, AlertTriangle, KeyRound, FileText, DollarSign,
  Activity, FolderKanban, Trash2, CheckCheck,
} from 'lucide-react';
import type { Notificacao, TipoNotificacao } from '../../types';

const iconesPorTipo: Record<TipoNotificacao, React.ComponentType<{ className?: string }>> = {
  CHAMADO_ATRIBUIDO: Ticket,
  CHAMADO_ATUALIZADO: Ticket,
  SLA_ESTOURADO: AlertTriangle,
  LICENCA_VENCENDO: KeyRound,
  CONTRATO_VENCENDO: FileText,
  PARCELA_ATRASADA: DollarSign,
  PARADA_INICIADA: Activity,
  PROJETO_ATUALIZADO: FolderKanban,
  GERAL: Bell,
};

const coresPorTipo: Record<TipoNotificacao, string> = {
  CHAMADO_ATRIBUIDO: 'bg-blue-100 text-blue-600',
  CHAMADO_ATUALIZADO: 'bg-capul-100 text-capul-600',
  SLA_ESTOURADO: 'bg-red-100 text-red-600',
  LICENCA_VENCENDO: 'bg-amber-100 text-amber-600',
  CONTRATO_VENCENDO: 'bg-orange-100 text-orange-600',
  PARCELA_ATRASADA: 'bg-rose-100 text-rose-600',
  PARADA_INICIADA: 'bg-red-100 text-red-600',
  PROJETO_ATUALIZADO: 'bg-indigo-100 text-indigo-600',
  GERAL: 'bg-slate-100 text-slate-600',
};

type Filtro = 'todas' | 'nao_lidas' | 'lidas';

function tempoRelativo(data: string): string {
  const diff = Date.now() - new Date(data).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  return new Date(data).toLocaleDateString('pt-BR');
}

export function NotificacoesPage() {
  const navigate = useNavigate();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>('todas');

  const fetchNotificacoes = () => {
    setLoading(true);
    const lida = filtro === 'lidas' ? true : filtro === 'nao_lidas' ? false : undefined;
    notificacaoService.listar(lida)
      .then(setNotificacoes)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchNotificacoes(); }, [filtro]);

  async function handleMarcarTodasLidas() {
    await notificacaoService.marcarTodasLidas().catch(() => {});
    fetchNotificacoes();
  }

  async function handleClick(notif: Notificacao) {
    if (!notif.lida) {
      await notificacaoService.marcarLida(notif.id).catch(() => {});
      setNotificacoes((prev) => prev.map((n) => n.id === notif.id ? { ...n, lida: true } : n));
    }
    // Navegar para a entidade se houver dados
    if (notif.dadosJson) {
      try {
        const dados = JSON.parse(notif.dadosJson);
        if (dados.chamadoId) navigate(`/gestao-ti/chamados/${dados.chamadoId}`);
        else if (dados.projetoId) navigate(`/gestao-ti/projetos/${dados.projetoId}`);
        else if (dados.contratoId) navigate(`/gestao-ti/contratos/${dados.contratoId}`);
      } catch { /* ignore */ }
    }
  }

  async function handleRemover(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    await notificacaoService.remover(id).catch(() => {});
    setNotificacoes((prev) => prev.filter((n) => n.id !== id));
  }

  const filtros: { key: Filtro; label: string }[] = [
    { key: 'todas', label: 'Todas' },
    { key: 'nao_lidas', label: 'Nao Lidas' },
    { key: 'lidas', label: 'Lidas' },
  ];

  return (
    <>
      <Header title="Notificacoes" />
      <div className="p-6 max-w-3xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            {filtros.map((f) => (
              <button
                key={f.key}
                onClick={() => setFiltro(f.key)}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                  filtro === f.key
                    ? 'bg-capul-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            onClick={handleMarcarTodasLidas}
            className="flex items-center gap-1.5 text-xs text-capul-600 hover:text-capul-700 font-medium"
          >
            <CheckCheck className="w-4 h-4" />
            Marcar todas como lidas
          </button>
        </div>

        {loading ? (
          <p className="text-center text-slate-400 py-8">Carregando...</p>
        ) : notificacoes.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Nenhuma notificacao</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notificacoes.map((notif) => {
              const Icon = iconesPorTipo[notif.tipo] || Bell;
              const cor = coresPorTipo[notif.tipo] || 'bg-slate-100 text-slate-600';
              return (
                <div
                  key={notif.id}
                  onClick={() => handleClick(notif)}
                  className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                    notif.lida
                      ? 'bg-white border-slate-200 hover:bg-slate-50'
                      : 'bg-capul-50/50 border-capul-200 hover:bg-capul-50'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg ${cor} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${notif.lida ? 'text-slate-700' : 'text-slate-800 font-semibold'}`}>
                      {notif.titulo}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notif.mensagem}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{tempoRelativo(notif.createdAt)}</p>
                  </div>
                  <button
                    onClick={(e) => handleRemover(e, notif.id)}
                    className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0 mt-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
