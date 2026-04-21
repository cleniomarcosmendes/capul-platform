import { useEffect, useState } from 'react';
import { fiscalApi } from '../../../services/api';
import { Badge } from '../../../components/Badge';
import { Button } from '../../../components/Button';
import { useToast } from '../../../components/Toast';
import { useConfirm } from '../../../components/ConfirmDialog';
import { useAuth } from '../../../contexts/AuthContext';
import { extractApiError } from '../../../utils/errors';

interface AmbienteStatus {
  ambienteAtivo: 'PRODUCAO' | 'HOMOLOGACAO';
  bootstrapConcluido: boolean;
  ultimaAlteracaoEm: string;
  ultimaAlteracaoPor: string | null;
}

/**
 * Aba "Ambiente" de /operacao/controle — foca apenas na troca do ambiente
 * SEFAZ ativo (PRODUCAO vs HOMOLOGACAO). O freio de mão, que antes estava
 * nesta mesma pagina, foi movido para sua propria aba.
 */
export function AmbienteTab() {
  const [status, setStatus] = useState<AmbienteStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();
  const { fiscalRole } = useAuth();
  const isGestor = fiscalRole === 'GESTOR_FISCAL' || fiscalRole === 'ADMIN_TI';

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
      await fiscalApi.put('/ambiente', { ambiente: novo });
      toast.success(`Ambiente alterado para ${novo}`);
      load();
    } catch (err) {
      toast.error('Falha ao trocar ambiente', extractApiError(err));
    } finally {
      setActing(false);
    }
  }

  if (loading) return <div className="text-slate-500">Carregando…</div>;
  if (!status) return <div className="text-red-600">Falha ao carregar ambiente.</div>;

  return (
    <>
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

      <div className="rounded-lg border border-slate-200 bg-white p-4 text-xs text-slate-500">
        Última alteração:{' '}
        {status.ultimaAlteracaoEm ? new Date(status.ultimaAlteracaoEm).toLocaleString('pt-BR') : '-'}
        {status.ultimaAlteracaoPor && ` por ${status.ultimaAlteracaoPor}`}
      </div>
    </>
  );
}
