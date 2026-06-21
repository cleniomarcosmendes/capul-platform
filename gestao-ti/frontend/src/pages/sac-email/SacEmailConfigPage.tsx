import { useEffect, useState } from 'react';
import { Header } from '../../layouts/Header';
import { useToast } from '../../components/Toast';
import {
  sacEmailService,
  type SacEmailConfigResp,
  type SacEmailTesteResp,
  type SacEmailIngestao,
  type ResultadoIngestaoSac,
} from '../../services/sacEmail.service';
import { Inbox, Plug, Save, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Download } from 'lucide-react';

/**
 * SAC Fase 3 (3a) — config OPERACIONAL do e-mail de ENTRADA. Admin/Gestor.
 * A CONEXÃO IMAP vem do ambiente (SAC_IMAP_*); aqui o admin gerencia os toggles
 * e testa a conexão. Ingestão/agendador entram nas 3b-3d.
 */
export function SacEmailConfigPage() {
  const { toast } = useToast();
  const [resp, setResp] = useState<SacEmailConfigResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [teste, setTeste] = useState<SacEmailTesteResp | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [ingestoes, setIngestoes] = useState<SacEmailIngestao[]>([]);

  // Form local (toggles).
  const [enabled, setEnabled] = useState(false);
  const [pauseSync, setPauseSync] = useState(false);
  const [mailboxFolder, setMailboxFolder] = useState('INBOX');
  const [pollIntervalMinutes, setPollIntervalMinutes] = useState(5);

  function aplicar(r: SacEmailConfigResp) {
    setResp(r);
    setEnabled(r.config.enabled);
    setPauseSync(r.config.pauseSync);
    setMailboxFolder(r.config.mailboxFolder);
    setPollIntervalMinutes(r.config.pollIntervalMinutes);
  }

  function carregarIngestoes() {
    sacEmailService.listarIngestoes().then(setIngestoes).catch(() => undefined);
  }

  useEffect(() => {
    sacEmailService
      .getConfig()
      .then(aplicar)
      .catch(() => toast('error', 'Falha ao carregar a configuração do SAC e-mail.'))
      .finally(() => setLoading(false));
    carregarIngestoes();
  }, [toast]);

  async function buscarAgora() {
    setBuscando(true);
    try {
      const r = await sacEmailService.buscarAgora();
      if (!r.ok) {
        toast('error', r.error || 'Falha ao buscar e-mails.');
      } else {
        const s = r.resumo!;
        toast('success', `${s.buscados} buscado(s): ${s.matched} casado(s), ${s.unmatched} triagem, ${s.skippedAuto + s.skippedOwn} ignorado(s), ${s.duplicate} dup.${s.capped ? ' (teto atingido)' : ''}`);
      }
      // recarrega config (último ciclo) + log
      const cfg = await sacEmailService.getConfig();
      aplicar(cfg);
      carregarIngestoes();
    } catch {
      toast('error', 'Erro inesperado ao buscar e-mails.');
    } finally {
      setBuscando(false);
    }
  }

  async function salvar() {
    setSalvando(true);
    try {
      const r = await sacEmailService.updateConfig({ enabled, pauseSync, mailboxFolder, pollIntervalMinutes });
      aplicar(r);
      toast('success', 'Configuração salva.');
    } catch {
      toast('error', 'Falha ao salvar a configuração.');
    } finally {
      setSalvando(false);
    }
  }

  async function testar() {
    setTestando(true);
    setTeste(null);
    try {
      const r = await sacEmailService.testarConexao();
      setTeste(r);
      toast(r.ok ? 'success' : 'error', r.ok ? 'Conexão IMAP OK.' : 'Falha na conexão IMAP.');
    } catch {
      setTeste({ ok: false, error: 'Erro inesperado ao testar.' });
      toast('error', 'Erro inesperado ao testar.');
    } finally {
      setTestando(false);
    }
  }

  const conexao = resp?.conexao;

  return (
    <>
      <Header title="SAC — E-mail de entrada" />
      <div className="p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {loading ? (
            <div className="text-slate-500 text-sm">Carregando…</div>
          ) : (
            <>
              <p className="text-sm text-slate-500">
                Configuração do consumo de e-mails de <strong>entrada</strong> do SAC (resposta do cliente cai no
                chamado pelo protocolo <code>[SAC-n]</code>). Esta tela controla o poller IMAP. A ingestão automática
                entra nas próximas sub-fases — por ora dá pra <strong>testar a conexão</strong>.
              </p>

              {/* Conexão (vem do ambiente) */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2 mb-3">
                  <Plug className="w-4 h-4 text-capul-600" /> Conexão IMAP (via ambiente)
                </h3>
                {conexao?.configurada ? (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <Info label="Servidor" value={`${conexao.host}:${conexao.port}`} />
                    <Info label="Usuário" value={conexao.user ?? '—'} />
                    <Info label="TLS" value={conexao.secure ? 'Sim' : 'Não'} />
                    <Info label="Senha" value={conexao.senhaConfigurada ? '•••••• (configurada)' : 'não definida'} />
                  </div>
                ) : (
                  <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>
                      Conexão não configurada no ambiente. Defina <code>SAC_IMAP_HOST</code>, <code>SAC_IMAP_USER</code>{' '}
                      e <code>SAC_IMAP_PASSWORD</code> (deploy) — espelha o padrão do <code>SMTP_*</code>.
                    </span>
                  </div>
                )}
                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={testar}
                    disabled={testando || !conexao?.configurada}
                    className="inline-flex items-center gap-2 bg-slate-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-800 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${testando ? 'animate-spin' : ''}`} /> Testar conexão
                  </button>
                  <button
                    onClick={buscarAgora}
                    disabled={buscando || !conexao?.configurada}
                    title="Busca e classifica as não-lidas (manual — não respeita o freio de mão; sem criar histórico ainda)"
                    className="inline-flex items-center gap-2 bg-capul-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-capul-700 disabled:opacity-50"
                  >
                    <Download className={`w-4 h-4 ${buscando ? 'animate-pulse' : ''}`} /> {buscando ? 'Buscando…' : 'Buscar agora'}
                  </button>
                  {teste && (
                    <span
                      className={`inline-flex items-center gap-1.5 text-sm ${teste.ok ? 'text-emerald-700' : 'text-red-600'}`}
                    >
                      {teste.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      {teste.ok
                        ? `${teste.mailbox}: ${teste.total} mensagem(ns), ${teste.unseen} não lida(s)`
                        : teste.error}
                    </span>
                  )}
                </div>
              </div>

              {/* Toggles operacionais */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                  <Inbox className="w-4 h-4 text-capul-600" /> Operação
                </h3>

                <Toggle
                  label="Consumo automático ligado"
                  hint="Liga o poller agendado (efetivo nas próximas sub-fases)."
                  checked={enabled}
                  onChange={setEnabled}
                />
                <Toggle
                  label="Pausar (freio de mão)"
                  hint="Pausa só o consumo AUTOMÁTICO (poller). Não afeta o “Buscar agora” manual."
                  checked={pauseSync}
                  onChange={setPauseSync}
                />

                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-xs text-slate-500">Pasta IMAP</span>
                    <input
                      value={mailboxFolder}
                      onChange={(e) => setMailboxFolder(e.target.value)}
                      className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-500">Intervalo do poll (min)</span>
                    <input
                      type="number"
                      min={1}
                      max={1440}
                      value={pollIntervalMinutes}
                      onChange={(e) => setPollIntervalMinutes(Number(e.target.value))}
                      className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600"
                    />
                  </label>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={salvar}
                    disabled={salvando}
                    className="inline-flex items-center gap-2 bg-capul-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-capul-700 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" /> {salvando ? 'Salvando…' : 'Salvar'}
                  </button>
                </div>
              </div>

              {/* Último status */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-700 text-sm mb-3">Último ciclo</h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <Info label="Último poll" value={resp?.config.lastPollAt ? new Date(resp.config.lastPollAt).toLocaleString('pt-BR') : '— (sem ciclo ainda)'} />
                  <Info label="Status" value={resp?.config.lastStatus ?? '—'} />
                  <Info label="Processados (total)" value={String(resp?.config.processadosTotal ?? 0)} />
                  <Info label="Último erro" value={resp?.config.lastError ?? '—'} />
                </div>
              </div>

              {/* Log de ingestão (3b) */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-700 text-sm mb-3">
                  Últimas ingestões <span className="text-slate-400 font-normal">({ingestoes.length})</span>
                </h3>
                {ingestoes.length === 0 ? (
                  <p className="text-sm text-slate-400">Nenhuma ingestão ainda. Use “Buscar agora” para varrer a caixa.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                          <th className="py-2 pr-3">Quando</th>
                          <th className="py-2 pr-3">Resultado</th>
                          <th className="py-2 pr-3">De</th>
                          <th className="py-2 pr-3">Assunto</th>
                          <th className="py-2 pr-3">SAC</th>
                          <th className="py-2">Motivo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ingestoes.map((it) => (
                          <tr key={it.id} className="border-b border-slate-50">
                            <td className="py-2 pr-3 whitespace-nowrap text-slate-500">{new Date(it.processadoEm).toLocaleString('pt-BR')}</td>
                            <td className="py-2 pr-3"><BadgeResultado r={it.resultado} /></td>
                            <td className="py-2 pr-3 text-slate-600">{it.fromAddr ?? '—'}</td>
                            <td className="py-2 pr-3 text-slate-600 max-w-xs truncate" title={it.subject ?? ''}>{it.subject ?? '—'}</td>
                            <td className="py-2 pr-3 text-slate-600">{it.sacNumero ? `#${it.sacNumero}` : '—'}</td>
                            <td className="py-2 text-slate-400">{it.motivo ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

const RESULTADO_STYLE: Record<ResultadoIngestaoSac, { label: string; cls: string }> = {
  MATCHED: { label: 'Casado', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  UNMATCHED: { label: 'Triagem', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  SKIPPED_AUTO: { label: 'Auto/bounce', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  SKIPPED_OWN: { label: 'Próprio', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  DUPLICATE: { label: 'Duplicado', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  ERROR: { label: 'Erro', cls: 'bg-red-50 text-red-600 border-red-200' },
};

function BadgeResultado({ r }: { r: ResultadoIngestaoSac }) {
  const s = RESULTADO_STYLE[r];
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs border ${s.cls}`}>{s.label}</span>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-slate-700">{value}</div>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1" />
      <span>
        <span className="text-sm text-slate-700">{label}</span>
        {hint && <span className="block text-xs text-slate-400">{hint}</span>}
      </span>
    </label>
  );
}
