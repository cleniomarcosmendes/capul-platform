import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Info, RefreshCw, DownloadCloud, Clock, Save,
  Activity, CheckCircle2, Loader2, Circle, XCircle,
} from 'lucide-react';
import { fiscalApi } from '../../../services/api';
import { Button } from '../../../components/Button';
import { useToast } from '../../../components/Toast';
import { useConfirm } from '../../../components/ConfirmDialog';
import { useAuth } from '../../../contexts/AuthContext';
import { extractApiError } from '../../../utils/errors';

type ProgStatus = 'pendente' | 'rodando' | 'concluida' | 'erro';
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
  // F1.6 — progresso granular do import
  tabelaAtual: string | null;
  arquivoAtual: number | null;
  arquivosTotal: number | null;
  linhasAcumuladas: number | null;
  atualizadoEm: string | null;
  progresso: Record<string, { status: ProgStatus; linhas: number }> | null;
}
interface VersoesResp {
  versoes: string[];
  maisRecente: string;
  importada: boolean;
  novaDisponivel: boolean;
  ultimas: ControleRow[];
  cronDeteccao: string | null; // null = detecção automática desativada
}
interface CruzExec {
  emAndamento: boolean;
  ultima: {
    status: string; iniciado: string; fim: string | null; total: number | null;
    observacao: string | null;
    alertaIrregular: number | null; alertaAtencao: number | null;
    alertaOk: number | null; naoEncontrado: number | null;
  } | null;
  cooldownAte: string | null;
  podeRodar: boolean;
  limiarRazao: number;
}

const fmt = (s: string | null) => (s ? new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—');
const hora = (s: string | null) => (s ? new Date(s).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—');
const STATUS_CLS: Record<string, string> = {
  DISPONIVEL: 'bg-amber-100 text-amber-800',
  IMPORTANDO: 'bg-blue-100 text-blue-800',
  CONCLUIDO: 'bg-green-100 text-green-800',
  ERRO: 'bg-red-100 text-red-800',
};

// Ordem real de processamento no backend (RfbImportacaoService.ORDEM).
const TABELAS: Array<{ k: string; label: string }> = [
  { k: 'cnaes', label: 'CNAEs' },
  { k: 'municipios', label: 'Municípios' },
  { k: 'naturezas', label: 'Naturezas jurídicas' },
  { k: 'simples', label: 'Simples / MEI' },
  { k: 'empresas', label: 'Empresas' },
  { k: 'estabelecimentos', label: 'Estabelecimentos' },
];

function dur(ms: number): string {
  if (ms < 0 || !isFinite(ms)) return '—';
  const s = Math.floor(ms / 1000);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(hh)}:${p(mm)}:${p(ss)}`;
}
function statusDe(
  k: string, prog: ControleRow['progresso'], tabelaAtual: string | null,
): ProgStatus {
  const st = prog?.[k]?.status;
  if (st) return st;
  return k === tabelaAtual ? 'rodando' : 'pendente';
}

/**
 * Aba "Base CNPJ (RFB)" — visibilidade supervisionada do módulo de base
 * pública (regra: nada de cron/integração caixa-preta). Estado das versões,
 * histórico, gatilhos manuais, agenda de detecção CONFIGURÁVEL e — durante
 * um import (1-2h) — painel de progresso ao vivo (F1.6, escopo B). IMPORT
 * é SEMPRE manual (ADMIN_TI).
 */
export function RfbTab() {
  const [data, setData] = useState<VersoesResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [cronInput, setCronInput] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [taxa, setTaxa] = useState<number | null>(null); // linhas/s
  const amostra = useRef<{ ts: number; linhas: number } | null>(null);
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

  const latest = useMemo(
    () => data?.ultimas?.find((u) => u.status === 'IMPORTANDO') ?? data?.ultimas?.[0] ?? null,
    [data],
  );
  const importando = latest?.status === 'IMPORTANDO';

  // Poll enquanto houver import em andamento.
  useEffect(() => {
    if (importando && !timer.current) {
      timer.current = setInterval(carregar, 5000);
    } else if (!importando && timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, [importando, carregar]);

  // Relógio local 1s p/ "rodando há HH:MM:SS" (independe do poll de 5s).
  useEffect(() => {
    if (!importando) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [importando]);

  // Throughput: Δ linhas / Δ tempo entre dois polls. linhas_acumuladas
  // zera na troca de tabela → delta negativo é ignorado (não é regressão).
  useEffect(() => {
    if (!importando || latest?.linhasAcumuladas == null) {
      amostra.current = null;
      setTaxa(null);
      return;
    }
    const agora = Date.now();
    const linhas = latest.linhasAcumuladas;
    const ant = amostra.current;
    if (ant && agora > ant.ts) {
      const dl = linhas - ant.linhas;
      const dt = (agora - ant.ts) / 1000;
      if (dl > 0 && dt > 0) setTaxa(dl / dt);
    }
    amostra.current = { ts: agora, linhas };
  }, [data, importando, latest]);

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
        'acompanhe o progresso aqui (painel ao vivo).',
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

  // ── Cruzamento SA1+SA2 × RFB (lote pesado — movido p/ cá, fora da
  //    tela de consulta, pedido Clenio 18/05). Cooldown no backend (C1).
  const [cruz, setCruz] = useState<CruzExec | null>(null);
  const [limiarCruz, setLimiarCruz] = useState('');
  const carregarCruz = useCallback(async () => {
    try {
      const { data } = await fiscalApi.get<CruzExec>('/rfb/cruzamento/exec');
      setCruz(data);
      setLimiarCruz(String(data.limiarRazao));
    } catch (e) {
      toast.error(extractApiError(e));
    }
  }, [toast]);
  useEffect(() => { carregarCruz(); }, [carregarCruz]);
  useEffect(() => {
    if (!cruz?.emAndamento) return;
    const id = setInterval(carregarCruz, 8000);
    return () => clearInterval(id);
  }, [cruz?.emAndamento, carregarCruz]);

  const rodarCruz = async () => {
    const ok = await confirm({
      title: 'Rodar cruzamento SA1+SA2 × RFB?',
      description:
        'Lote PESADO (~2 min): coleta TODO o cadastro Protheus (clientes + '
        + 'fornecedores) e cruza com os ~71M da base RFB local, substituindo o '
        + 'snapshot. Cooldown de 30 min entre execuções. Sem certificado/SEFAZ.',
      variant: 'warning',
      confirmLabel: 'Rodar agora',
    });
    if (!ok) return;
    setActing(true);
    try {
      await fiscalApi.post('/rfb/cruzamento');
      toast.success('Cruzamento iniciado — acompanhe aqui');
    } catch (e) {
      toast.error(extractApiError(e)); // 409 cooldown / já em andamento
    } finally {
      setActing(false);
      await carregarCruz();
    }
  };
  const salvarLimiarCruz = () => {
    const v = Number(limiarCruz);
    if (!Number.isFinite(v) || v < 0 || v > 100) {
      toast.error('Limiar inválido — informe um inteiro 0-100.');
      return;
    }
    acao(() => fiscalApi.post('/rfb/cruzamento/limiar', { valor: v }), 'Limiar salvo (aplica no próximo cruzamento)')
      .then(carregarCruz);
  };

  if (loading) return <div className="text-sm text-slate-500">Carregando…</div>;

  const arqTotal = latest?.arquivosTotal ?? 0;
  const arqAtual = latest?.arquivoAtual ?? 0;
  const semUpdateMs = latest?.atualizadoEm ? nowMs - new Date(latest.atualizadoEm).getTime() : 0;

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

      {/* Painel de progresso ao vivo (F1.6) — só durante import */}
      {importando && latest && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-900">
              <Activity className="h-4 w-4 animate-pulse text-blue-600" />
              Importação em andamento — versão {latest.versaoRfb}
            </div>
            <div className="font-mono text-sm text-blue-900">
              ⏱ rodando há {dur(nowMs - new Date(latest.dataInicio ?? Date.now()).getTime())}
            </div>
          </div>

          {/* Tabela atual + arquivo X/Y + barra */}
          {latest.tabelaAtual && (
            <div className="mt-3 text-sm text-slate-700">
              <span className="font-medium">
                {TABELAS.find((t) => t.k === latest.tabelaAtual)?.label ?? latest.tabelaAtual}
              </span>
              {arqTotal > 1 && (
                <>
                  {' '}— arquivo {arqAtual}/{arqTotal}
                  <div className="mt-1 h-1.5 w-full max-w-md overflow-hidden rounded bg-blue-100">
                    <div
                      className="h-full rounded bg-blue-500 transition-all"
                      style={{ width: `${Math.min(100, Math.round((arqAtual / arqTotal) * 100))}%` }}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Throughput + acumulado */}
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600">
            <span>
              Acumulado nesta tabela:{' '}
              <strong className="tabular-nums">
                {(latest.linhasAcumuladas ?? 0).toLocaleString('pt-BR')}
              </strong>
            </span>
            {taxa != null && taxa > 0 && (
              <span>
                Throughput: <strong className="tabular-nums">
                  ≈ {(taxa / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil linhas/s
                </strong>
              </span>
            )}
            <span>
              Última atualização: {hora(latest.atualizadoEm)}
              {semUpdateMs > 25 * 60_000 && (
                <span className="ml-1 text-amber-600">
                  (há {Math.round(semUpdateMs / 60_000)} min — verifique se não travou)
                </span>
              )}
            </span>
          </div>

          {/* Checklist das 6 tabelas */}
          <ul className="mt-3 grid grid-cols-1 gap-1 sm:grid-cols-2">
            {TABELAS.map(({ k, label }) => {
              const st = statusDe(k, latest.progresso, latest.tabelaAtual);
              const n = latest.progresso?.[k]?.linhas;
              const ic =
                st === 'concluida' ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                : st === 'rodando' ? <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                : st === 'erro' ? <XCircle className="h-4 w-4 text-red-600" />
                : <Circle className="h-4 w-4 text-slate-300" />;
              return (
                <li key={k} className="flex items-center gap-2 text-sm">
                  {ic}
                  <span className={st === 'pendente' ? 'text-slate-400' : 'text-slate-700'}>{label}</span>
                  {n != null && n > 0 && (
                    <span className="tabular-nums text-xs text-slate-500">
                      · {n.toLocaleString('pt-BR')}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          <p className="mt-3 text-xs text-slate-500">
            Arquivos grandes (Estabelecimentos/Empresas) levam minutos por etapa — ficar
            sem atualização <em>durante</em> um arquivo é normal (COPY em massa). O painel
            atualiza sozinho a cada 5s.
          </p>
        </div>
      )}

      {/* Estado atual */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Versão mais recente (RFB)</div>
          <div className="mt-1 text-lg font-semibold text-slate-800">{data?.maisRecente ?? '—'}</div>
        </div>
        <div className="rounded-lg border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Já importada?</div>
          <div className={`mt-1 text-lg font-semibold ${importando ? 'text-blue-600' : 'text-slate-800'}`}>
            {importando ? 'Importando…' : data?.importada ? 'Sim' : 'Não'}
          </div>
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
          <Button onClick={importarTudo} disabled={acting || importando}>
            <DownloadCloud className="mr-1.5 h-4 w-4" />
            {importando ? 'Importação em andamento…' : 'Importar base completa'}
          </Button>
        </div>
      )}
      {!isAdmin && (
        <p className="text-xs text-slate-500">Somente ADMIN_TI dispara detecção/importação.</p>
      )}

      {/* Cruzamento SA1+SA2 × RFB (lote pesado — fora da tela de consulta) */}
      <div className="rounded-lg border border-slate-200 p-4">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-slate-700">Cruzamento SA1+SA2 × RFB</span>
          {cruz?.emAndamento && (
            <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">em andamento…</span>
          )}
        </div>
        <p className="mb-2 text-xs text-slate-500">
          Confronta o cadastro Protheus (clientes SA1 + fornecedores SA2) com a
          base RFB e gera o snapshot consultável em <strong>Cadastro → Inteligência
          Cadastral</strong>. <strong>Lote pesado (~2 min)</strong> — cooldown de
          30 min entre execuções.
        </p>
        {cruz?.ultima ? (
          <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            <span>Última: <strong>{cruz.ultima.status}</strong>{cruz.ultima.observacao ? ` · ${cruz.ultima.observacao}` : ''}
              {cruz.ultima.fim ? ` · ${new Date(cruz.ultima.fim).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}` : ''}</span>
            {cruz.ultima.total != null && (
              <span>Total <strong>{cruz.ultima.total.toLocaleString('pt-BR')}</strong> ·
                {' '}<span className="text-red-600">{(cruz.ultima.alertaIrregular ?? 0).toLocaleString('pt-BR')} irreg.</span> ·
                {' '}<span className="text-amber-600">{(cruz.ultima.alertaAtencao ?? 0).toLocaleString('pt-BR')} atenç.</span> ·
                {' '}<span className="text-green-600">{(cruz.ultima.alertaOk ?? 0).toLocaleString('pt-BR')} ok</span> ·
                {' '}{(cruz.ultima.naoEncontrado ?? 0).toLocaleString('pt-BR')} fora RFB</span>
            )}
          </div>
        ) : (
          <p className="mb-2 text-xs text-slate-400">Nunca executado.</p>
        )}
        {isAdmin ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={rodarCruz}
              disabled={acting || !cruz?.podeRodar}
              title={
                cruz?.emAndamento ? 'Cruzamento em andamento'
                  : cruz?.cooldownAte
                    ? `Cooldown — disponível após ${new Date(cruz.cooldownAte).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`
                    : 'Reprocessar o cruzamento (lote pesado)'
              }
            >
              <RefreshCw className="mr-1 h-3.5 w-3.5" /> Rodar cruzamento
            </Button>
            {!cruz?.podeRodar && !cruz?.emAndamento && cruz?.cooldownAte && (
              <span className="text-xs text-amber-600">
                cooldown até {new Date(cruz.cooldownAte).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
              </span>
            )}
            <span className="ml-2 inline-flex items-center gap-1.5 text-xs text-slate-500">
              <label title="% mínimo de similaridade de razão p/ NÃO marcar divergência. Aplica no próximo cruzamento.">
                Limiar divergência:
              </label>
              <input
                type="number" min={0} max={100}
                value={limiarCruz}
                onChange={(e) => setLimiarCruz(e.target.value)}
                className="w-16 rounded-md border border-slate-300 px-2 py-1 text-xs"
              />
              <span className="text-slate-400">%</span>
              <Button
                size="sm" variant="secondary" onClick={salvarLimiarCruz}
                disabled={acting || limiarCruz === String(cruz?.limiarRazao ?? '')}
              >
                Salvar limiar
              </Button>
            </span>
          </div>
        ) : (
          <p className="text-xs text-slate-400">Somente ADMIN_TI dispara o cruzamento / altera o limiar.</p>
        )}
      </div>

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
