import { useEffect, useState, useCallback } from 'react';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardService } from '../../services/dashboard.service';
import {
  Clock, Ticket, FolderKanban, Search, FileText,
  ChevronDown, ChevronRight, MessageSquare, Printer,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { RelatorioOsData } from '../../types';

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

const statusColors: Record<string, string> = {
  ABERTO: 'bg-blue-100 text-blue-700', EM_ATENDIMENTO: 'bg-yellow-100 text-yellow-700',
  PENDENTE: 'bg-orange-100 text-orange-700', RESOLVIDO: 'bg-green-100 text-green-700',
  FECHADO: 'bg-slate-100 text-slate-600', CANCELADO: 'bg-red-100 text-red-600',
  REABERTO: 'bg-purple-100 text-purple-700',
  EM_ANDAMENTO: 'bg-yellow-100 text-yellow-700', CONCLUIDA: 'bg-green-100 text-green-700',
};

const statusLabels: Record<string, string> = {
  ABERTO: 'Aberto', EM_ATENDIMENTO: 'Em Atendimento', PENDENTE: 'Pendente',
  RESOLVIDO: 'Resolvido', FECHADO: 'Fechado', CANCELADO: 'Cancelado', REABERTO: 'Reaberto',
  EM_ANDAMENTO: 'Em Andamento', CONCLUIDA: 'Concluida', CANCELADA: 'Cancelada',
};

export function RelatorioOsPage() {
  const { gestaoTiRole, usuario } = useAuth();
  const isManager = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');

  const [tecnicos, setTecnicos] = useState<{ id: string; nome: string; username: string }[]>([]);
  const [tecnicoId, setTecnicoId] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [dados, setDados] = useState<RelatorioOsData | null>(null);
  const [loading, setLoading] = useState(false);

  // Seções colapsáveis
  const [showChamados, setShowChamados] = useState(true);
  const [showAtividades, setShowAtividades] = useState(true);
  const [showApontamentos, setShowApontamentos] = useState(true);

  useEffect(() => {
    dashboardService.getTecnicos().then(setTecnicos).catch(() => {});
    // Default: mês atual
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    setDataInicio(`${y}-${m}-01`);
    setDataFim(`${y}-${m}-${String(new Date(y, now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`);
    // Não-manager: fixar no próprio ID
    if (!isManager && usuario?.id) setTecnicoId(usuario.id);
  }, []);

  const gerar = useCallback(() => {
    const id = tecnicoId || (usuario?.id ?? '');
    if (!id || !dataInicio || !dataFim) return;
    setLoading(true);
    dashboardService.getRelatorioOs({ tecnicoId: id, dataInicio, dataFim })
      .then(setDados)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tecnicoId, dataInicio, dataFim, usuario]);

  const tecnicoNome = tecnicos.find((t) => t.id === (tecnicoId || usuario?.id))?.nome || usuario?.nome || '';

  return (
    <>
      <style>{`@media print {
        @page { margin: 1cm; }
        .no-print { display: none !important; }
        aside { display: none !important; }
        header, nav { display: none !important; }
        /* h-screen (100vh) no MainLayout fazia o browser reservar uma página
           inteira pro container flex, empurrando o relatório pra página 2
           (página 1 ficava em branco com só o sidebar). Forçamos auto em
           print para o conteúdo começar do topo da primeira página. */
        .h-screen { height: auto !important; min-height: 0 !important; }
        .flex.h-screen { display: block !important; height: auto !important; overflow: visible !important; }
        main { padding: 0 !important; margin: 0 !important; width: 100% !important; max-width: 100% !important; overflow: visible !important; }
        body, html { background: white !important; overflow: visible !important; margin: 0 !important; padding: 0 !important; }
        .overflow-y-auto, .overflow-hidden, .overflow-auto { overflow: visible !important; }
        .bg-white { box-shadow: none !important; border-color: #e2e8f0 !important; }
        table { page-break-inside: auto; font-size: 11px; }
        tr { page-break-inside: avoid; }
      }`}</style>
      <Header title="Relatorio de OS" />
      <main className="p-6 space-y-6">
        {/* Filtros */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 no-print">
          <div className="flex flex-wrap gap-4 items-end">
            {isManager && (
              <div className="min-w-[220px]">
                <label className="block text-xs font-medium text-slate-500 mb-1">Tecnico</label>
                <select value={tecnicoId} onChange={(e) => setTecnicoId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-capul-500">
                  <option value="">Selecione...</option>
                  {tecnicos.map((t) => (
                    <option key={t.id} value={t.id}>{t.nome}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Data Inicio</label>
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Data Fim</label>
              <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" />
            </div>
            <button onClick={gerar} disabled={loading || (!tecnicoId && isManager)}
              className="flex items-center gap-2 px-5 py-2 bg-capul-600 text-white rounded-lg hover:bg-capul-700 disabled:opacity-50 text-sm font-medium">
              <Search className="w-4 h-4" /> {loading ? 'Gerando...' : 'Gerar Relatorio'}
            </button>
          </div>
        </div>

        {loading && <div className="text-center text-slate-500 py-8">Carregando relatorio...</div>}

        {dados && !loading && (
          <>
            {/* Header do relatório */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-800">
                    Relatorio de OS — {tecnicoNome}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Periodo: {fmtData(dataInicio)} a {fmtData(dataFim)}
                  </p>
                </div>
                <button onClick={() => { setShowChamados(true); setShowAtividades(true); setShowApontamentos(true); setTimeout(() => window.print(), 100); }}
                  className="no-print flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 hover:text-capul-600 border border-slate-200 rounded-lg hover:border-capul-300">
                  <Printer className="w-4 h-4" /> Imprimir
                </button>
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard label="Total Geral" value={fmtMin(dados.resumo.totalMinutosGeral)}
                sub={`${dados.resumo.totalHorasGeral}h`} icon={Clock} color="text-blue-600" />
              <KpiCard label="Chamados" value={dados.resumo.qtdChamados}
                sub={fmtMin(dados.resumo.totalMinutosChamados)} icon={Ticket} color="text-orange-600" />
              <KpiCard label="Atividades" value={dados.resumo.qtdAtividades}
                sub={fmtMin(dados.resumo.totalMinutosAtividades)} icon={FolderKanban} color="text-purple-600" />
              <KpiCard label="Apontamentos" value={dados.resumo.qtdApontamentos}
                sub={fmtMin(dados.resumo.totalMinutosApontamentos)} icon={FileText} color="text-green-600" />
            </div>

            {/* CHAMADOS */}
            {dados.chamados.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200">
                <button onClick={() => setShowChamados(!showChamados)}
                  className="w-full flex items-center gap-2 p-4 text-left hover:bg-slate-50">
                  {showChamados ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <Ticket className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-semibold text-slate-700">Chamados</span>
                  <span className="text-xs text-slate-400 ml-auto">
                    {dados.chamados.length} chamados — {fmtMin(dados.resumo.totalMinutosChamados)}
                  </span>
                </button>
                {showChamados && (
                  <div className="border-t border-slate-100 divide-y divide-slate-50">
                    {dados.chamados.map((item) => (
                      <div key={item.chamado.id} className="p-4 hover:bg-orange-50/30">
                        {/* Cabeçalho do chamado */}
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-mono text-orange-600 font-bold text-sm">#{item.chamado.numero}</span>
                          <span className="text-sm font-medium text-slate-800 flex-1">{item.chamado.titulo}</span>
                          <span className="text-xs text-slate-400">{item.chamado.equipeAtual.sigla}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColors[item.chamado.status] || ''}`}>
                            {statusLabels[item.chamado.status] || item.chamado.status}
                          </span>
                          <span className="text-sm font-semibold text-slate-700 font-mono w-16 text-right">{fmtMin(item.totalMinutos)}</span>
                        </div>
                        {/* Descrição */}
                        {item.chamado.descricao && (
                          <p className="text-xs text-slate-500 mb-2 pl-4 border-l-2 border-orange-200 line-clamp-3">
                            {item.chamado.descricao}
                          </p>
                        )}
                        {/* Sessões */}
                        <div className="ml-4 space-y-0.5">
                          {item.sessoes.map((s, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <span className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />
                              <span className="text-slate-400 w-20">{fmtDataHora(s.horaInicio)}</span>
                              <span className="text-slate-300">—</span>
                              <span className="text-slate-400 w-12">{fmtHora(s.horaFim)}</span>
                              <span className="text-slate-600 font-mono w-12">{fmtMin(s.duracaoMinutos)}</span>
                              {s.observacoes && <span className="text-slate-500 italic truncate flex-1">{s.observacoes}</span>}
                            </div>
                          ))}
                        </div>
                        {/* Comentários do período */}
                        {item.chamado.historicos.length > 0 && (
                          <div className="ml-4 mt-2 space-y-1">
                            {item.chamado.historicos.map((h, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs">
                                <MessageSquare className="w-3 h-3 text-slate-400 mt-0.5 flex-shrink-0" />
                                <span className="text-slate-400 w-20 flex-shrink-0">{fmtDataHora(h.createdAt)}</span>
                                <span className="text-slate-600 flex-1">{h.descricao}</span>
                                <span className="text-slate-400">{h.usuario.nome}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ATIVIDADES */}
            {dados.atividades.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200">
                <button onClick={() => setShowAtividades(!showAtividades)}
                  className="w-full flex items-center gap-2 p-4 text-left hover:bg-slate-50">
                  {showAtividades ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <FolderKanban className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-semibold text-slate-700">Atividades de Projeto</span>
                  <span className="text-xs text-slate-400 ml-auto">
                    {dados.atividades.length} atividades — {fmtMin(dados.resumo.totalMinutosAtividades)}
                  </span>
                </button>
                {showAtividades && (
                  <div className="border-t border-slate-100 divide-y divide-slate-50">
                    {dados.atividades.map((item) => (
                      <div key={item.atividade.id} className="p-4 hover:bg-purple-50/30">
                        {/* Cabeçalho */}
                        <div className="flex items-center gap-3 mb-2">
                          <FolderKanban className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                          <span className="text-sm font-medium text-slate-800 flex-1">{item.atividade.titulo}</span>
                          <span className="text-xs text-slate-400">
                            #{item.atividade.projeto.numero} {item.atividade.projeto.nome}
                          </span>
                          {item.atividade.fase && <span className="text-xs text-slate-400">| {item.atividade.fase.nome}</span>}
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColors[item.atividade.status] || ''}`}>
                            {statusLabels[item.atividade.status] || item.atividade.status}
                          </span>
                          <span className="text-sm font-semibold text-slate-700 font-mono w-16 text-right">{fmtMin(item.totalMinutos)}</span>
                        </div>
                        {/* Descrição */}
                        {item.atividade.descricao && (
                          <p className="text-xs text-slate-500 mb-2 pl-4 border-l-2 border-purple-200 line-clamp-3">
                            {item.atividade.descricao}
                          </p>
                        )}
                        {/* Sessões */}
                        <div className="ml-4 space-y-0.5">
                          {item.sessoes.map((s, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <span className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />
                              <span className="text-slate-400 w-20">{fmtDataHora(s.horaInicio)}</span>
                              <span className="text-slate-300">—</span>
                              <span className="text-slate-400 w-12">{fmtHora(s.horaFim)}</span>
                              <span className="text-slate-600 font-mono w-12">{fmtMin(s.duracaoMinutos)}</span>
                              {s.observacoes && <span className="text-slate-500 italic truncate flex-1">{s.observacoes}</span>}
                            </div>
                          ))}
                        </div>
                        {/* Comentários */}
                        {item.atividade.comentarios.length > 0 && (
                          <div className="ml-4 mt-2 space-y-1">
                            {item.atividade.comentarios.map((c, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs">
                                <MessageSquare className="w-3 h-3 text-slate-400 mt-0.5 flex-shrink-0" />
                                <span className="text-slate-400 w-20 flex-shrink-0">{fmtDataHora(c.createdAt)}</span>
                                <span className="text-slate-600 flex-1">{c.texto}</span>
                                <span className="text-slate-400">{c.usuario.nome}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* APONTAMENTOS */}
            {dados.apontamentos.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200">
                <button onClick={() => setShowApontamentos(!showApontamentos)}
                  className="w-full flex items-center gap-2 p-4 text-left hover:bg-slate-50">
                  {showApontamentos ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <FileText className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-semibold text-slate-700">Apontamentos Manuais</span>
                  <span className="text-xs text-slate-400 ml-auto">
                    {dados.apontamentos.length} registros — {fmtMin(dados.resumo.totalMinutosApontamentos)}
                  </span>
                </button>
                {showApontamentos && (
                  <div className="border-t border-slate-100 divide-y divide-slate-50">
                    {dados.apontamentos.map((a) => (
                      <div key={a.id} className="p-4 hover:bg-green-50/30">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-xs text-slate-400">{fmtData(a.data)}</span>
                          <span className="text-sm font-medium text-slate-800 flex-1">{a.descricao}</span>
                          <span className="text-xs text-slate-400">
                            #{a.projeto.numero} {a.projeto.nome}
                          </span>
                          {a.fase && <span className="text-xs text-slate-400">| {a.fase.nome}</span>}
                          <span className="text-sm font-semibold text-slate-700 font-mono w-16 text-right">{a.horas}h</span>
                        </div>
                        {a.observacoes && (
                          <p className="text-xs text-slate-500 pl-4 border-l-2 border-green-200">{a.observacoes}</p>
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
                  <span className="font-semibold text-slate-800">Total: {fmtMin(dados.resumo.totalMinutosGeral)}</span>
                  <span className="mx-2 text-slate-300">|</span>
                  {dados.resumo.qtdChamados > 0 && <span>{dados.resumo.qtdChamados} chamado{dados.resumo.qtdChamados > 1 ? 's' : ''}</span>}
                  {dados.resumo.qtdAtividades > 0 && <span className="ml-2">{dados.resumo.qtdAtividades} atividade{dados.resumo.qtdAtividades > 1 ? 's' : ''}</span>}
                  {dados.resumo.qtdApontamentos > 0 && <span className="ml-2">{dados.resumo.qtdApontamentos} apontamento{dados.resumo.qtdApontamentos > 1 ? 's' : ''}</span>}
                </div>
              </div>
            </div>

            {/* Sem resultados */}
            {dados.resumo.totalMinutosGeral === 0 && (
              <div className="text-center text-slate-500 py-8">
                Nenhum registro de tempo encontrado no periodo informado.
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
