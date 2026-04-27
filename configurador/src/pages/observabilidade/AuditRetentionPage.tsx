import { useEffect, useState } from 'react';
import { auditRetentionService } from '../../services/audit-retention.service';
import type { RetentionStatus } from '../../services/audit-retention.service';
import { useConfirm } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';

function formatData(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR');
}

/**
 * Tela de configuração de retenção de logs de auditoria (core.system_logs).
 * Auditoria observabilidade 26/04/2026 #9 — funcionalidade visível no Configurador.
 */
export function AuditRetentionPage() {
  const confirm = useConfirm();
  const toast = useToast();

  const [status, setStatus] = useState<RetentionStatus | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<number>(365);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      const s = await auditRetentionService.getStatus();
      setStatus(s);
      setDraft(s.retentionDias);
    } catch {
      toast.error('Falha ao carregar status');
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const updated = await auditRetentionService.update(draft);
      setStatus(updated);
      setEditing(false);
      toast.success(`Retenção salva: ${updated.retentionDias} dias`);
    } catch {
      toast.error('Falha ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function runNow() {
    if (!status) return;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - status.retentionDias);
    const ok = await confirm({
      title: 'Disparar cleanup agora?',
      description:
        `Logs anteriores a ${cutoff.toLocaleDateString('pt-BR')} serão DELETADOS de ` +
        `core.system_logs. Esta ação não pode ser desfeita.`,
      variant: 'danger',
      confirmLabel: 'Disparar agora',
    });
    if (!ok) return;

    setRunning(true);
    try {
      const res = await auditRetentionService.runNow();
      toast.success(res.message);
      // Recarrega status após delay (cleanup roda em background)
      setTimeout(() => refresh(), 2000);
    } catch {
      toast.error('Falha ao disparar cleanup');
    } finally {
      setRunning(false);
    }
  }

  if (loading) return <div className="p-6">Carregando…</div>;
  if (!status) return <div className="p-6 text-red-600">Falha ao carregar.</div>;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - status.retentionDias);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Retenção de Logs de Auditoria</h1>
        <p className="text-sm text-slate-500 mt-1">
          Tabela <code className="bg-slate-100 px-1 rounded">core.system_logs</code> — usada pelo
          auth-gateway para registrar logins, mudanças de senha e ações administrativas.
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card label="Total de linhas" value={status.totalLinhas.toLocaleString('pt-BR')} />
        <Card label="Mais antigo" value={formatData(status.maisAntigo)} />
        <Card label="Mais recente" value={formatData(status.maisRecente)} />
        <Card label="Retenção atual" value={`${status.retentionDias} dias`} />
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Configuração</h2>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Editar
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => { setDraft(status.retentionDias); setEditing(false); }}
                className="px-3 py-1.5 text-sm bg-slate-200 rounded hover:bg-slate-300"
              >
                Cancelar
              </button>
              <button
                disabled={saving}
                onClick={save}
                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Dias de retenção
            </label>
            {editing ? (
              <input
                type="number"
                min={0}
                max={3650}
                value={draft}
                onChange={(e) => setDraft(Number(e.target.value))}
                className="border border-slate-300 rounded px-3 py-2 w-32"
              />
            ) : (
              <div className="text-lg">{status.retentionDias}</div>
            )}
            <p className="text-xs text-slate-500 mt-1">
              Cleanup mensal (dia 1 às 03:00) deleta linhas mais antigas que este valor.
              0 = desabilita cleanup. Recomendado: 365.
            </p>
          </div>

          <div className="text-sm bg-slate-50 border border-slate-200 rounded p-3">
            <div>
              <strong>Próximo corte:</strong> linhas anteriores a{' '}
              <code>{cutoff.toLocaleDateString('pt-BR')}</code> serão removidas.
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-2">Operações</h2>
        <p className="text-sm text-slate-600 mb-4">
          O cleanup roda automaticamente todo dia 1 do mês às 03:00. Use o botão abaixo apenas
          se precisar forçar a execução agora (ex: rodada de testes ou crescimento anormal).
        </p>
        <button
          disabled={running}
          onClick={runNow}
          className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
        >
          {running ? 'Executando…' : 'Disparar cleanup agora'}
        </button>
      </section>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}
