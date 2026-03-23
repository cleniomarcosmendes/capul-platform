import { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { monitorService } from '../../services/monitor.service';
import type { MonitorData, MonitorChamado, MonitorAtividade } from '../../services/monitor.service';
import { Play, Square, Ticket, FolderKanban, Clock, StopCircle, RefreshCw, ExternalLink } from 'lucide-react';

const prioridadeColors: Record<string, string> = {
  CRITICA: 'bg-red-100 text-red-700',
  ALTA: 'bg-orange-100 text-orange-700',
  MEDIA: 'bg-yellow-100 text-yellow-700',
  BAIXA: 'bg-green-100 text-green-700',
};

const statusLabels: Record<string, string> = {
  ABERTO: 'Aberto',
  EM_ATENDIMENTO: 'Em Atendimento',
  PENDENTE: 'Pendente',
  REABERTO: 'Reaberto',
  EM_ANDAMENTO: 'Em Andamento',
};

function formatElapsed(inicio: string): string {
  const diff = Date.now() - new Date(inicio).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const m = mins % 60;
  if (hrs > 0) return `${hrs}h ${m.toString().padStart(2, '0')}min`;
  return `${m}min`;
}

export function MonitorPlayerPage() {
  const [data, setData] = useState<MonitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const carregar = useCallback(async () => {
    try {
      const result = await monitorService.getMeusItens();
      setData(result);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
    // Polling a cada 10s para atualizar dados
    const poll = setInterval(carregar, 10000);
    // Atualizar imediatamente quando usuario volta a aba
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') carregar();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(poll);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [carregar]);

  // Tick a cada segundo para atualizar timers visuais
  useEffect(() => {
    intervalRef.current = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  // Suprimir warning de tick não utilizado diretamente
  void tick;

  async function handleIniciarChamado(chamadoId: string) {
    setActionLoading(chamadoId);
    try {
      await monitorService.iniciarTimerChamado(chamadoId);
      await carregar();
    } catch { /* */ }
    setActionLoading(null);
  }

  async function handlePararChamado(chamadoId: string) {
    setActionLoading(chamadoId);
    try {
      await monitorService.encerrarTimerChamado(chamadoId);
      await carregar();
    } catch { /* */ }
    setActionLoading(null);
  }

  async function handleIniciarAtividade(atividadeId: string) {
    setActionLoading(atividadeId);
    try {
      await monitorService.iniciarTimerAtividade(atividadeId);
      await carregar();
    } catch { /* */ }
    setActionLoading(null);
  }

  async function handlePararAtividade(atividadeId: string) {
    setActionLoading(atividadeId);
    try {
      await monitorService.encerrarTimerAtividade(atividadeId);
      await carregar();
    } catch { /* */ }
    setActionLoading(null);
  }

  async function handleEncerrarTodos() {
    setActionLoading('encerrar');
    try {
      await monitorService.encerrarTodos();
      await carregar();
    } catch { /* */ }
    setActionLoading(null);
  }

  if (loading) {
    return (
      <>
        <Header title="Monitor de Atividades" />
        <div className="p-6 text-center text-slate-500">Carregando...</div>
      </>
    );
  }

  const timerChamadoMap = new Map(data?.timers.chamados.map((t) => [t.chamadoId, t]) || []);
  const timerAtividadeMap = new Map(data?.timers.atividades.map((t) => [t.atividadeId, t]) || []);
  const temTimerAtivo = (data?.timers.chamados.length || 0) + (data?.timers.atividades.length || 0) > 0;

  const chamados = data?.chamados || [];
  const atividades = data?.atividades || [];

  // Ordenar: itens com timer ativo primeiro
  const chamadosOrdenados = [...chamados].sort((a, b) => {
    const aAtivo = timerChamadoMap.has(a.id) ? -1 : 0;
    const bAtivo = timerChamadoMap.has(b.id) ? -1 : 0;
    return aAtivo - bAtivo;
  });

  const atividadesOrdenadas = [...atividades].sort((a, b) => {
    const aAtivo = timerAtividadeMap.has(a.id) ? -1 : 0;
    const bAtivo = timerAtividadeMap.has(b.id) ? -1 : 0;
    return aAtivo - bAtivo;
  });

  return (
    <>
      <Header title="Monitor de Atividades" />
      <div className="p-6 max-w-5xl">
        {/* Barra de ações */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Clock className="w-4 h-4" />
              <span>{chamados.length} chamado(s)</span>
              <span className="text-slate-300">|</span>
              <span>{atividades.length} atividade(s)</span>
            </div>
            {temTimerAtivo && (
              <span className="flex items-center gap-1.5 text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Timer ativo
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {temTimerAtivo && (
              <button
                onClick={handleEncerrarTodos}
                disabled={actionLoading === 'encerrar'}
                className="flex items-center gap-1.5 text-xs bg-red-50 text-red-600 hover:bg-red-100 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                <StopCircle className="w-4 h-4" />
                Parar Todos
              </button>
            )}
            <button
              onClick={() => { setLoading(true); carregar(); }}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Atualizar
            </button>
          </div>
        </div>

        {chamados.length === 0 && atividades.length === 0 && (
          <div className="text-center py-16">
            <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Nenhum chamado ou atividade ativa no momento</p>
            <p className="text-xs text-slate-400 mt-1">Seus chamados em atendimento e atividades de projeto aparecerao aqui</p>
          </div>
        )}

        {/* Chamados */}
        {chamadosOrdenados.length > 0 && (
          <div className="mb-8">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
              <Ticket className="w-4 h-4 text-capul-600" />
              Chamados ({chamados.length})
            </h3>
            <div className="space-y-2">
              {chamadosOrdenados.map((chamado) => (
                <ChamadoCard
                  key={chamado.id}
                  chamado={chamado}
                  timer={timerChamadoMap.get(chamado.id)}
                  onPlay={() => handleIniciarChamado(chamado.id)}
                  onStop={() => handlePararChamado(chamado.id)}
                  loading={actionLoading === chamado.id}
                />
              ))}
            </div>
          </div>
        )}

        {/* Atividades */}
        {atividadesOrdenadas.length > 0 && (
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
              <FolderKanban className="w-4 h-4 text-indigo-600" />
              Atividades de Projeto ({atividades.length})
            </h3>
            <div className="space-y-2">
              {atividadesOrdenadas.map((atividade) => (
                <AtividadeCard
                  key={atividade.id}
                  atividade={atividade}
                  timer={timerAtividadeMap.get(atividade.id)}
                  onPlay={() => handleIniciarAtividade(atividade.id)}
                  onStop={() => handlePararAtividade(atividade.id)}
                  loading={actionLoading === atividade.id}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function ChamadoCard({
  chamado,
  timer,
  onPlay,
  onStop,
  loading,
}: {
  chamado: MonitorChamado;
  timer?: { id: string; horaInicio: string };
  onPlay: () => void;
  onStop: () => void;
  loading: boolean;
}) {
  const isAtivo = !!timer;

  return (
    <div className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
      isAtivo
        ? 'bg-green-50 border-green-300 shadow-sm shadow-green-100'
        : 'bg-white border-slate-200 hover:border-slate-300'
    }`}>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-mono">#{chamado.numero}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${prioridadeColors[chamado.prioridade] || 'bg-slate-100 text-slate-600'}`}>
            {chamado.prioridade}
          </span>
          <span className="text-xs text-slate-400">{statusLabels[chamado.status] || chamado.status}</span>
        </div>
        <p className="text-sm font-medium text-slate-800 truncate mt-0.5">{chamado.titulo}</p>
        <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
          <span>{chamado.equipeAtual.sigla}</span>
          <span>Filial {chamado.filial.codigo}</span>
          <span>{chamado.solicitante.nome}</span>
        </div>
      </div>

      {/* Timer + Actions */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {isAtivo && (
          <div className="flex items-center gap-1.5 text-sm font-mono text-green-700 bg-green-100 px-3 py-1.5 rounded-lg">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            {formatElapsed(timer.horaInicio)}
          </div>
        )}
        {isAtivo ? (
          <button
            onClick={onStop}
            disabled={loading}
            className="flex items-center gap-1 text-sm font-medium text-red-600 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            <Square className="w-3.5 h-3.5" /> Encerrar
          </button>
        ) : (
          <button
            onClick={onPlay}
            disabled={loading}
            className="flex items-center gap-1 text-sm font-medium text-green-600 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" /> Iniciar
          </button>
        )}
        <Link
          to={`/gestao-ti/chamados/${chamado.id}`}
          className="text-slate-400 hover:text-capul-600 transition-colors"
          title="Abrir chamado"
        >
          <ExternalLink className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

function AtividadeCard({
  atividade,
  timer,
  onPlay,
  onStop,
  loading,
}: {
  atividade: MonitorAtividade;
  timer?: { id: string; horaInicio: string };
  onPlay: () => void;
  onStop: () => void;
  loading: boolean;
}) {
  const isAtivo = !!timer;

  return (
    <div className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
      isAtivo
        ? 'bg-green-50 border-green-300 shadow-sm shadow-green-100'
        : 'bg-white border-slate-200 hover:border-slate-300'
    }`}>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-indigo-500 font-mono">Proj #{atividade.projeto.numero}</span>
          <span className="text-xs text-slate-400">{statusLabels[atividade.status] || atividade.status}</span>
        </div>
        <p className="text-sm font-medium text-slate-800 truncate mt-0.5">{atividade.titulo}</p>
        <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
          <span>{atividade.projeto.nome}</span>
          {atividade.fase && <span>Fase: {atividade.fase.nome}</span>}
        </div>
      </div>

      {/* Timer + Actions */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {isAtivo && (
          <div className="flex items-center gap-1.5 text-sm font-mono text-green-700 bg-green-100 px-3 py-1.5 rounded-lg">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            {formatElapsed(timer.horaInicio)}
          </div>
        )}
        {isAtivo ? (
          <button
            onClick={onStop}
            disabled={loading}
            className="flex items-center gap-1 text-sm font-medium text-red-600 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            <Square className="w-3.5 h-3.5" /> Encerrar
          </button>
        ) : (
          <button
            onClick={onPlay}
            disabled={loading}
            className="flex items-center gap-1 text-sm font-medium text-green-600 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" /> Iniciar
          </button>
        )}
        <Link
          to={`/gestao-ti/projetos/${atividade.projeto.id}`}
          className="text-slate-400 hover:text-indigo-600 transition-colors"
          title="Abrir projeto"
        >
          <ExternalLink className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
