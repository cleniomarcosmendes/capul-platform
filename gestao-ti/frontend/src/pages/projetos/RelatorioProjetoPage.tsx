import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { dashboardService } from '../../services/dashboard.service';
import {
  Clock, ArrowLeft, Printer, ChevronDown, ChevronRight,
  Users, Layers, ListChecks, AlertTriangle, DollarSign,
  FolderKanban, Paperclip, FileText, CircleAlert, Shield,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { RelatorioProjetoData } from '../../types';

/* ─── Formatters ────────────────────────────────────────────── */

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

function fmtData(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtCurrency(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function fmtBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ─── KPI Card ──────────────────────────────────────────────── */

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

/* ─── Collapsible Section ───────────────────────────────────── */

function Section({ title, icon: Icon, iconColor, count, children, defaultOpen = true, accent }: {
  title: string; icon: LucideIcon; iconColor: string; count?: string;
  children: React.ReactNode; defaultOpen?: boolean; accent?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`bg-white rounded-xl border ${accent ? 'border-l-4 ' + accent : 'border-slate-200'}`}>
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 p-4 text-left hover:bg-slate-50">
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <span className="text-sm font-semibold text-slate-700">{title}</span>
        {count && <span className="text-xs text-slate-400 ml-auto">{count}</span>}
      </button>
      {open && <div className="border-t border-slate-100">{children}</div>}
    </div>
  );
}

/* ─── Color Maps ────────────────────────────────────────────── */

const statusCores: Record<string, string> = {
  PLANEJAMENTO: 'bg-blue-100 text-blue-700', EM_ANDAMENTO: 'bg-yellow-100 text-yellow-700',
  PAUSADO: 'bg-orange-100 text-orange-700', CONCLUIDO: 'bg-green-100 text-green-700',
  CANCELADO: 'bg-red-100 text-red-600',
};

const faseStatusCores: Record<string, string> = {
  PENDENTE: 'bg-slate-100 text-slate-600', EM_ANDAMENTO: 'bg-yellow-100 text-yellow-700',
  APROVADA: 'bg-green-100 text-green-700', REJEITADA: 'bg-red-100 text-red-600',
};

const atividadeStatusCores: Record<string, string> = {
  PENDENTE: 'bg-slate-100 text-slate-600', EM_ANDAMENTO: 'bg-yellow-100 text-yellow-700',
  CONCLUIDA: 'bg-green-100 text-green-700', CANCELADA: 'bg-red-100 text-red-600',
};

const riscoProbaImpactoCores: Record<string, string> = {
  MUITO_BAIXA: 'bg-slate-100 text-slate-600', BAIXA: 'bg-green-100 text-green-700',
  MEDIA: 'bg-yellow-100 text-yellow-700', ALTA: 'bg-orange-100 text-orange-700',
  MUITO_ALTA: 'bg-red-100 text-red-600',
  // impacto reuses same
  MUITO_BAIXO: 'bg-slate-100 text-slate-600', BAIXO: 'bg-green-100 text-green-700',
  MEDIO: 'bg-yellow-100 text-yellow-700', ALTO: 'bg-orange-100 text-orange-700',
  MUITO_ALTO: 'bg-red-100 text-red-600',
};

const riscoStatusCores: Record<string, string> = {
  IDENTIFICADO: 'bg-blue-100 text-blue-700', EM_ANALISE: 'bg-yellow-100 text-yellow-700',
  MITIGANDO: 'bg-orange-100 text-orange-700', ACEITO: 'bg-slate-100 text-slate-600',
  RESOLVIDO: 'bg-green-100 text-green-700',
};

const pendenciaStatusCores: Record<string, string> = {
  ABERTA: 'bg-blue-100 text-blue-700', EM_ANDAMENTO: 'bg-yellow-100 text-yellow-700',
  AGUARDANDO_VALIDACAO: 'bg-orange-100 text-orange-700', CONCLUIDA: 'bg-green-100 text-green-700',
  CANCELADA: 'bg-slate-100 text-slate-600',
};

const pendenciaPrioridadeCores: Record<string, string> = {
  BAIXA: 'bg-green-100 text-green-700', MEDIA: 'bg-yellow-100 text-yellow-700',
  ALTA: 'bg-orange-100 text-orange-700', URGENTE: 'bg-red-100 text-red-600',
};

const cotacaoStatusCores: Record<string, string> = {
  RASCUNHO: 'bg-slate-100 text-slate-600', SOLICITADA: 'bg-blue-100 text-blue-700',
  RECEBIDA: 'bg-yellow-100 text-yellow-700', APROVADA: 'bg-green-100 text-green-700',
  REJEITADA: 'bg-red-100 text-red-600',
};

const papelLabels: Record<string, string> = {
  RESPONSAVEL: 'Responsavel', APROVADOR: 'Aprovador',
  CONSULTADO: 'Consultado', INFORMADO: 'Informado',
};

const categoriaLabels: Record<string, string> = {
  MAO_DE_OBRA: 'Mao de Obra', INFRAESTRUTURA: 'Infraestrutura',
  LICENCIAMENTO: 'Licenciamento', CONSULTORIA: 'Consultoria',
  TREINAMENTO: 'Treinamento', VIAGEM: 'Viagem',
  MATERIAL: 'Material', OUTRO: 'Outro',
};

const interacaoTipoCores: Record<string, string> = {
  COMENTARIO: 'bg-blue-100 text-blue-700', RESPOSTA: 'bg-green-100 text-green-700',
  ATUALIZACAO: 'bg-yellow-100 text-yellow-700', RESOLUCAO: 'bg-emerald-100 text-emerald-700',
};

/* ─── Badge helper ──────────────────────────────────────────── */

function Badge({ text, colors }: { text: string; colors: string }) {
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${colors}`}>
      {text.replace(/_/g, ' ')}
    </span>
  );
}

/* ─── Page Component ────────────────────────────────────────── */

export function RelatorioProjetoPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [dados, setDados] = useState<RelatorioProjetoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    dashboardService.getRelatorioProjeto(id)
      .then(setDados)
      .catch(() => setError('Erro ao carregar relatorio do projeto.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <>
        <Header title="Relatorio de Projeto" />
        <main className="p-6"><div className="text-center text-slate-500 py-12">Carregando relatorio...</div></main>
      </>
    );
  }

  if (error || !dados) {
    return (
      <>
        <Header title="Relatorio de Projeto" />
        <main className="p-6">
          <div className="text-center text-red-500 py-12">{error || 'Projeto nao encontrado.'}</div>
          <div className="text-center mt-4">
            <button onClick={() => navigate(-1)} className="text-sm text-capul-600 hover:underline">Voltar</button>
          </div>
        </main>
      </>
    );
  }

  const { projeto, pendencias, resumo } = dados;

  // Group atividades by fase
  const atividadesPorFase = new Map<string, typeof projeto.atividades>();
  projeto.atividades.forEach((a) => {
    const key = a.fase?.nome || 'Sem Fase';
    if (!atividadesPorFase.has(key)) atividadesPorFase.set(key, []);
    atividadesPorFase.get(key)!.push(a);
  });

  const isOverdue = (dataLimite: string | null) => {
    if (!dataLimite) return false;
    return new Date(dataLimite) < new Date();
  };

  const totalHorasApontamentos = projeto.apontamentos.reduce((s, a) => s + a.horas, 0);

  return (
    <>
      <Header title="Relatorio de Projeto" />
      <style>{`@media print { .no-print { display: none !important; } }`}</style>
      <main className="p-6 space-y-6">

        {/* ─── Header ───────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4 no-print">
            <button onClick={() => navigate(`/gestao-ti/projetos/${id}`)}
              className="flex items-center gap-1.5 text-sm text-capul-600 hover:text-capul-700 font-medium">
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
            <button onClick={() => window.print()}
              className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-800 font-medium">
              <Printer className="w-4 h-4" /> Imprimir
            </button>
          </div>
          <div className="flex items-start gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-slate-800">
              Projeto #{projeto.numero} — {projeto.nome}
            </h1>
            <Badge text={projeto.status} colors={statusCores[projeto.status] || 'bg-slate-100 text-slate-600'} />
            {projeto.tipoProjeto && (
              <Badge text={projeto.tipoProjeto.descricao} colors="bg-capul-100 text-capul-700" />
            )}
          </div>
          {projeto.descricao && (
            <p className="text-sm text-slate-500 mt-2">{projeto.descricao}</p>
          )}
          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 text-sm text-slate-600">
            <div><span className="font-medium text-slate-500">Responsavel:</span> {projeto.responsavel.nome}</div>
            <div><span className="font-medium text-slate-500">Inicio:</span> {fmtData(projeto.dataInicio)}</div>
            <div><span className="font-medium text-slate-500">Prev. Fim:</span> {fmtData(projeto.dataFimPrevista)}</div>
            <div><span className="font-medium text-slate-500">Fim Real:</span> {fmtData(projeto.dataFimReal)}</div>
            <div><span className="font-medium text-slate-500">Custo Previsto:</span> {projeto.custoPrevisto != null ? fmtCurrency(projeto.custoPrevisto) : '—'}</div>
            <div><span className="font-medium text-slate-500">Custo Realizado:</span> {projeto.custoRealizado != null ? fmtCurrency(projeto.custoRealizado) : '—'}</div>
          </div>
          {projeto.software && (
            <div className="mt-2 text-sm text-slate-500">
              <span className="font-medium">Software:</span> {projeto.software.nome}
            </div>
          )}
          {projeto.contrato && (
            <div className="mt-1 text-sm text-slate-500">
              <span className="font-medium">Contrato:</span> #{projeto.contrato.numero} — {projeto.contrato.titulo}
            </div>
          )}
        </div>

        {/* ─── KPIs ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <KpiCard label="Fases" value={`${resumo.fasesAprovadas}/${resumo.totalFases}`}
            sub="aprovadas" icon={Layers} color="text-blue-600" />
          <KpiCard label="Atividades" value={resumo.totalAtividades}
            sub={`${resumo.atividadesPendentes} pend. | ${resumo.atividadesEmAndamento} andamento | ${resumo.atividadesConcluidas} concl.`}
            icon={ListChecks} color="text-teal-600" />
          <KpiCard label="Horas" value={`${resumo.totalHoras}h`}
            sub={`${resumo.horasApontamentos}h apontamentos | ${fmtMin(resumo.minutosRegistrosTempo)} registros`}
            icon={Clock} color="text-purple-600" />
          <KpiCard label="Riscos" value={resumo.riscosAbertos}
            sub={`de ${resumo.totalRiscos}`}
            icon={Shield} color={resumo.riscosAbertos > 0 ? 'text-red-600' : 'text-green-600'} />
          <KpiCard label="Pendencias" value={resumo.pendenciasAbertas}
            sub={`de ${resumo.totalPendencias}`}
            icon={CircleAlert} color={resumo.pendenciasAbertas > 0 ? 'text-red-600' : 'text-green-600'} />
        </div>

        {/* ─── 1. Equipe ────────────────────────────────────── */}
        {(projeto.membros.length > 0 || projeto.usuariosChave.length > 0 || projeto.terceirizados.length > 0) && (
          <Section title="Equipe" icon={Users} iconColor="text-teal-500"
            count={`${projeto.membros.length} membros`}>
            <div className="p-4 space-y-4">
              {/* Membros RACI */}
              {projeto.membros.length > 0 && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                      <th className="pb-2 font-medium">Nome</th>
                      <th className="pb-2 font-medium">Papel</th>
                      <th className="pb-2 font-medium">Observacoes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {projeto.membros.map((m, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-2 text-slate-800">{m.usuario.nome}</td>
                        <td className="py-2">
                          <Badge text={papelLabels[m.papel] || m.papel} colors="bg-teal-100 text-teal-700" />
                        </td>
                        <td className="py-2 text-slate-500">{m.observacoes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {/* Usuarios-chave */}
              {projeto.usuariosChave.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Usuarios-chave</h4>
                  <div className="space-y-1">
                    {projeto.usuariosChave.map((u, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <span className="text-slate-800">{u.usuario.nome}</span>
                        <span className="text-slate-400">—</span>
                        <span className="text-slate-500">{u.funcao}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Terceirizados */}
              {projeto.terceirizados.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Terceirizados</h4>
                  <div className="space-y-1">
                    {projeto.terceirizados.map((t, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <span className="text-slate-800">{t.usuario.nome}</span>
                        <span className="text-slate-400">|</span>
                        <span className="text-slate-500">{t.empresa}</span>
                        <span className="text-slate-400">|</span>
                        <span className="text-slate-500">{t.funcao}</span>
                        {t.especialidade && (
                          <>
                            <span className="text-slate-400">|</span>
                            <span className="text-slate-500">{t.especialidade}</span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ─── 2. Fases ─────────────────────────────────────── */}
        {projeto.fases.length > 0 && (
          <Section title="Fases" icon={Layers} iconColor="text-blue-500"
            count={`${projeto.fases.length} fases`}>
            <div className="divide-y divide-slate-50">
              {projeto.fases.sort((a, b) => a.ordem - b.ordem).map((f) => (
                <div key={f.id} className="p-4 flex items-center gap-4 hover:bg-blue-50/30">
                  <span className="text-xs font-mono text-slate-400 w-6 text-center">{f.ordem}</span>
                  <span className="text-sm font-medium text-slate-800 flex-1">{f.nome}</span>
                  <Badge text={f.status} colors={faseStatusCores[f.status] || 'bg-slate-100 text-slate-600'} />
                  <div className="flex gap-3 text-xs text-slate-500">
                    <span>Inicio: {fmtData(f.dataInicio)}</span>
                    <span>Prev: {fmtData(f.dataFimPrevista)}</span>
                    <span>Fim: {fmtData(f.dataFimReal)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ─── 3. Atividades ────────────────────────────────── */}
        {projeto.atividades.length > 0 && (
          <Section title="Atividades" icon={ListChecks} iconColor="text-purple-500"
            count={`${projeto.atividades.length} atividades`}>
            <div className="p-4 space-y-4">
              {[...atividadesPorFase.entries()].map(([faseNome, atividades]) => (
                <div key={faseNome}>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2 border-b border-slate-100 pb-1">
                    {faseNome}
                  </h4>
                  <div className="space-y-2">
                    {atividades.map((a) => (
                      <div key={a.id} className="flex items-center gap-3 text-sm hover:bg-purple-50/30 rounded-lg p-2">
                        <span className="font-medium text-slate-800 flex-1">{a.titulo}</span>
                        <Badge text={a.status} colors={atividadeStatusCores[a.status] || 'bg-slate-100 text-slate-600'} />
                        <span className="text-xs text-slate-400">
                          {a.responsaveis.map((r) => r.usuario.nome).join(', ')}
                        </span>
                        <span className="text-xs font-mono text-slate-600 w-14 text-right">
                          {fmtMin(a.totalMinutosRegistros)}
                        </span>
                        {a.dataFimPrevista && (
                          <span className="text-xs text-slate-400">{fmtData(a.dataFimPrevista)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ─── 4. Horas Trabalhadas ─────────────────────────── */}
        {projeto.apontamentos.length > 0 && (
          <Section title="Horas Trabalhadas" icon={Clock} iconColor="text-indigo-500"
            count={`${projeto.apontamentos.length} apontamentos — ${totalHorasApontamentos}h`}>
            <div className="divide-y divide-slate-50">
              {projeto.apontamentos.map((a) => (
                <div key={a.id} className="p-4 flex items-center gap-4 hover:bg-indigo-50/30">
                  <span className="text-xs text-slate-400 w-20">{fmtData(a.data)}</span>
                  <span className="text-sm text-slate-800 flex-1">{a.descricao}</span>
                  {a.fase && <span className="text-xs text-slate-400">{a.fase.nome}</span>}
                  <span className="text-sm font-semibold text-slate-700 font-mono w-14 text-right">{a.horas}h</span>
                  <span className="text-xs text-slate-400">{a.usuario.nome}</span>
                </div>
              ))}
              <div className="p-4 flex items-center justify-end gap-2 bg-slate-50">
                <span className="text-sm font-medium text-slate-600">Total:</span>
                <span className="text-sm font-bold text-slate-800 font-mono">{totalHorasApontamentos}h</span>
              </div>
            </div>
          </Section>
        )}

        {/* ─── 5. Riscos ────────────────────────────────────── */}
        {projeto.riscos.length > 0 && (
          <Section title="Riscos" icon={Shield}
            iconColor={resumo.riscosAbertos > 0 ? 'text-red-500' : 'text-amber-500'}
            count={`${resumo.riscosAbertos} abertos de ${resumo.totalRiscos}`}>
            <div className="divide-y divide-slate-50">
              {projeto.riscos.map((r) => (
                <div key={r.id} className="p-4 space-y-2 hover:bg-red-50/20">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-medium text-slate-800 flex-1">{r.titulo}</span>
                    <Badge text={`Prob: ${r.probabilidade.replace(/_/g, ' ')}`}
                      colors={riscoProbaImpactoCores[r.probabilidade] || 'bg-slate-100 text-slate-600'} />
                    <Badge text={`Imp: ${r.impacto.replace(/_/g, ' ')}`}
                      colors={riscoProbaImpactoCores[r.impacto] || 'bg-slate-100 text-slate-600'} />
                    <Badge text={r.status} colors={riscoStatusCores[r.status] || 'bg-slate-100 text-slate-600'} />
                    {r.responsavel && <span className="text-xs text-slate-400">{r.responsavel.nome}</span>}
                  </div>
                  {r.descricao && <p className="text-xs text-slate-500">{r.descricao}</p>}
                  {r.planoMitigacao && (
                    <p className="text-xs text-slate-500 pl-3 border-l-2 border-amber-200">
                      <span className="font-medium text-slate-600">Mitigacao:</span> {r.planoMitigacao}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ─── 6. PENDENCIAS (seção destaque) ───────────────── */}
        {pendencias.length > 0 && (
          <Section title="PENDENCIAS" icon={CircleAlert} iconColor="text-red-600"
            count={`${resumo.pendenciasAbertas} abertas de ${resumo.totalPendencias}`}
            accent="border-red-500 border-slate-200">
            <div className="divide-y divide-slate-100">
              {pendencias.map((p) => (
                <div key={p.id} className="p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <span className="font-mono text-red-600 font-bold text-sm">#{p.numero}</span>
                    <span className="text-sm font-semibold text-slate-800 flex-1">{p.titulo}</span>
                    <Badge text={p.status} colors={pendenciaStatusCores[p.status] || 'bg-slate-100 text-slate-600'} />
                    <Badge text={p.prioridade} colors={pendenciaPrioridadeCores[p.prioridade] || 'bg-slate-100 text-slate-600'} />
                    <span className="text-xs text-slate-500">{p.responsavel.nome}</span>
                  </div>

                  {/* Data limite */}
                  {p.dataLimite && (
                    <div className={`text-xs font-medium ${isOverdue(p.dataLimite) && p.status !== 'CONCLUIDA' && p.status !== 'CANCELADA' ? 'text-red-600' : 'text-slate-500'}`}>
                      Data limite: {fmtData(p.dataLimite)}
                      {isOverdue(p.dataLimite) && p.status !== 'CONCLUIDA' && p.status !== 'CANCELADA' && (
                        <span className="ml-2 px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-semibold">ATRASADA</span>
                      )}
                    </div>
                  )}

                  {/* Descricao */}
                  {p.descricao && (
                    <p className="text-xs text-slate-600 pl-3 border-l-2 border-red-200 bg-red-50/30 py-1 rounded-r">
                      {p.descricao}
                    </p>
                  )}

                  {/* Fase */}
                  {p.fase && (
                    <div className="text-xs text-slate-500">
                      <span className="font-medium">Fase:</span> {p.fase.nome}
                    </div>
                  )}

                  {/* Atividades vinculadas */}
                  {p.atividades.length > 0 && (
                    <div>
                      <h5 className="text-[10px] font-semibold text-slate-500 uppercase mb-1">Atividades vinculadas</h5>
                      <div className="space-y-0.5 ml-3">
                        {p.atividades.map((a) => (
                          <div key={a.id} className="flex items-center gap-2 text-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                            <span className="text-slate-700">{a.titulo}</span>
                            <Badge text={a.status} colors={atividadeStatusCores[a.status] || 'bg-slate-100 text-slate-600'} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Interacoes */}
                  {p.interacoes.length > 0 && (
                    <div>
                      <h5 className="text-[10px] font-semibold text-slate-500 uppercase mb-1">Interacoes</h5>
                      <div className="space-y-1 ml-3">
                        {p.interacoes.map((int) => (
                          <div key={int.id} className="flex items-start gap-2 text-xs">
                            <Badge text={int.tipo} colors={interacaoTipoCores[int.tipo] || 'bg-slate-100 text-slate-600'} />
                            <span className="text-slate-600 flex-1">{int.descricao}</span>
                            <span className="text-slate-400 flex-shrink-0">{int.usuario.nome}</span>
                            <span className="text-slate-400 flex-shrink-0">{fmtDataHora(int.createdAt)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ─── 7. Financeiro ────────────────────────────────── */}
        {(projeto.custos.length > 0 || projeto.cotacoes.length > 0) && (
          <Section title="Financeiro" icon={DollarSign} iconColor="text-emerald-500"
            count={`${projeto.custos.length} custos | ${projeto.cotacoes.length} cotacoes`}>
            <div className="p-4 space-y-4">
              {/* Custos */}
              {projeto.custos.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Custos</h4>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                        <th className="pb-2 font-medium">Descricao</th>
                        <th className="pb-2 font-medium">Categoria</th>
                        <th className="pb-2 font-medium text-right">Previsto</th>
                        <th className="pb-2 font-medium text-right">Realizado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {projeto.custos.map((c) => (
                        <tr key={c.id} className="hover:bg-emerald-50/30">
                          <td className="py-2 text-slate-800">{c.descricao}</td>
                          <td className="py-2 text-slate-500">{categoriaLabels[c.categoria] || c.categoria}</td>
                          <td className="py-2 text-right text-slate-600 font-mono">{c.valorPrevisto != null ? fmtCurrency(c.valorPrevisto) : '—'}</td>
                          <td className="py-2 text-right text-slate-600 font-mono">{c.valorRealizado != null ? fmtCurrency(c.valorRealizado) : '—'}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 font-semibold">
                        <td className="py-2 text-slate-700" colSpan={2}>Total</td>
                        <td className="py-2 text-right text-slate-700 font-mono">{fmtCurrency(resumo.custoPrevistoTotal)}</td>
                        <td className="py-2 text-right text-slate-700 font-mono">{fmtCurrency(resumo.custoRealizadoTotal)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
              {/* Cotacoes */}
              {projeto.cotacoes.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Cotacoes</h4>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                        <th className="pb-2 font-medium">Fornecedor</th>
                        <th className="pb-2 font-medium">Descricao</th>
                        <th className="pb-2 font-medium text-right">Valor</th>
                        <th className="pb-2 font-medium">Status</th>
                        <th className="pb-2 font-medium">Validade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {projeto.cotacoes.map((c) => (
                        <tr key={c.id} className="hover:bg-emerald-50/30">
                          <td className="py-2 text-slate-800">{c.fornecedor}</td>
                          <td className="py-2 text-slate-500">{c.descricao || '—'}</td>
                          <td className="py-2 text-right text-slate-600 font-mono">{fmtCurrency(c.valor)}</td>
                          <td className="py-2">
                            <Badge text={c.status} colors={cotacaoStatusCores[c.status] || 'bg-slate-100 text-slate-600'} />
                          </td>
                          <td className="py-2 text-slate-500">{fmtData(c.validade)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ─── 8. Sub-projetos ──────────────────────────────── */}
        {projeto.subProjetos.length > 0 && (
          <Section title="Sub-projetos" icon={FolderKanban} iconColor="text-capul-500"
            count={`${projeto.subProjetos.length} sub-projetos`}>
            <div className="divide-y divide-slate-50">
              {projeto.subProjetos.map((sp) => (
                <div key={sp.id} className="p-4 flex items-center gap-3 hover:bg-slate-50">
                  <span className="font-mono text-capul-600 font-bold text-sm">#{sp.numero}</span>
                  <span className="text-sm text-slate-800 flex-1">{sp.nome}</span>
                  <Badge text={sp.status} colors={statusCores[sp.status] || 'bg-slate-100 text-slate-600'} />
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ─── 9. Anexos ────────────────────────────────────── */}
        {projeto.anexos.length > 0 && (
          <Section title="Anexos" icon={Paperclip} iconColor="text-slate-500"
            count={`${projeto.anexos.length} anexos`}>
            <div className="divide-y divide-slate-50">
              {projeto.anexos.map((a) => (
                <div key={a.id} className="p-4 flex items-center gap-4 hover:bg-slate-50">
                  <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="text-sm text-slate-800 flex-1">{a.titulo || a.nomeOriginal || 'Anexo'}</span>
                  {a.mimeType && <span className="text-xs text-slate-400">{a.mimeType}</span>}
                  <span className="text-xs text-slate-400">{fmtBytes(a.tamanhoBytes)}</span>
                  <span className="text-xs text-slate-400">{a.usuario.nome}</span>
                  <span className="text-xs text-slate-400">{fmtDataHora(a.createdAt)}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ─── Rodape ───────────────────────────────────────── */}
        <div className="text-center text-xs text-slate-400 py-4">
          Relatorio gerado em {new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </main>
    </>
  );
}
