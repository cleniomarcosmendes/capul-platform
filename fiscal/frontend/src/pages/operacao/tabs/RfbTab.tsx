import { useEffect, useRef, useState, useCallback } from 'react';
import { Info, RefreshCw, DownloadCloud, Clock, Save } from 'lucide-react';
import { fiscalApi } from '../../../services/api';
import { Button } from '../../../components/Button';
import { useToast } from '../../../components/Toast';
import { useConfirm } from '../../../components/ConfirmDialog';
import { useAuth } from '../../../contexts/AuthContext';
import { extractApiError } from '../../../utils/errors';

interface ControleRow {
  id: number;
  versaoRfb: string;
  status: string; // DISPONIVEL | IMPORTANDO | CONCLUIDO | ERRO
  dataDeteccao: string | null;
  dataInicio: string | null;
  dataFim: string | null;
  totalRegistros: number | null;
  disparadoPor: string | null;
  observacao: string | null;
}
interface VersoesResp {
  versoes: string[];
  maisRecente: string;
  importada: boolean;
  novaDisponivel: boolean;
  ultimas: ControleRow[];
  cronDeteccao: string | null; // null = detecção automática desativada
}

const fmt = (s: string | null) => (s ? new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—');
const STATUS_CLS: Record<string, string> = {
  DISPONIVEL: 'bg-amber-100 text-amber-800',
  IMPORTANDO: 'bg-blue-100 text-blue-800',
  CONCLUIDO: 'bg-green-100 text-green-800',
  ERRO: 'bg-red-100 text-red-800',
};

/**
 * Aba "Base CNPJ (RFB)" — visibilidade supervisionada do módulo de base
 * pública (regra: nada de cron/integração caixa-preta). Estado das versões,
 * histórico, gatilhos manuais e a agenda de detecção CONFIGURÁVEL pelo
 * admin. IMPORT é SEMPRE manual (ADMIN_TI).
 */
export function RfbTab() {
  const [data, setData] = useState<VersoesResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [cronInput, setCronInput] = useState('');
  const toast = useToast();
  const confirm = useConfirm();
  const { fiscalRole } = useAuth();
  const isAdmin = fiscalRole === 'ADMIN_TI';
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const carregar = useCallback(async () => {
    try {
      const { data } = await fiscalApi.get<VersoesResp>('/rfb/versoes');
      setData(data);
      setCronInput(data.cronDeteccao ?? '');
      return data;
    } catch (e) {
      toast.error(extractApiError(e));
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    carregar();
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [carregar]);

  // Poll enquanto houver import em andamento.
  useEffect(() => {
    const importando = data?.ultimas?.some((u) => u.status === 'IMPORTANDO');
    if (importando && !timer.current) {
      timer.current = setInterval(carregar, 5000);
    } else if (!importando && timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, [data, carregar]);

  async function acao(fn: () => Promise<unknown>, okMsg: string) {
    setActing(true);
    try {
      await fn();
      toast.success(okMsg);
      await carregar();
    } catch (e) {
      toast.error(extractApiError(e));
    } finally {
      setActing(false);
    }
  }

  const detectar = () => acao(() => fiscalApi.post('/rfb/detectar'), 'Detecção disparada');
  const importarTudo = async () => {
    const ok = await confirm({
      title: 'Importar base completa da RFB?',
      description:
        'Baixa e importa ~60M de registros (Estabelecimentos+Empresas+Simples+domínios). ' +
        'Pode levar horas e exige disco livre suficiente no Postgres. Roda em background; ' +
        'acompanhe o progresso aqui.',
      variant: 'warning',
      confirmLabel: 'Importar tudo',
    });
    if (ok) acao(() => fiscalApi.post('/rfb/importar'), 'Importação completa iniciada');
  };
  const salvarCron = () =>
    acao(
      () => fiscalApi.post('/rfb/cron', { cron: cronInput.trim() }),
      cronInput.trim() ? 'Agenda de detecção atualizada' : 'Detecção automática desativada',
    );

  if (loading) return <div className="text-sm text-slate-500">Carregando…</div>;

  return (
    <div className="space-y-5">
      {/* Didático — o que o módulo faz (regra: sem caixa-preta) */}
      <div className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <Info className="h-5 w-5 flex-shrink-0 text-capul-600" />
        <div className="space-y-1">
          <p className="font-medium text-slate-800">Base Pública CNPJ — Receita Federal (Dados Abertos)</p>
          <p>
            Importa a base pública de CNPJ da RFB para cruzar em massa com o cadastro
            (SA1 clientes + SA2 fornecedores) <strong>sem certificado digital e sem
            consultar a SEFAZ</strong> — zero risco de bloqueio.
          </p>
          <p>
            <strong>Detecção automática</strong> verifica se há versão mensal nova
            (agenda configurável abaixo). <strong>A importação é SEMPRE manual</strong>{' '}
            (ADMIN_TI) — o sistema nunca processa a base sozinho.
          </p>
        </div>
      </div>

      {/* Estado atual */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Versão mais recente (RFB)</div>
          <div className="mt-1 text-lg font-semibold text-slate-800">{data?.maisRecente ?? '—'}</div>
        </div>
        <div className="rounded-lg border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Já importada?</div>
          <div className="mt-1 text-lg font-semibold text-slate-800">{data?.importada ? 'Sim' : 'Não'}</div>
        </div>
        <div className="rounded-lg border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Nova disponível</div>
          <div className={`mt-1 text-lg font-semibold ${data?.novaDisponivel ? 'text-amber-600' : 'text-slate-800'}`}>
            {data?.novaDisponivel ? 'SIM — importar' : 'Não'}
          </div>
        </div>
      </div>

      {/* Agenda de detecção automática (configurável — sem caixa-preta) */}
      <div className="rounded-lg border border-slate-200 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Clock className="h-4 w-4 text-capul-600" /> Detecção automática
        </div>
        <p className="mb-2 text-xs text-slate-500">
          Estado:{' '}
          <strong className={data?.cronDeteccao ? 'text-slate-700' : 'text-amber-600'}>
            {data?.cronDeteccao ? `agendada (cron: ${data.cronDeteccao})` : 'DESATIVADA'}
          </strong>
          . Só detecta (não importa). Formato cron: <code>min hora dia mês diaSemana</code>{' '}
          — ex.: <code>0 7 * * 1</code> = seg 07:00; <code>0 6 1 * *</code> = dia 1 às 06:00.
          Vazio = desativar.
        </p>
        {isAdmin ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="w-56 rounded-md border border-slate-300 px-2 py-1.5 font-mono text-sm"
              placeholder="0 7 * * 1  (vazio = desativar)"
              value={cronInput}
              onChange={(e) => setCronInput(e.target.value)}
            />
            <Button size="sm" onClick={salvarCron} disabled={acting || cronInput === (data?.cronDeteccao ?? '')}>
              <Save className="mr-1 h-3.5 w-3.5" /> Salvar agenda
            </Button>
          </div>
        ) : (
          <p className="text-xs text-slate-400">Somente ADMIN_TI altera a agenda.</p>
        )}
      </div>

      {/* Ações (ADMIN_TI) */}
      {isAdmin && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={detectar} disabled={acting}>
            <RefreshCw className="mr-1.5 h-4 w-4" /> Detectar agora
          </Button>
          <Button onClick={importarTudo} disabled={acting}>
            <DownloadCloud className="mr-1.5 h-4 w-4" /> Importar base completa
          </Button>
        </div>
      )}
      {!isAdmin && (
        <p className="text-xs text-slate-500">Somente ADMIN_TI dispara detecção/importação.</p>
      )}

      {/* Histórico */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Histórico de importações</h3>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2">Versão</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Registros</th>
                <th className="px-3 py-2">Início</th>
                <th className="px-3 py-2">Fim</th>
                <th className="px-3 py-2">Observação</th>
              </tr>
            </thead>
            <tbody>
              {(data?.ultimas ?? []).map((u) => (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium">{u.versaoRfb}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_CLS[u.status] ?? 'bg-slate-100 text-slate-700'}`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{u.totalRegistros?.toLocaleString('pt-BR') ?? '—'}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{fmt(u.dataInicio)}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{fmt(u.dataFim)}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">{u.observacao ?? '—'}</td>
                </tr>
              ))}
              {(data?.ultimas ?? []).length === 0 && (
                <tr><td colSpan={6} className="px-3 py-4 text-center text-slate-400">Sem importações ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
