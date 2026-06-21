import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useToast } from '../../components/Toast';
import {
  sacEmailService,
  type SacEmailConfigResp,
  type SacEmailIngestao,
  type ResultadoIngestaoSac,
  type SacEmailTriagemItem,
  type SacEquipe,
} from '../../services/sacEmail.service';
import { AlertTriangle, Download, Link2, Trash2, Paperclip, PlusCircle } from 'lucide-react';

/**
 * SAC — Triagem / Entradas. Trabalho do dia a dia: buscar e-mails, tratar os que
 * não casaram (vincular/abrir/descartar) e ver o log de entradas. Libera SUPORTE
 * (a configuração do poller fica na tela separada, só admin/gestor).
 */
export function SacTriagemPage() {
  const { toast } = useToast();
  const [resp, setResp] = useState<SacEmailConfigResp | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [ingestoes, setIngestoes] = useState<SacEmailIngestao[]>([]);
  const [triagem, setTriagem] = useState<SacEmailTriagemItem[]>([]);
  const [vincNum, setVincNum] = useState<Record<string, string>>({});
  const [triando, setTriando] = useState<string | null>(null);
  const [equipesSac, setEquipesSac] = useState<SacEquipe[]>([]);
  const [abrirEq, setAbrirEq] = useState<Record<string, string>>({});

  function carregar() {
    sacEmailService.getConfig().then(setResp).catch(() => undefined);
    sacEmailService.listarIngestoes().then(setIngestoes).catch(() => undefined);
    sacEmailService.listarTriagem().then(setTriagem).catch(() => undefined);
  }

  useEffect(() => {
    carregar();
    sacEmailService.listarEquipesSac().then(setEquipesSac).catch(() => undefined);
  }, []);

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
      carregar();
    } catch {
      toast('error', 'Erro inesperado ao buscar e-mails.');
    } finally {
      setBuscando(false);
    }
  }

  async function abrirChamado(item: SacEmailTriagemItem) {
    const eq = abrirEq[item.id] || equipesSac[0]?.id;
    if (!eq) {
      toast('error', 'Nenhuma equipe de SAC disponível.');
      return;
    }
    setTriando(item.id);
    try {
      const r = await sacEmailService.abrirTriagem(item.id, eq);
      toast('success', `Chamado de SAC #${r.numero} aberto${r.anexos ? ` (+${r.anexos} anexo[s])` : ''}.`);
      carregar();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast('error', msg || 'Falha ao abrir chamado.');
    } finally {
      setTriando(null);
    }
  }

  async function vincular(item: SacEmailTriagemItem) {
    const num = Number((vincNum[item.id] ?? '').trim());
    if (!num) {
      toast('error', 'Informe o número do chamado de SAC.');
      return;
    }
    setTriando(item.id);
    try {
      const r = await sacEmailService.vincularTriagem(item.id, num);
      toast('success', `Vinculado ao chamado #${num}${r.anexos ? ` (+${r.anexos} anexo[s])` : ''}.`);
      carregar();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast('error', msg || 'Falha ao vincular.');
    } finally {
      setTriando(null);
    }
  }

  async function descartar(item: SacEmailTriagemItem) {
    setTriando(item.id);
    try {
      await sacEmailService.descartarTriagem(item.id);
      toast('success', 'Item descartado.');
      carregar();
    } catch {
      toast('error', 'Falha ao descartar.');
    } finally {
      setTriando(null);
    }
  }

  const conexao = resp?.conexao;

  return (
    <>
      <Header title="SAC — Triagem" />
      <div className="p-6">
        <div className="space-y-6">
          {/* Ação de busca + último ciclo */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-700 text-sm">Entradas de e-mail</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Busca e classifica as não-lidas. O automático roda sozinho; aqui é manual (não respeita o freio de mão).
                </p>
              </div>
              <button
                onClick={buscarAgora}
                disabled={buscando || !conexao?.configurada}
                title={!conexao?.configurada ? 'Conexão IMAP não configurada (veja Configuração de e-mail)' : 'Busca e classifica as não-lidas'}
                className="inline-flex items-center gap-2 bg-capul-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-capul-700 disabled:opacity-50"
              >
                <Download className={`w-4 h-4 ${buscando ? 'animate-pulse' : ''}`} /> {buscando ? 'Buscando…' : 'Buscar agora'}
              </button>
            </div>
            {!conexao?.configurada && (
              <div className="mt-3 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>Conexão IMAP não configurada. Peça a um gestor para ajustar em <Link to="/gestao-ti/sac-email" className="underline">Configuração de e-mail</Link>.</span>
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-sm mt-4 pt-4 border-t border-slate-100">
              <Info label="Último poll" value={resp?.config.lastPollAt ? new Date(resp.config.lastPollAt).toLocaleString('pt-BR') : '— (sem ciclo ainda)'} />
              <Info label="Status" value={resp?.config.lastStatus ?? '—'} />
              <Info label="Processados (total)" value={String(resp?.config.processadosTotal ?? 0)} />
              <Info label="Último erro" value={resp?.config.lastError ?? '—'} />
            </div>
          </div>

          {/* Caixa de Triagem */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Caixa de Triagem
              {triagem.length > 0 && (
                <span className="inline-block px-2 py-0.5 rounded-full text-xs border bg-amber-50 text-amber-700 border-amber-200">{triagem.length}</span>
              )}
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              E-mails que não casaram com um chamado (sem <code>[SAC-n]</code> ou número inexistente). Vincule a um chamado de SAC, abra um novo ou descarte.
            </p>
            {triagem.length === 0 ? (
              <p className="text-sm text-slate-400">Nada pendente. 🎉</p>
            ) : (
              <div className="space-y-3">
                {triagem.map((it) => (
                  <div key={it.id} className="border border-slate-200 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm text-slate-700 font-medium truncate">{it.subject || '(sem assunto)'}</div>
                        <div className="text-xs text-slate-500">De: {it.fromAddr ?? '—'} · {new Date(it.processadoEm).toLocaleString('pt-BR')}</div>
                      </div>
                      {it.anexos.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500 shrink-0">
                          <Paperclip className="w-3 h-3" /> {it.anexos.length}
                        </span>
                      )}
                    </div>
                    {it.corpoTexto && (
                      <p className="text-xs text-slate-500 mt-2 whitespace-pre-wrap line-clamp-3 bg-slate-50 rounded p-2">{it.corpoTexto.slice(0, 400)}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <span className="text-xs text-slate-500">Vincular ao chamado nº</span>
                      <input
                        value={vincNum[it.id] ?? ''}
                        onChange={(e) => setVincNum((m) => ({ ...m, [it.id]: e.target.value.replace(/\D/g, '') }))}
                        placeholder="ex.: 1405"
                        className="w-24 border border-slate-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600"
                      />
                      <button onClick={() => vincular(it)} disabled={triando === it.id}
                        className="inline-flex items-center gap-1.5 bg-capul-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-capul-700 disabled:opacity-50">
                        <Link2 className="w-4 h-4" /> Vincular
                      </button>
                      <button onClick={() => descartar(it)} disabled={triando === it.id}
                        className="inline-flex items-center gap-1.5 bg-white border border-slate-300 text-slate-600 px-3 py-1.5 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-50">
                        <Trash2 className="w-4 h-4" /> Descartar
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-slate-100">
                      <span className="text-xs text-slate-500">ou abrir novo na equipe</span>
                      <select value={abrirEq[it.id] ?? ''} onChange={(e) => setAbrirEq((m) => ({ ...m, [it.id]: e.target.value }))}
                        className="border border-slate-300 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-capul-600">
                        {equipesSac.length === 0 && <option value="">— sem equipe SAC —</option>}
                        {equipesSac.map((e) => (
                          <option key={e.id} value={e.id}>{e.sigla ? `${e.sigla} — ` : ''}{e.nome}</option>
                        ))}
                      </select>
                      <button onClick={() => abrirChamado(it)} disabled={triando === it.id || equipesSac.length === 0}
                        className="inline-flex items-center gap-1.5 bg-white border border-capul-300 text-capul-700 px-3 py-1.5 rounded-lg text-sm hover:bg-capul-50 disabled:opacity-50">
                        <PlusCircle className="w-4 h-4" /> Abrir novo chamado
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Log de ingestões */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-700 text-sm mb-3">
              Últimas entradas <span className="text-slate-400 font-normal">({ingestoes.length})</span>
            </h3>
            {ingestoes.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhuma entrada ainda. Use “Buscar agora” para varrer a caixa.</p>
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
                        <td className="py-2 pr-3 text-slate-600 max-w-md truncate" title={it.subject ?? ''}>{it.subject ?? '—'}</td>
                        <td className="py-2 pr-3 text-slate-600">
                          {it.chamadoId ? (
                            <Link to={`/gestao-ti/chamados/${it.chamadoId}`} className="text-capul-600 hover:underline">#{it.sacNumero}</Link>
                          ) : it.sacNumero ? `#${it.sacNumero}` : '—'}
                        </td>
                        <td className="py-2 text-slate-400">{it.motivo ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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
