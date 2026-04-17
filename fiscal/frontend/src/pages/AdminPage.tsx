import { useEffect, useState } from 'react';
import { fiscalApi } from '../services/api';
import { PageWrapper } from '../components/PageWrapper';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { SefazCaAdminSection } from '../components/SefazCaAdminSection';
import { extractApiError } from '../utils/errors';

interface UfCircuit {
  uf: string;
  estado: 'FECHADO' | 'MEIO_ABERTO' | 'ABERTO';
  errosRecentes: number;
  abertoEm: string | null;
  retomadaEm: string | null;
  motivoBloqueio: string | null;
  ultimaAtualizacao: string;
}

export function AdminPage() {
  const [circuits, setCircuits] = useState<UfCircuit[]>([]);
  const [loading, setLoading] = useState(true);
  const [pausing, setPausing] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  async function load() {
    try {
      setLoading(true);
      const { data } = await fiscalApi.get<UfCircuit[]>('/cruzamento/circuit-breaker');
      setCircuits(data);
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
        'Todas as rotinas automáticas (cruzamento CCC, sincronização diária, scheduler) serão pausadas imediatamente. Use em caso de rate-limit da SEFAZ ou incidente.',
      variant: 'warning',
      confirmLabel: 'Pausar rotinas',
    });
    if (!ok) return;
    setPausing(true);
    try {
      await fiscalApi.post('/ambiente/pause-sync');
      toast.warning(
        'Freio de mão ativado',
        'Todas as rotinas automáticas foram pausadas. Use "Retomar" quando o incidente for resolvido.',
      );
    } catch (err) {
      toast.error('Falha ao pausar rotinas', extractApiError(err));
    } finally {
      setPausing(false);
    }
  }

  async function handleResumeSync() {
    setPausing(true);
    try {
      await fiscalApi.post('/ambiente/resume-sync');
      toast.success('Rotinas automáticas retomadas', 'Cruzamento e sincronização voltaram ao normal.');
    } catch (err) {
      toast.error('Falha ao retomar rotinas', extractApiError(err));
    } finally {
      setPausing(false);
    }
  }

  return (
    <PageWrapper title="Administração">

      <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-5">
        <h3 className="text-sm font-semibold text-red-900">Freio de mão global</h3>
        <p className="mt-1 text-xs text-red-800">
          Pausa imediatamente todas as rotinas automáticas (cruzamento CCC, sincronização
          diária, etc.). Use em caso de suspeita de que a CAPUL foi bloqueada por rate limit
          no SEFAZ ou para liberar largura de banda durante picos de emissão.
        </p>
        <div className="mt-3 flex gap-2">
          <Button variant="danger" size="sm" onClick={handlePauseSync} loading={pausing}>
            Pausar sincronização
          </Button>
          <Button variant="secondary" size="sm" onClick={handleResumeSync} loading={pausing}>
            Retomar sincronização
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <SefazCaAdminSection />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Circuit breaker por UF</h3>
          <p className="text-xs text-slate-500">
            Estado atual dos disjuntores de cada SEFAZ estadual. UFs com 3+ erros consecutivos
            ficam bloqueadas por 30 minutos automaticamente.
          </p>
        </div>
        {loading ? (
          <div className="p-5 text-slate-500">Carregando…</div>
        ) : circuits.length === 0 ? (
          <div className="p-5 text-sm text-slate-500">
            Nenhum estado registrado ainda — nenhuma UF apresentou falhas.
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-5 py-2">UF</th>
                <th className="px-5 py-2">Estado</th>
                <th className="px-5 py-2">Erros</th>
                <th className="px-5 py-2">Retoma em</th>
                <th className="px-5 py-2">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {circuits.map((c) => (
                <tr key={c.uf} className="border-b border-slate-100">
                  <td className="px-5 py-2 font-mono font-semibold">{c.uf}</td>
                  <td className="px-5 py-2">
                    <Badge
                      variant={
                        c.estado === 'FECHADO' ? 'green' : c.estado === 'MEIO_ABERTO' ? 'yellow' : 'red'
                      }
                    >
                      {c.estado}
                    </Badge>
                  </td>
                  <td className="px-5 py-2">{c.errosRecentes}</td>
                  <td className="px-5 py-2 text-xs text-slate-600">
                    {c.retomadaEm ? new Date(c.retomadaEm).toLocaleString('pt-BR') : '-'}
                  </td>
                  <td className="px-5 py-2 text-xs text-slate-600">{c.motivoBloqueio ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PageWrapper>
  );
}
