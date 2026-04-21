import { useEffect, useState } from 'react';
import { Clock, Calendar, Save, Info, AlertCircle } from 'lucide-react';
import { fiscalApi } from '../../../services/api';
import { Button } from '../../../components/Button';
import { useToast } from '../../../components/Toast';
import { useAuth } from '../../../contexts/AuthContext';
import { extractApiError } from '../../../utils/errors';

interface SchedulerStatus {
  meioDia: { cron: string; proxima: string | null } | null;
  manhaSeguinte: { cron: string; proxima: string | null } | null;
}

interface AmbienteStatus {
  cronMovimentoMeioDia: string;
  cronMovimentoManhaSeguinte: string;
}

export function AgendamentosTab() {
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const toast = useToast();
  const { fiscalRole } = useAuth();
  const isAdmin = fiscalRole === 'ADMIN_TI';

  // Campos editaveis (sincronizados ao carregar). Separados de `status` para
  // permitir edicao local sem afetar a visualizacao do "cron em execucao".
  const [cronMeioDia, setCronMeioDia] = useState('');
  const [cronManhaSeguinte, setCronManhaSeguinte] = useState('');

  async function load() {
    try {
      setLoading(true);
      const [schedulerResp, ambienteResp] = await Promise.all([
        fiscalApi.get<SchedulerStatus>('/cruzamento/scheduler/status'),
        fiscalApi.get<AmbienteStatus>('/ambiente'),
      ]);
      setStatus(schedulerResp.data);
      setCronMeioDia(ambienteResp.data.cronMovimentoMeioDia);
      setCronManhaSeguinte(ambienteResp.data.cronMovimentoManhaSeguinte);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // Atualiza "proxima execucao" a cada minuto sem precisar re-salvar.
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, []);

  const meioDiaAlterado = status?.meioDia ? cronMeioDia !== status.meioDia.cron : false;
  const manhaAlterado = status?.manhaSeguinte
    ? cronManhaSeguinte !== status.manhaSeguinte.cron
    : false;
  const temAlteracao = meioDiaAlterado || manhaAlterado;

  async function handleSalvar() {
    setSalvando(true);
    try {
      await fiscalApi.put('/ambiente/crons', {
        cronMovimentoMeioDia: cronMeioDia,
        cronMovimentoManhaSeguinte: cronManhaSeguinte,
      });
      await fiscalApi.post('/cruzamento/scheduler/recarregar');
      toast.success('Horários atualizados', 'O scheduler foi recarregado com os novos crons.');
      await load();
    } catch (err) {
      toast.error('Falha ao salvar horários', extractApiError(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
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
            cron={cronMeioDia}
            onCronChange={setCronMeioDia}
            proxima={status?.meioDia?.proxima ?? null}
            alterado={meioDiaAlterado}
            editavel={isAdmin}
          />
          <ScheduleCard
            title="Corrida da manhã seguinte"
            descricao="Movimento ontem 12:00 → 23:59 (ainda dentro das 24h de cancelamento)"
            cron={cronManhaSeguinte}
            onCronChange={setCronManhaSeguinte}
            proxima={status?.manhaSeguinte?.proxima ?? null}
            alterado={manhaAlterado}
            editavel={isAdmin}
          />
        </div>
      )}

      {isAdmin && !loading && (
        <div className="mt-6 flex items-center justify-between rounded-md border border-slate-200 bg-white p-4">
          <div className="flex items-start gap-2 text-xs text-slate-600">
            <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
            <span>
              Edite as expressões cron acima e clique em <strong>Salvar</strong>. A validação
              acontece no backend — se a expressão for inválida, a alteração é rejeitada. Após
              salvar, o scheduler recarrega automaticamente sem restart do fiscal-backend.
            </span>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSalvar}
            disabled={!temAlteracao}
            loading={salvando}
          >
            <Save className="mr-1 h-3 w-3" />
            Salvar alterações
          </Button>
        </div>
      )}
    </>
  );
}

function descreverCron(expr: string): string {
  const partes = expr.trim().split(/\s+/);
  if (partes.length !== 5) return expr;
  const [min, hora, diaMes, mes, dow] = partes;
  const todoDia = diaMes === '*' && mes === '*' && dow === '*';
  const minNum = /^\d+$/.test(min) ? parseInt(min, 10) : null;
  const horaNum = /^\d+$/.test(hora) ? parseInt(hora, 10) : null;

  if (todoDia && minNum !== null && horaNum !== null) {
    return `Todo dia às ${String(horaNum).padStart(2, '0')}:${String(minNum).padStart(2, '0')}`;
  }
  if (todoDia && hora === '*' && min.startsWith('*/')) {
    return `A cada ${min.slice(2)} minuto(s), todo dia`;
  }
  if (diaMes === '*' && mes === '*' && dow !== '*' && minNum !== null && horaNum !== null) {
    const dias: Record<string, string> = {
      '0': 'domingo',
      '1': 'segunda',
      '2': 'terça',
      '3': 'quarta',
      '4': 'quinta',
      '5': 'sexta',
      '6': 'sábado',
      '1-5': 'dias úteis (seg-sex)',
      '0,6': 'fins de semana',
    };
    const rotulo = dias[dow] ?? `dow=${dow}`;
    return `${rotulo} às ${String(horaNum).padStart(2, '0')}:${String(minNum).padStart(2, '0')}`;
  }
  return expr;
}

function cronValido(expr: string): boolean {
  const partes = expr.trim().split(/\s+/);
  return partes.length === 5 && partes.every((p) => p.length > 0);
}

function ScheduleCard({
  title,
  descricao,
  cron,
  onCronChange,
  proxima,
  alterado,
  editavel,
}: {
  title: string;
  descricao: string;
  cron: string;
  onCronChange: (v: string) => void;
  proxima: string | null;
  alterado: boolean;
  editavel: boolean;
}) {
  const valido = cronValido(cron);
  return (
    <div
      className={`rounded-lg border bg-white p-4 shadow-sm transition-colors ${
        alterado ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Calendar className="h-4 w-4 text-indigo-600" />
            {title}
            {alterado && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                Modificado
              </span>
            )}
          </h4>
          <p className="mt-0.5 text-xs text-slate-600">{descricao}</p>

          <div className="mt-3 flex items-center gap-2">
            <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              Cron
            </label>
            <input
              type="text"
              value={cron}
              onChange={(e) => onCronChange(e.target.value)}
              disabled={!editavel}
              placeholder="0 12 * * *"
              className={`w-44 rounded-md border px-2 py-1 font-mono text-xs focus:outline-none focus:ring-2 ${
                valido
                  ? 'border-slate-300 focus:border-slate-500 focus:ring-slate-500/30'
                  : 'border-red-300 focus:border-red-500 focus:ring-red-500/30'
              } disabled:bg-slate-50 disabled:text-slate-500`}
            />
            <span className="text-xs text-slate-500">
              {valido ? descreverCron(cron) : (
                <span className="inline-flex items-center gap-1 text-red-600">
                  <AlertCircle className="h-3 w-3" />
                  5 campos separados por espaço
                </span>
              )}
            </span>
          </div>
        </div>

        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Próxima</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-slate-700">
            <Clock className="h-3 w-3" />
            {proxima
              ? new Date(proxima).toLocaleString('pt-BR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })
              : alterado
                ? 'Será calculada ao salvar'
                : 'Sem próxima execução'}
          </p>
        </div>
      </div>
    </div>
  );
}
