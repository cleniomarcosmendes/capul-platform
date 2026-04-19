import { useEffect, useState } from 'react';
import { Clock, Calendar, RefreshCw } from 'lucide-react';
import { fiscalApi } from '../services/api';
import { PageWrapper } from '../components/PageWrapper';
import { Button } from '../components/Button';
import { useToast } from '../components/Toast';
import { useAuth } from '../contexts/AuthContext';
import { extractApiError } from '../utils/errors';

interface SchedulerStatus {
  meioDia: { cron: string; proxima: string | null } | null;
  manhaSeguinte: { cron: string; proxima: string | null } | null;
}

export function OperacaoAgendamentosPage() {
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [recarregando, setRecarregando] = useState(false);
  const toast = useToast();
  const { fiscalRole } = useAuth();
  const isAdmin = fiscalRole === 'ADMIN_TI';

  async function load() {
    try {
      setLoading(true);
      const { data } = await fiscalApi.get<SchedulerStatus>('/cruzamento/scheduler/status');
      setStatus(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, []);

  async function handleRecarregar() {
    setRecarregando(true);
    try {
      await fiscalApi.post('/cruzamento/scheduler/recarregar');
      toast.success('Scheduler recarregado', 'Os crons foram relidos do banco.');
      load();
    } catch (err) {
      toast.error('Falha ao recarregar', extractApiError(err));
    } finally {
      setRecarregando(false);
    }
  }

  return (
    <PageWrapper title="Agendamentos do Cruzamento">
      <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
        Duas corridas diárias automáticas alinhadas à janela de 24h de cancelamento de NF-e
        (Plano v2.0 §2.1). Cada corrida varre apenas os CNPJs que tiveram movimento fiscal no
        período, deduplicados por CNPJ+UF.
      </div>

      {loading ? (
        <div className="text-slate-500">Carregando…</div>
      ) : (
        <div className="space-y-3">
          <ScheduleCard
            title="Corrida do meio-dia"
            descricao="Movimento hoje 00:00 → 12:00 (captura problemas cadastrais no mesmo dia)"
            info={status?.meioDia ?? null}
          />
          <ScheduleCard
            title="Corrida da manhã seguinte"
            descricao="Movimento ontem 12:00 → 23:59 (ainda dentro das 24h de cancelamento)"
            info={status?.manhaSeguinte ?? null}
          />
        </div>
      )}

      {isAdmin && (
        <div className="mt-6 rounded-md border border-slate-200 bg-white p-4">
          <p className="mb-2 text-xs text-slate-600">
            Ajuste dos horários é feito na tabela <code>fiscal.ambiente_config</code>. Após
            alterar, clique abaixo para reler sem reiniciar o backend.
          </p>
          <Button variant="secondary" size="sm" onClick={handleRecarregar} loading={recarregando}>
            <RefreshCw className="mr-1 h-3 w-3" />
            Recarregar scheduler
          </Button>
        </div>
      )}
    </PageWrapper>
  );
}

function ScheduleCard({
  title,
  descricao,
  info,
}: {
  title: string;
  descricao: string;
  info: { cron: string; proxima: string | null } | null;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Calendar className="h-4 w-4 text-indigo-600" />
            {title}
          </h4>
          <p className="mt-0.5 text-xs text-slate-600">{descricao}</p>
        </div>
        <div className="text-right">
          {info ? (
            <>
              <p className="font-mono text-[11px] text-slate-500">{info.cron}</p>
              <p className="mt-1 flex items-center gap-1 text-xs text-slate-700">
                <Clock className="h-3 w-3" />
                {info.proxima
                  ? new Date(info.proxima).toLocaleString('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })
                  : 'Sem próxima execução'}
              </p>
            </>
          ) : (
            <span className="text-xs text-red-600">Não agendado</span>
          )}
        </div>
      </div>
    </div>
  );
}
