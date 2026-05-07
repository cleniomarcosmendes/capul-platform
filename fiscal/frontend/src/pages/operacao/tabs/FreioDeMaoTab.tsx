import { useEffect, useState } from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { fiscalApi } from '../../../services/api';
import { Badge } from '../../../components/Badge';
import { Button } from '../../../components/Button';
import { useToast } from '../../../components/Toast';
import { useConfirm } from '../../../components/ConfirmDialog';
import { useAuth } from '../../../contexts/AuthContext';
import { extractApiError } from '../../../utils/errors';

interface AmbienteStatus {
  pauseSync: boolean;
  ultimaAlteracaoEm: string;
  ultimaAlteracaoPor: string | null;
}

/**
 * Aba "Freio Cruzamento NF-e × CCC" de /operacao/controle — pausa as rotinas
 * automaticas do cruzamento cadastral CCC (cron 12:00, cron 06:00, batches
 * manuais em /execucoes). Consultas individuais sob demanda (NF-e por chave,
 * CCC pontual) continuam funcionando normalmente.
 *
 * Escopo (06/05/2026): este freio NAO afeta o CT-e Distribuicao — esse
 * processo tem toggle proprio na aba "CT-e Distribuicao". Cada scheduler
 * tem controle isolado pra setor fiscal poder operar com granularidade
 * (ex: pausar Cruzamento durante incidente CCC sem perder coleta CT-e).
 */
export function FreioDeMaoTab() {
  const [status, setStatus] = useState<AmbienteStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();
  const { fiscalRole } = useAuth();
  const isAdmin = fiscalRole === 'ADMIN_TI';

  async function load() {
    try {
      setLoading(true);
      const { data } = await fiscalApi.get<AmbienteStatus>('/ambiente');
      setStatus(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handlePauseSync() {
    const ok = await confirm({
      title: 'Ativar freio do Cruzamento NF-e × CCC?',
      description:
        'Os cruzamentos cadastrais CCC (cron 12:00, cron 06:00 e batches manuais) serão pausados imediatamente. Use em caso de rate-limit SEFAZ ou incidente. CT-e Distribuição e consultas individuais continuam funcionando.',
      variant: 'warning',
      confirmLabel: 'Pausar Cruzamento NF-e × CCC',
    });
    if (!ok) return;
    setActing(true);
    try {
      await fiscalApi.post('/ambiente/pause-sync');
      toast.warning('Cruzamento NF-e × CCC pausado', 'Rotinas de cruzamento cadastral suspensas.');
      load();
    } catch (err) {
      toast.error('Falha ao pausar', extractApiError(err));
    } finally {
      setActing(false);
    }
  }

  async function handleResumeSync() {
    setActing(true);
    try {
      await fiscalApi.post('/ambiente/resume-sync');
      toast.success('Cruzamento NF-e × CCC retomado.');
      load();
    } catch (err) {
      toast.error('Falha ao retomar', extractApiError(err));
    } finally {
      setActing(false);
    }
  }

  if (loading) return <div className="text-slate-500">Carregando…</div>;
  if (!status) return <div className="text-red-600">Falha ao carregar estado do freio.</div>;

  const pausado = status.pauseSync;

  return (
    <>
      <div
        className={`mb-6 rounded-lg border p-5 ${
          pausado ? 'border-red-300 bg-red-50' : 'border-emerald-200 bg-emerald-50'
        }`}
      >
        <div className="flex items-start gap-4">
          <div
            className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${
              pausado ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            {pausado ? <ShieldAlert className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
          </div>
          <div className="flex-1">
            <h3 className={`text-sm font-semibold ${pausado ? 'text-red-900' : 'text-emerald-900'}`}>
              {pausado ? 'Cruzamento NF-e × CCC PAUSADO' : 'Cruzamento NF-e × CCC ATIVO'}
            </h3>
            <p className={`mt-1 text-xs ${pausado ? 'text-red-800' : 'text-emerald-800'}`}>
              {pausado
                ? 'Os cruzamentos cadastrais (cron + batch) estão pausados. CT-e Distribuição e consultas pontuais seguem funcionando.'
                : 'Schedulers 12:00 / 06:00 rodam normalmente. Cruzamentos manuais (botões em /execucoes) também.'}
            </p>
            <div className="mt-3 flex items-center gap-3">
              <Badge variant={pausado ? 'red' : 'green'}>{pausado ? 'PAUSADO' : 'ATIVO'}</Badge>
              {isAdmin && (
                <>
                  {pausado ? (
                    <Button variant="secondary" size="sm" onClick={handleResumeSync} loading={acting}>
                      Retomar Cruzamento
                    </Button>
                  ) : (
                    <Button variant="danger" size="sm" onClick={handlePauseSync} loading={acting}>
                      Pausar Cruzamento
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
        <h4 className="mb-2 text-xs font-semibold text-slate-700">O que este freio pausa</h4>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            Cron de cruzamento cadastral NF-e × CCC <strong>MOVIMENTO_MEIO_DIA</strong> (12:00 BRT)
          </li>
          <li>
            Cron de cruzamento cadastral NF-e × CCC <strong>MOVIMENTO_MANHA_SEGUINTE</strong> (06:00 BRT D+1)
          </li>
          <li>
            Disparos manuais em batch (<code>/execucoes</code> — botões "Manual", "Corrida meio-dia",
            "Corrida manhã seguinte")
          </li>
        </ul>

        <h4 className="mb-2 mt-4 text-xs font-semibold text-slate-700">O que NÃO é afetado</h4>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            <strong>CT-e Distribuição</strong> — controle próprio na aba "CT-e Distribuição"
          </li>
          <li>Consulta NF-e por chave (<code>/nfe</code>)</li>
          <li>Consulta CT-e por chave (<code>/cte</code>)</li>
          <li>Consulta cadastral pontual (<code>/cadastro</code>)</li>
          <li>Telas de leitura (Dashboard, Divergências, Histórico de Alertas)</li>
        </ul>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 text-xs text-slate-500">
        Última alteração:{' '}
        {status.ultimaAlteracaoEm ? new Date(status.ultimaAlteracaoEm).toLocaleString('pt-BR') : '-'}
        {status.ultimaAlteracaoPor && ` por ${status.ultimaAlteracaoPor}`}
      </div>
    </>
  );
}
