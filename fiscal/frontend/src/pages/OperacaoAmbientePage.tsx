import { useEffect, useState } from 'react';
import { fiscalApi } from '../services/api';
import { PageWrapper } from '../components/PageWrapper';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { useAuth } from '../contexts/AuthContext';
import { extractApiError } from '../utils/errors';

interface AmbienteStatus {
  ambienteAtivo: 'PRODUCAO' | 'HOMOLOGACAO';
  bootstrapConcluido: boolean;
  pauseSync: boolean;
  cronMovimentoMeioDia: string;
  cronMovimentoManhaSeguinte: string;
  ultimaAlteracaoEm: string;
  ultimaAlteracaoPor: string | null;
}

export function OperacaoAmbientePage() {
  const [status, setStatus] = useState<AmbienteStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();
  const { fiscalRole } = useAuth();
  const isGestor = fiscalRole === 'GESTOR_FISCAL' || fiscalRole === 'ADMIN_TI';
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

  async function handleToggleAmbiente() {
    if (!status) return;
    const novo = status.ambienteAtivo === 'PRODUCAO' ? 'HOMOLOGACAO' : 'PRODUCAO';
    const ok = await confirm({
      title: `Trocar ambiente para ${novo}?`,
      description:
        novo === 'PRODUCAO'
          ? 'As consultas SEFAZ passarão a usar o ambiente de PRODUÇÃO. Certifique-se de que o certificado A1 é válido para PROD.'
          : 'As consultas SEFAZ passarão a usar HOMOLOGAÇÃO — útil para testes.',
      variant: 'warning',
      confirmLabel: `Trocar para ${novo}`,
    });
    if (!ok) return;
    setActing(true);
    try {
      await fiscalApi.put('/ambiente', { ambienteAtivo: novo });
      toast.success(`Ambiente alterado para ${novo}`);
      load();
    } catch (err) {
      toast.error('Falha ao trocar ambiente', extractApiError(err));
    } finally {
      setActing(false);
    }
  }

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

  if (loading) {
    return (
      <PageWrapper title="Ambiente e Freio de Mão">
        <div className="text-slate-500">Carregando…</div>
      </PageWrapper>
    );
  }

  if (!status) {
    return (
      <PageWrapper title="Ambiente e Freio de Mão">
        <div className="text-red-600">Falha ao carregar ambiente.</div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="Ambiente e Freio de Mão">
      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Ambiente SEFAZ ativo</h3>
            <div className="mt-2">
              <Badge variant={status.ambienteAtivo === 'PRODUCAO' ? 'green' : 'yellow'}>
                {status.ambienteAtivo}
              </Badge>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Todas as consultas SEFAZ (CCC, NFeDistribuicaoDFe, consultas de protocolo) usam este
              ambiente.
            </p>
          </div>
          {isGestor && (
            <Button variant="secondary" size="sm" onClick={handleToggleAmbiente} loading={acting}>
              Trocar para {status.ambienteAtivo === 'PRODUCAO' ? 'HOMOLOGACAO' : 'PRODUCAO'}
            </Button>
          )}
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-5">
        <h3 className="text-sm font-semibold text-red-900">Freio de mão global</h3>
        <p className="mt-1 text-xs text-red-800">
          Pausa todas as rotinas automáticas (cruzamento CCC, scheduler 12:00 / 06:00). Use em
          caso de suspeita de bloqueio SEFAZ ou para liberar largura de banda durante picos de
          emissão. Consultas manuais individuais continuam funcionando.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <Badge variant={status.pauseSync ? 'red' : 'green'}>
            {status.pauseSync ? 'PAUSADO' : 'ATIVO'}
          </Badge>
          {isAdmin && (
            <>
              {status.pauseSync ? (
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

      <div className="rounded-lg border border-slate-200 bg-white p-4 text-xs text-slate-500">
        Última alteração:{' '}
        {status.ultimaAlteracaoEm ? new Date(status.ultimaAlteracaoEm).toLocaleString('pt-BR') : '-'}
        {status.ultimaAlteracaoPor && ` por ${status.ultimaAlteracaoPor}`}
      </div>
    </PageWrapper>
  );
}
