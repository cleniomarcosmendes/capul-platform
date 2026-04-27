import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { dashboardService } from '../../services/dashboard.service';
import {
  Clock, Wrench, Star, ArrowLeft, Printer,
  ChevronDown, ChevronRight, Info, History, Paperclip,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { RelatorioChamadoData } from '../../types';

/* ── helpers ─────────────────────────────────────────────────── */

function fmtMin(min: number): string {
  if (min < 1) return '< 1m';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function fmtDataHora(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function fmtData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

/* ── KpiCard ─────────────────────────────────────────────────── */

function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string; icon: LucideIcon; color: string;
}) {
  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-500 uppercase">{label}</span>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

/* ── color maps ──────────────────────────────────────────────── */

const statusColors: Record<string, string> = {
  ABERTO: 'bg-blue-100 text-blue-700', EM_ATENDIMENTO: 'bg-yellow-100 text-yellow-700',
  PENDENTE: 'bg-orange-100 text-orange-700', RESOLVIDO: 'bg-green-100 text-green-700',
  FECHADO: 'bg-slate-100 text-slate-600', CANCELADO: 'bg-red-100 text-red-600',
  REABERTO: 'bg-purple-100 text-purple-700',
  ABERTA: 'bg-blue-100 text-blue-700', EM_EXECUCAO: 'bg-yellow-100 text-yellow-700',
  CONCLUIDA: 'bg-green-100 text-green-700', CANCELADA: 'bg-red-100 text-red-600',
};

const prioridadeColors: Record<string, string> = {
  BAIXA: 'bg-green-100 text-green-700', MEDIA: 'bg-yellow-100 text-yellow-700',
  ALTA: 'bg-orange-100 text-orange-700', CRITICA: 'bg-red-100 text-red-700',
};

const tipoHistoricoLabels: Record<string, string> = {
  ABERTURA: 'Abertura', ASSUMIDO: 'Assumido', TRANSFERENCIA_EQUIPE: 'Transf. Equipe',
  TRANSFERENCIA_TECNICO: 'Transf. Tecnico', COMENTARIO: 'Comentario', RESOLVIDO: 'Resolvido',
  FECHADO: 'Fechado', REABERTO: 'Reaberto', CANCELADO: 'Cancelado', AVALIADO: 'Avaliado',
};

const tipoHistoricoCores: Record<string, string> = {
  ABERTURA: 'bg-blue-100 text-blue-700', ASSUMIDO: 'bg-teal-100 text-teal-700',
  TRANSFERENCIA_EQUIPE: 'bg-indigo-100 text-indigo-700', TRANSFERENCIA_TECNICO: 'bg-indigo-100 text-indigo-700',
  COMENTARIO: 'bg-slate-100 text-slate-600', RESOLVIDO: 'bg-green-100 text-green-700',
  FECHADO: 'bg-slate-200 text-slate-700', REABERTO: 'bg-purple-100 text-purple-700',
  CANCELADO: 'bg-red-100 text-red-600', AVALIADO: 'bg-amber-100 text-amber-700',
};

/* ── InfoItem ────────────────────────────────────────────────── */

function InfoItem({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <span className="block text-xs text-slate-500">{label}</span>
      <span className="block text-sm text-slate-800">{value}</span>
    </div>
  );
}

/* ── Stars ───────────────────────────────────────────────────── */

function Stars({ nota }: { nota: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`w-4 h-4 ${n <= nota ? 'text-amber-500 fill-amber-500' : 'text-slate-300'}`} />
      ))}
    </span>
  );
}

/* ── Page ────────────────────────────────────────────────────── */

export function RelatorioChamadoPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [dados, setDados] = useState<RelatorioChamadoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  // Collapsible sections
  const [showInfo, setShowInfo] = useState(true);
  const [showHistorico, setShowHistorico] = useState(true);
  const [showSessoes, setShowSessoes] = useState(true);
  const [showOs, setShowOs] = useState(true);
  const [showAnexos, setShowAnexos] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    dashboardService.getRelatorioChamado(id)
      .then(setDados)
      .catch(() => setErro('Chamado nao encontrado ou sem permissao.'))
      .finally(() => setLoading(false));
  }, [id]);

  const ch = dados?.chamado;

  return (
    <>
      <style>{`@media print {
        @page { margin: 1cm; }
        .no-print { display: none !important; }
        aside { display: none !important; }
        header, nav { display: none !important; }
        /* h-screen (100vh) do MainLayout reservava página inteira em branco
           antes do conteúdo do relatório. Força auto em print. */
        .h-screen { height: auto !important; min-height: 0 !important; }
        .flex.h-screen { display: block !important; height: auto !important; overflow: visible !important; }
        main { padding: 0 !important; margin: 0 !important; width: 100% !important; max-width: 100% !important; overflow: visible !important; }
        body, html { background: white !important; overflow: visible !important; margin: 0 !important; padding: 0 !important; }
        .overflow-y-auto, .overflow-hidden, .overflow-auto { overflow: visible !important; }
        .bg-white { box-shadow: none !important; border-color: #e2e8f0 !important; }
        table { page-break-inside: auto; font-size: 11px; }
        tr { page-break-inside: avoid; }
      }`}</style>
      <Header title="Relatorio do Chamado" />
      <main className="p-6 space-y-6">
        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-capul-600" />
          </div>
        )}

        {/* Error */}
        {erro && !loading && (
          <div className="text-center py-16">
            <p className="text-slate-500 mb-4">{erro}</p>
            <button onClick={() => navigate(-1)}
              className="text-sm text-capul-600 hover:underline">Voltar</button>
          </div>
        )}

        {/* Report */}
        {dados && ch && !loading && (
          <>
            {/* Header area */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3 no-print">
                  <button onClick={() => navigate(`/gestao-ti/chamados/${id}`)}
                    className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-capul-600">
                    <ArrowLeft className="w-4 h-4" /> Voltar
                  </button>
                  <button onClick={() => window.print()}
                    className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-capul-600">
                    <Printer className="w-4 h-4" /> Imprimir
                  </button>
                </div>
              </div>

              {/* Title + badges */}
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <h2 className="text-lg font-bold text-slate-800">
                  Chamado #{ch.numero} — {ch.titulo}
                </h2>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[ch.status] || 'bg-slate-100 text-slate-600'}`}>
                  {ch.status.replace(/_/g, ' ')}
                </span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${prioridadeColors[ch.prioridade] || 'bg-slate-100 text-slate-600'}`}>
                  {ch.prioridade}
                </span>
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                  {ch.equipeAtual.sigla} — {ch.equipeAtual.nome}
                </span>
              </div>

              {/* Dates row */}
              <div className="flex flex-wrap gap-6 text-xs text-slate-500">
                <span><strong className="text-slate-700">Abertura:</strong> {fmtDataHora(ch.createdAt)}</span>
                {ch.dataLimiteSla && <span><strong className="text-slate-700">SLA:</strong> {fmtDataHora(ch.dataLimiteSla)}</span>}
                {ch.dataResolucao && <span><strong className="text-slate-700">Resolucao:</strong> {fmtDataHora(ch.dataResolucao)}</span>}
                {ch.dataFechamento && <span><strong className="text-slate-700">Fechamento:</strong> {fmtDataHora(ch.dataFechamento)}</span>}
              </div>

              {/* CSAT */}
              {ch.notaSatisfacao != null && (
                <div className="mt-3 flex items-center gap-3">
                  <Stars nota={ch.notaSatisfacao} />
                  <span className="text-sm text-slate-600 font-medium">{ch.notaSatisfacao}/5</span>
                  {ch.comentarioSatisfacao && (
                    <span className="text-xs text-slate-500 italic">"{ch.comentarioSatisfacao}"</span>
                  )}
                </div>
              )}
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard label="Tempo Total" value={fmtMin(dados.resumo.totalMinutos)}
                sub={`${dados.resumo.totalHoras}h`} icon={Clock} color="text-blue-600" />
              <KpiCard label="Sessoes" value={dados.resumo.qtdSessoes}
                icon={Clock} color="text-orange-600" />
              <KpiCard label="OS Vinculadas" value={dados.resumo.qtdOs}
                icon={Wrench} color="text-purple-600" />
              <KpiCard
                label="Avaliacao"
                value={ch.notaSatisfacao != null ? `${ch.notaSatisfacao}/5` : '—'}
                sub={ch.notaSatisfacao != null ? undefined : 'Sem avaliacao'}
                icon={Star} color="text-amber-500"
              />
            </div>

            {/* ── Informacoes Gerais ─────────────────────────── */}
            <div className="bg-white rounded-xl border border-slate-200">
              <button onClick={() => setShowInfo(!showInfo)}
                className="w-full flex items-center gap-2 p-4 text-left hover:bg-slate-50">
                {showInfo ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <Info className="w-4 h-4 text-teal-500" />
                <span className="text-sm font-semibold text-slate-700">Informacoes Gerais</span>
              </button>
              {showInfo && (
                <div className="border-t border-slate-100 p-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
                    <InfoItem label="Solicitante" value={ch.solicitante.nome} />
                    <InfoItem label="Tecnico" value={ch.tecnico?.nome} />
                    <InfoItem label="Equipe" value={`${ch.equipeAtual.sigla} — ${ch.equipeAtual.nome}`} />
                    <InfoItem label="Filial" value={`${ch.filial.codigo} — ${ch.filial.nomeFantasia}`} />
                    <InfoItem label="Departamento" value={ch.departamento?.nome} />
                    <InfoItem label="Software" value={ch.software?.nome || ch.softwareNome} />
                    <InfoItem label="Modulo" value={ch.softwareModulo?.nome || ch.moduloNome} />
                    <InfoItem label="Catalogo de Servico" value={ch.catalogoServico?.nome} />
                    <InfoItem label="SLA" value={ch.slaDefinicao
                      ? `${ch.slaDefinicao.nome} (resp: ${ch.slaDefinicao.horasResposta}h, resol: ${ch.slaDefinicao.horasResolucao}h)`
                      : null
                    } />
                    <InfoItem label="Ativo" value={ch.ativo
                      ? `${ch.ativo.nome} (${ch.ativo.tag})`
                      : null
                    } />
                    <InfoItem label="Projeto Vinculado" value={ch.projeto
                      ? `#${ch.projeto.numero} ${ch.projeto.nome}`
                      : null
                    } />
                    <InfoItem label="IP" value={ch.ipMaquina} />
                    <InfoItem label="Matricula" value={ch.matriculaColaborador} />
                    {ch.colaboradores.length > 0 && (
                      <InfoItem label="Colaboradores" value={ch.colaboradores.map((c) => c.usuario.nome).join(', ')} />
                    )}
                  </div>
                  {/* Descricao */}
                  {ch.descricao && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <span className="block text-xs text-slate-500 mb-1">Descricao</span>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{ch.descricao}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Historico / Timeline ────────────────────────── */}
            {ch.historicos.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200">
                <button onClick={() => setShowHistorico(!showHistorico)}
                  className="w-full flex items-center gap-2 p-4 text-left hover:bg-slate-50">
                  {showHistorico ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <History className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-semibold text-slate-700">Historico / Timeline</span>
                  <span className="text-xs text-slate-400 ml-auto">{ch.historicos.length} registros</span>
                </button>
                {showHistorico && (
                  <div className="border-t border-slate-100 divide-y divide-slate-50">
                    {ch.historicos.map((h) => (
                      <div key={h.id} className="p-4 hover:bg-blue-50/30">
                        <div className="flex items-center gap-3">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${tipoHistoricoCores[h.tipo] || 'bg-slate-100 text-slate-600'}`}>
                            {tipoHistoricoLabels[h.tipo] || h.tipo}
                          </span>
                          <span className="text-sm text-slate-700 flex-1">{h.descricao}</span>
                          <span className="text-xs text-slate-400">{h.usuario.nome}</span>
                          <span className="text-xs text-slate-400 w-20 text-right">{fmtDataHora(h.createdAt)}</span>
                        </div>
                        {(h.equipeOrigem || h.equipeDestino) && (
                          <div className="mt-1 ml-16 text-xs text-slate-400">
                            {h.equipeOrigem && <span>{h.equipeOrigem.sigla}</span>}
                            {h.equipeOrigem && h.equipeDestino && <span className="mx-1">&rarr;</span>}
                            {h.equipeDestino && <span>{h.equipeDestino.sigla}</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Sessoes de Trabalho ────────────────────────── */}
            {dados.sessoes.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200">
                <button onClick={() => setShowSessoes(!showSessoes)}
                  className="w-full flex items-center gap-2 p-4 text-left hover:bg-slate-50">
                  {showSessoes ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <Clock className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-semibold text-slate-700">Sessoes de Trabalho</span>
                  <span className="text-xs text-slate-400 ml-auto">
                    {dados.sessoes.length} sessoes — {fmtMin(dados.resumo.totalMinutos)}
                  </span>
                </button>
                {showSessoes && (
                  <div className="border-t border-slate-100 divide-y divide-slate-50">
                    {dados.sessoes.map((s) => (
                      <div key={s.id} className="px-4 py-2.5 hover:bg-orange-50/30">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />
                          <span className="text-slate-400 w-20">{fmtDataHora(s.horaInicio)}</span>
                          <span className="text-slate-300">—</span>
                          <span className="text-slate-400 w-12">{fmtHora(s.horaFim)}</span>
                          <span className="text-slate-600 font-mono w-12">{fmtMin(s.duracaoMinutos)}</span>
                          <span className="text-slate-500">{s.usuario.nome}</span>
                          {s.observacoes && <span className="text-slate-500 italic truncate flex-1">{s.observacoes}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Ordens de Servico ──────────────────────────── */}
            {dados.ordensServico.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200">
                <button onClick={() => setShowOs(!showOs)}
                  className="w-full flex items-center gap-2 p-4 text-left hover:bg-slate-50">
                  {showOs ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <Wrench className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-semibold text-slate-700">Ordens de Servico</span>
                  <span className="text-xs text-slate-400 ml-auto">{dados.ordensServico.length} OS</span>
                </button>
                {showOs && (
                  <div className="border-t border-slate-100 divide-y divide-slate-50">
                    {dados.ordensServico.map((os) => (
                      <div key={os.id} className="p-4 hover:bg-purple-50/30">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-purple-600 font-bold text-sm">#{os.numero}</span>
                          <span className="text-sm font-medium text-slate-800 flex-1">{os.titulo}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColors[os.status] || 'bg-slate-100 text-slate-600'}`}>
                            {os.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-4 text-xs text-slate-500 ml-6">
                          <span>Filial: {os.filial.codigo} — {os.filial.nomeFantasia}</span>
                          {os.dataAgendamento && <span>Agendamento: {fmtData(os.dataAgendamento)}</span>}
                          {os.dataInicio && <span>Inicio: {fmtDataHora(os.dataInicio)}</span>}
                          {os.dataFim && <span>Fim: {fmtDataHora(os.dataFim)}</span>}
                          {os.tecnicos.length > 0 && (
                            <span>Tecnicos: {os.tecnicos.map((t) => t.tecnico.nome).join(', ')}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Anexos ─────────────────────────────────────── */}
            {ch.anexos.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200">
                <button onClick={() => setShowAnexos(!showAnexos)}
                  className="w-full flex items-center gap-2 p-4 text-left hover:bg-slate-50">
                  {showAnexos ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <Paperclip className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-semibold text-slate-700">Anexos</span>
                  <span className="text-xs text-slate-400 ml-auto">{ch.anexos.length} arquivo{ch.anexos.length > 1 ? 's' : ''}</span>
                </button>
                {showAnexos && (
                  <div className="border-t border-slate-100 divide-y divide-slate-50">
                    {ch.anexos.map((a) => (
                      <div key={a.id} className="px-4 py-2.5 hover:bg-slate-50/50">
                        <div className="flex items-center gap-3 text-sm">
                          <Paperclip className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="text-slate-800 font-medium flex-1">{a.nomeOriginal}</span>
                          <span className="text-xs text-slate-400">{a.mimeType}</span>
                          <span className="text-xs text-slate-400">{formatBytes(a.tamanho)}</span>
                          <span className="text-xs text-slate-400">{a.usuario.nome}</span>
                          <span className="text-xs text-slate-400 w-20 text-right">{fmtDataHora(a.createdAt)}</span>
                        </div>
                        {a.descricao && (
                          <p className="text-xs text-slate-500 italic mt-0.5 ml-6">{a.descricao}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Resumo final */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-600">
                  <span className="font-semibold text-slate-800">Total: {fmtMin(dados.resumo.totalMinutos)}</span>
                  <span className="mx-2 text-slate-300">|</span>
                  <span>{dados.resumo.qtdSessoes} sess{dados.resumo.qtdSessoes !== 1 ? 'oes' : 'ao'}</span>
                  {dados.resumo.qtdOs > 0 && <span className="ml-2">{dados.resumo.qtdOs} OS</span>}
                  {dados.resumo.qtdAnexos > 0 && <span className="ml-2">{dados.resumo.qtdAnexos} anexo{dados.resumo.qtdAnexos > 1 ? 's' : ''}</span>}
                  {dados.resumo.qtdHistoricos > 0 && <span className="ml-2">{dados.resumo.qtdHistoricos} historico{dados.resumo.qtdHistoricos > 1 ? 's' : ''}</span>}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}
