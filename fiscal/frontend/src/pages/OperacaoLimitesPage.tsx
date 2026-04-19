import { useEffect, useState } from 'react';
import { Info, ShieldAlert } from 'lucide-react';
import { fiscalApi } from '../services/api';
import { PageWrapper } from '../components/PageWrapper';
import { Button } from '../components/Button';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { useAuth } from '../contexts/AuthContext';
import { extractApiError } from '../utils/errors';

interface LimiteDiarioStatus {
  contadorHoje: number;
  limiteDiario: number;
  alertaAmarelo: number;
  alertaVermelho: number;
  dataContador: string;
  pausadoAutomatico: boolean;
  pausadoEm: string | null;
  percentualConsumido: number;
}

export function OperacaoLimitesPage() {
  const [status, setStatus] = useState<LimiteDiarioStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ limiteDiario: 0, alertaAmarelo: 0, alertaVermelho: 0 });
  const toast = useToast();
  const confirm = useConfirm();
  const { fiscalRole } = useAuth();
  const isAdmin = fiscalRole === 'ADMIN_TI';

  async function load() {
    try {
      setLoading(true);
      const { data } = await fiscalApi.get<LimiteDiarioStatus>('/operacao/limites');
      setStatus(data);
      setForm({
        limiteDiario: data.limiteDiario,
        alertaAmarelo: data.alertaAmarelo,
        alertaVermelho: data.alertaVermelho,
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 30_000); // refresh a cada 30s
    return () => clearInterval(timer);
  }, []);

  async function handleSalvar() {
    setActing(true);
    try {
      await fiscalApi.put('/operacao/limites', form);
      toast.success('Limites atualizados', 'Novos valores já valem para as próximas consultas.');
      setEditMode(false);
      load();
    } catch (err) {
      toast.error('Falha ao atualizar limites', extractApiError(err));
    } finally {
      setActing(false);
    }
  }

  async function handleLiberar() {
    const ok = await confirm({
      title: 'Liberar corte automático?',
      description:
        'O limite diário continuará contando, mas as consultas voltarão a passar. Use apenas em caso de urgência — o motivo do corte foi justamente evitar bloqueio do CNPJ pela SEFAZ.',
      variant: 'warning',
      confirmLabel: 'Liberar',
    });
    if (!ok) return;
    setActing(true);
    try {
      await fiscalApi.post('/operacao/limites/liberar');
      toast.warning('Corte liberado manualmente', 'Monitore o consumo pelo resto do dia.');
      load();
    } catch (err) {
      toast.error('Falha ao liberar', extractApiError(err));
    } finally {
      setActing(false);
    }
  }

  async function handleReset() {
    const ok = await confirm({
      title: 'Resetar contador agora?',
      description: 'Zera o contador de consultas do dia. Apenas para testes ou reset manual.',
      variant: 'warning',
      confirmLabel: 'Resetar',
    });
    if (!ok) return;
    setActing(true);
    try {
      await fiscalApi.post('/operacao/limites/reset');
      toast.success('Contador resetado.');
      load();
    } catch (err) {
      toast.error('Falha ao resetar', extractApiError(err));
    } finally {
      setActing(false);
    }
  }

  const cor = status
    ? status.pausadoAutomatico
      ? 'red'
      : status.contadorHoje >= status.alertaVermelho
        ? 'red'
        : status.contadorHoje >= status.alertaAmarelo
          ? 'amber'
          : 'emerald'
    : 'slate';

  return (
    <PageWrapper title="Limites e Política de Consultas SEFAZ">
      {/* Widget de consumo em tempo real */}
      {loading ? (
        <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-5 text-slate-500">
          Carregando status…
        </div>
      ) : status ? (
        <div
          className={`mb-6 rounded-lg border p-5 ${
            cor === 'red'
              ? 'border-red-300 bg-red-50'
              : cor === 'amber'
                ? 'border-amber-300 bg-amber-50'
                : 'border-emerald-300 bg-emerald-50'
          }`}
        >
          <div className="mb-2 flex items-center justify-between">
            <h3
              className={`text-sm font-semibold ${
                cor === 'red' ? 'text-red-900' : cor === 'amber' ? 'text-amber-900' : 'text-emerald-900'
              }`}
            >
              Consumo de hoje
              {status.pausadoAutomatico && (
                <span className="ml-2 inline-flex items-center gap-1 rounded bg-red-600 px-2 py-0.5 text-xs font-medium text-white">
                  <ShieldAlert className="h-3 w-3" /> Corte automático ativo
                </span>
              )}
            </h3>
            <span
              className={`font-mono text-sm ${
                cor === 'red' ? 'text-red-900' : cor === 'amber' ? 'text-amber-900' : 'text-emerald-900'
              }`}
            >
              {status.contadorHoje} / {status.limiteDiario} (
              {(status.percentualConsumido * 100).toFixed(1)}%)
            </span>
          </div>
          <div className="mt-2 h-3 w-full rounded-full bg-white/60 shadow-inner">
            <div
              className={`h-3 rounded-full transition-all ${
                cor === 'red' ? 'bg-red-500' : cor === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, status.percentualConsumido * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-700">
            Contador zera todos os dias à meia-noite (fuso America/Sao_Paulo).
          </p>

          {isAdmin && (
            <div className="mt-3 flex flex-wrap gap-2">
              {status.pausadoAutomatico && (
                <Button variant="danger" size="sm" onClick={handleLiberar} loading={acting}>
                  Liberar corte manualmente
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setEditMode((v) => !v)}
                disabled={acting}
              >
                {editMode ? 'Cancelar edição' : 'Editar limites'}
              </Button>
              <Button variant="secondary" size="sm" onClick={handleReset} disabled={acting}>
                Resetar contador
              </Button>
            </div>
          )}
        </div>
      ) : null}

      {/* Editor de limites (apenas ADMIN_TI) */}
      {editMode && isAdmin && status && (
        <div className="mb-6 rounded-lg border border-indigo-200 bg-indigo-50 p-5">
          <h3 className="mb-3 text-sm font-semibold text-indigo-900">Editar valores</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <LimitInput
              label="Limite diário"
              value={form.limiteDiario}
              onChange={(v) => setForm((f) => ({ ...f, limiteDiario: v }))}
            />
            <LimitInput
              label="Alerta amarelo (80%)"
              value={form.alertaAmarelo}
              onChange={(v) => setForm((f) => ({ ...f, alertaAmarelo: v }))}
            />
            <LimitInput
              label="Alerta vermelho (90%)"
              value={form.alertaVermelho}
              onChange={(v) => setForm((f) => ({ ...f, alertaVermelho: v }))}
            />
          </div>
          <p className="mt-2 text-xs text-indigo-800">
            Regra: amarelo &lt; vermelho &lt; limite diário.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={handleSalvar} loading={acting}>
              Salvar
            </Button>
          </div>
        </div>
      )}

      {/* Texto da política — Plano v2.0 §6.3 */}
      <article className="prose prose-slate max-w-none rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="!mb-2 !mt-0 text-lg font-semibold text-slate-900">
          Por que existe este limite?
        </h2>
        <p className="text-sm text-slate-700">
          A Plataforma Fiscal consulta os web services das SEFAZ estaduais para validar cadastros
          de clientes, fornecedores e notas fiscais. Embora o <strong>SEFAZ não publique um limite
          oficial</strong> de consultas por dia, há consenso no mercado de que consumo acima de
          <strong> ~3.000 consultas diárias por CNPJ</strong> começa a atrair monitoramento
          automático, podendo levar a <em>throttling</em> (redução de velocidade) ou ao{' '}
          <strong>bloqueio temporário</strong> do CNPJ da Capul.
        </p>
        <p className="text-sm text-slate-700">
          Um bloqueio tem consequência grave: o mesmo certificado digital usado para
          <strong> consultar</strong> também é usado para <strong>emitir e autorizar NF-e</strong>.
          Se o SEFAZ bloqueia o CNPJ da Capul por consulta abusiva,
          <strong> a emissão de notas fiscais também trava</strong> — o faturamento para até o
          bloqueio ser removido.
        </p>

        <h3 className="!mt-5 !mb-1 text-sm font-semibold text-slate-900">
          Duas barreiras de volume
        </h3>
        <ul className="list-disc pl-5 text-sm text-slate-700">
          <li>
            <strong>Limite diário global: 2.000 consultas/dia</strong> — valor conservador, cerca
            de 2× o volume operacional esperado. Cobre cruzamento cadastral (12:00/06:00),
            consulta NF-e/CT-e por chave e consulta cadastral pontual.
          </li>
          <li>
            <strong>Limite por minuto: 20 consultas/min</strong> — protege contra rajadas (picos
            instantâneos), padrão mais agressivamente detectado pelo monitor SEFAZ. As duas
            barreiras atuam em conjunto: uma protege o volume total, a outra protege o ritmo.
          </li>
        </ul>

        <h3 className="!mt-5 !mb-1 text-sm font-semibold text-slate-900">
          O que NÃO entra neste limite
        </h3>
        <ul className="list-disc pl-5 text-sm text-slate-700">
          <li>
            <strong>NF-e</strong> (modelo 55) — emissão e autorização (serviço <code>nfeAutorizacao4</code>)
          </li>
          <li>
            <strong>NFC-e</strong> (modelo 65) — emissão e autorização (mesmo serviço)
          </li>
          <li>
            <strong>NFS-e</strong> (Nota Fiscal de Serviço) — é municipal, não usa SEFAZ estadual
          </li>
          <li>
            <strong>Cancelamento</strong> de NF-e/NFC-e e <strong>Carta de Correção</strong>{' '}
            (serviço <code>nfeRecepcaoEvento</code>)
          </li>
          <li>
            <strong>Inutilização</strong> de numeração (serviço <code>nfeInutilizacao4</code>)
          </li>
          <li>Qualquer operação do Protheus relacionada à emissão</li>
        </ul>
        <p className="text-sm text-slate-600">
          Somente <strong>consultas</strong> (distribuição de XML, consulta de protocolo, consulta
          cadastral) contam para estes limites.
        </p>

        <h3 className="!mt-5 !mb-1 text-sm font-semibold text-slate-900">Como funciona</h3>
        <ul className="list-disc pl-5 text-sm text-slate-700">
          <li>A cada consulta SEFAZ bem-sucedida, o contador do dia aumenta em 1.</li>
          <li>
            O limite por minuto é aplicado automaticamente — operações que precisam de muitas
            consultas (ex: cruzamento) são naturalmente distribuídas ao longo do tempo.
          </li>
          <li>
            <strong>80% ({status?.alertaAmarelo ?? 1600})</strong> — e-mail de atenção para o
            Gestor Fiscal.
          </li>
          <li>
            <strong>90% ({status?.alertaVermelho ?? 1800})</strong> — e-mail crítico para Gestor
            Fiscal + Admin T.I.
          </li>
          <li>
            <strong>100% ({status?.limiteDiario ?? 2000})</strong> — a plataforma{' '}
            <strong>pausa automaticamente</strong> todas as consultas SEFAZ até 00:00 do dia
            seguinte. Admin T.I. pode liberar manualmente em caso de urgência.
          </li>
          <li>
            Consultas em excesso recebem erro{' '}
            <em>"Limite diário atingido. Nova tentativa após 00:00"</em>.
          </li>
          <li>
            <strong>O contador zera à meia-noite todos os dias.</strong>
          </li>
        </ul>

        <h3 className="!mt-5 !mb-1 text-sm font-semibold text-slate-900">
          Por que não consultar sem limite?
        </h3>
        <p className="text-sm text-slate-700">
          O Setor Fiscal não tem como saber em tempo real se o SEFAZ está monitorando a Capul. O
          bloqueio é silencioso — quando acontece, já está afetando a emissão.{' '}
          <strong>
            O custo de um dia parado no faturamento é muito maior do que o benefício de consultar
            10% a mais por dia.
          </strong>{' '}
          Estes limites protegem o faturamento.
        </p>

        <h3 className="!mt-5 !mb-1 text-sm font-semibold text-slate-900">
          Como estes valores podem evoluir
        </h3>
        <p className="text-sm text-slate-700">
          Após 30 dias de operação real, o time de T.I. analisa os dados de consumo registrados na
          plataforma e, se necessário, propõe ao Gestor Fiscal ajuste dos dois limites. Os valores
          iniciais são <strong>intencionalmente conservadores</strong>.
        </p>
      </article>

      <div className="mt-4 flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <div>
          Texto oficial da Política de Consultas SEFAZ da Plataforma Capul — Plano v2.0 §6.3.
          Alterações deste texto ou dos limites exigem alinhamento com o Setor Fiscal.
        </div>
      </div>
    </PageWrapper>
  );
}

function LimitInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block text-xs text-indigo-900">
      <span className="mb-1 block font-medium">{label}</span>
      <input
        type="number"
        min="0"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded border border-indigo-300 bg-white px-2 py-1.5 text-sm font-mono text-slate-900 focus:border-indigo-500 focus:outline-none"
      />
    </label>
  );
}

