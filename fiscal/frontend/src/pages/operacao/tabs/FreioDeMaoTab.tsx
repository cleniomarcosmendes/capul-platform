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
 * Aba "Freio de Mão" de /operacao/controle — pausa TODAS as rotinas
 * automaticas do Fiscal (cron 12:00, cron 06:00, cruzamentos manuais batch).
 * Consultas individuais sob demanda (NF-e por chave, CCC pontual) continuam
 * funcionando normalmente.
 *
 * Antes estava embutido na pagina de Ambiente — separado para facilitar a
 * evolucao (futura adicao de historico de pauses/retomadas e motivo).
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
      title: 'Ativar freio de mão global?',
      description:
        'Todas as rotinas automáticas (cruzamento CCC, scheduler 12:00/06:00) serão pausadas imediatamente. Use em caso de rate-limit SEFAZ ou incidente.',
      variant: 'warning',
      confirmLabel: 'Pausar rotinas',
    });
    if (!ok) return;
    setActing(true);
    try {
      await fiscalApi.post('/ambiente/pause-sync');
      toast.warning('Freio de mão ativado', 'Rotinas automáticas pausadas.');
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
      toast.success('Rotinas retomadas.');
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
              {pausado ? 'Rotinas automáticas PAUSADAS' : 'Rotinas automáticas ATIVAS'}
            </h3>
            <p className={`mt-1 text-xs ${pausado ? 'text-red-800' : 'text-emerald-800'}`}>
              {pausado
                ? 'Nenhum cron ou cruzamento batch vai executar. Consultas individuais sob demanda continuam funcionando.'
                : 'Schedulers 12:00 / 06:00 rodarão normalmente. Cruzamentos manuais (botões em /execucoes) também.'}
            </p>
            <div className="mt-3 flex items-center gap-3">
              <Badge variant={pausado ? 'red' : 'green'}>{pausado ? 'PAUSADO' : 'ATIVO'}</Badge>
              {isAdmin && (
                <>
                  {pausado ? (
                    <Button variant="secondary" size="sm" onClick={handleResumeSync} loading={acting}>
                      Retomar sincronização
                    </Button>
                  ) : (
                    <Button variant="danger" size="sm" onClick={handlePauseSync} loading={acting}>
                      Pausar sincronização
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
        <h4 className="mb-2 text-xs font-semibold text-slate-700">O que o freio pausa</h4>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            Cron de cruzamento cadastral <strong>MOVIMENTO_MEIO_DIA</strong> (12:00 BRT)
          </li>
          <li>
            Cron de cruzamento cadastral <strong>MOVIMENTO_MANHA_SEGUINTE</strong> (06:00 BRT D+1)
          </li>
          <li>
            Disparos manuais em batch (<code>/execucoes</code> — botões "Manual", "Corrida meio-dia",
            "Corrida manhã seguinte")
          </li>
        </ul>

        <h4 className="mb-2 mt-4 text-xs font-semibold text-slate-700">O que continua funcionando</h4>
        <ul className="ml-4 list-disc space-y-1">
          <li>Consulta NF-e por chave (<code>/nfe</code>)</li>
          <li>Consulta CT-e por chave (<code>/cte</code>)</li>
          <li>Consulta cadastral pontual (<code>/cadastro</code>)</li>
          <li>Todas as telas de leitura (Dashboard, Divergências, Histórico de Alertas)</li>
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
