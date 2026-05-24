import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { dashboardService, type PainelChamadosData } from '../../services/dashboard.service';
import {
  Flame, Inbox, Clock, Users,
  ChevronDown, ChevronRight, AlertCircle, ExternalLink,
} from 'lucide-react';
import { formatDateBR } from '../../utils/date';

/**
 * Painel de Gestão de Chamado — foco em SLA, fila e atribuídos.
 *
 * Visibilidade aplicada no backend (C2.9): solicitante OR colaborador
 * OR equipe-membro OR depto-workspace. ADMIN escapa.
 *
 * Filtro de equipe no topo. Card "Resumo por Equipe" (matriz comparativa)
 * só quando "Todas" — identifica gargalo em 1 olhada.
 */
export function PainelChamadosPage() {
  const [data, setData] = useState<PainelChamadosData | null>(null);
  const [loading, setLoading] = useState(true);
  const [equipeId, setEquipeId] = useState<string>('');
  const [expandido, setExpandido] = useState<Record<string, boolean>>({
    sla: true, // SLA crítico começa aberto (mais importante)
    atribuidos: false,
    aguardando: false,
  });

  useEffect(() => {
    setLoading(true);
    dashboardService.getPainelChamados(equipeId || undefined)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [equipeId]);

  function toggle(key: string) {
    setExpandido((s) => ({ ...s, [key]: !s[key] }));
  }

  return (
    <>
      <Header title="Painel de Gestão de Chamado" />
      <div className="p-4 md:p-6 space-y-4">
        {/* Filtro de equipe */}
        {data && data.equipesDoUser.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-slate-600 flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              Equipe:
            </span>
            <select
              value={equipeId}
              onChange={(e) => setEquipeId(e.target.value)}
              className="text-sm border border-slate-300 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-capul-600"
            >
              <option value="">Todas as minhas equipes</option>
              {data.equipesDoUser.map((eq) => (
                <option key={eq.id} value={eq.id}>{eq.sigla} — {eq.nome}</option>
              ))}
            </select>
            <p className="text-xs text-slate-400 ml-auto">
              Cards "Atribuídos a mim" e "Aguardando minha resposta" não são afetados pelo filtro
            </p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-slate-500">Carregando...</div>
        ) : !data ? (
          <div className="text-center py-12 text-slate-500">Erro ao carregar.</div>
        ) : (
          <div className="space-y-3">
            {/* Resumo por Equipe (matriz comparativa) — só quando "Todas" */}
            {!equipeId && data.resumoPorEquipe.length > 0 && (
              <MatrizPorEquipe
                linhas={data.resumoPorEquipe}
                onSelect={(id) => setEquipeId(id)}
              />
            )}

            {/* SLA Crítico */}
            <CardPainel
              icon={Flame}
              titulo="SLA Crítico"
              subtitulo="Vencidos ou vencem em 24h"
              total={data.resumo.slaCriticoTotal}
              cor={data.resumo.slaCriticoTotal > 0 ? 'red' : 'slate'}
              expandido={expandido.sla}
              onToggle={() => toggle('sla')}
            >
              <ListaChamados items={data.slaCritico} />
            </CardPainel>

            {/* Atribuídos a mim */}
            <CardPainel
              icon={Inbox}
              titulo="Atribuídos a mim"
              subtitulo="Sou o técnico responsável"
              total={data.resumo.atribuidosTotal}
              cor={data.resumo.atribuidosTotal > 0 ? 'blue' : 'slate'}
              expandido={expandido.atribuidos}
              onToggle={() => toggle('atribuidos')}
            >
              <ListaChamados items={data.atribuidosAMim} />
            </CardPainel>

            {/* Aguardando minha resposta */}
            <CardPainel
              icon={Clock}
              titulo="Aguardando minha resposta"
              subtitulo="Sou solicitante e o chamado está pendente comigo"
              total={data.resumo.aguardandoTotal}
              cor={data.resumo.aguardandoTotal > 0 ? 'amber' : 'slate'}
              expandido={expandido.aguardando}
              onToggle={() => toggle('aguardando')}
            >
              <ListaChamados items={data.aguardandoResposta} />
            </CardPainel>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Componentes auxiliares ────────────────────────────────────

interface MatrizLinha {
  equipe: { id: string; nome: string; sigla: string; cor: string | null };
  vencidos: number;
  hoje: number;
  prox24h: number;
  total: number;
}

function MatrizPorEquipe({ linhas, onSelect }: { linhas: MatrizLinha[]; onSelect: (id: string) => void }) {
  // Ordena: equipes com mais vencidos em cima
  const ordenado = [...linhas].sort((a, b) => b.vencidos - a.vencidos || b.total - a.total);
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/50 flex items-center gap-2">
        <Users className="w-4 h-4 text-slate-500" />
        <h2 className="text-sm font-semibold text-slate-700">Resumo por Equipe</h2>
        <span className="text-[11px] text-slate-400">— clique na linha pra filtrar</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/30">
            <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">Equipe</th>
            <th className="text-right px-3 py-2 text-xs font-medium text-red-600">Vencido</th>
            <th className="text-right px-3 py-2 text-xs font-medium text-amber-600">Hoje</th>
            <th className="text-right px-3 py-2 text-xs font-medium text-blue-600">24h</th>
            <th className="text-right px-4 py-2 text-xs font-medium text-slate-500">Total aberto</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {ordenado.map((l) => {
            const semaforo = l.vencidos > 5 ? 'bg-red-50' : l.vencidos > 0 ? 'bg-amber-50/50' : '';
            return (
              <tr
                key={l.equipe.id}
                onClick={() => onSelect(l.equipe.id)}
                className={`hover:bg-slate-50 cursor-pointer ${semaforo}`}
              >
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: l.equipe.cor || '#94a3b8' }}
                    />
                    <span className="text-sm font-medium text-slate-700">{l.equipe.sigla}</span>
                    <span className="text-xs text-slate-500 truncate">{l.equipe.nome}</span>
                  </div>
                </td>
                <td className="text-right px-3 py-2.5 text-sm font-mono">
                  <span className={l.vencidos > 0 ? 'text-red-700 font-bold' : 'text-slate-400'}>{l.vencidos}</span>
                </td>
                <td className="text-right px-3 py-2.5 text-sm font-mono">
                  <span className={l.hoje > 0 ? 'text-amber-700 font-semibold' : 'text-slate-400'}>{l.hoje}</span>
                </td>
                <td className="text-right px-3 py-2.5 text-sm font-mono">
                  <span className={l.prox24h > 0 ? 'text-blue-700' : 'text-slate-400'}>{l.prox24h}</span>
                </td>
                <td className="text-right px-4 py-2.5 text-sm font-mono text-slate-700">{l.total}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface CardPainelProps {
  icon: typeof Flame;
  titulo: string;
  subtitulo: string;
  total: number;
  cor: 'red' | 'amber' | 'blue' | 'slate';
  expandido: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function CardPainel({ icon: Icon, titulo, subtitulo, total, cor, expandido, onToggle, children }: CardPainelProps) {
  const cores: Record<string, { bg: string; text: string; border: string; iconBg: string }> = {
    red:    { bg: 'bg-red-50/40',    text: 'text-red-700',    border: 'border-red-200',    iconBg: 'bg-red-100' },
    amber:  { bg: 'bg-amber-50/40',  text: 'text-amber-700',  border: 'border-amber-200',  iconBg: 'bg-amber-100' },
    blue:   { bg: 'bg-blue-50/40',   text: 'text-blue-700',   border: 'border-blue-200',   iconBg: 'bg-blue-100' },
    slate:  { bg: 'bg-white',        text: 'text-slate-500',  border: 'border-slate-200',  iconBg: 'bg-slate-100' },
  };
  const c = cores[cor];
  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} overflow-hidden`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/50 transition-colors"
      >
        <div className={`p-2 rounded-lg ${c.iconBg}`}>
          <Icon className={`w-5 h-5 ${c.text}`} />
        </div>
        <div className="flex-1 text-left">
          <h2 className="text-sm font-semibold text-slate-800">{titulo}</h2>
          <p className="text-xs text-slate-500">{subtitulo}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-3xl font-bold ${total > 0 ? c.text : 'text-slate-300'}`}>{total}</span>
          {expandido ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
        </div>
      </button>
      {expandido && (
        <div className="border-t border-slate-200/60 bg-white">
          {children}
        </div>
      )}
    </div>
  );
}

interface ChamadoItem {
  id: string;
  numero: number;
  titulo: string;
  status: string;
  prioridade: string;
  dataLimiteSla: string | null;
  equipeAtual: { id: string; nome: string; sigla: string; cor: string | null } | null;
  solicitante: { id: string; nome: string; username: string } | null;
  tecnico: { id: string; nome: string; username: string } | null;
}

const prioridadeCores: Record<string, string> = {
  CRITICA: 'bg-red-100 text-red-700',
  ALTA: 'bg-orange-100 text-orange-700',
  MEDIA: 'bg-yellow-100 text-yellow-700',
  BAIXA: 'bg-green-100 text-green-700',
};

function ListaChamados({ items }: { items: ChamadoItem[] }) {
  if (items.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-sm text-slate-400">
        Nenhum chamado nesta categoria. 🎉
      </div>
    );
  }
  const agora = new Date();
  // Larguras fixas pra alinhar as 3 tabelas dos cards (todos com mesmas
  // colunas: #, Título, Equipe, Prioridade, SLA, Solicitante, Técnico, Ação).
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm table-fixed">
        <colgroup>
          <col className="w-[68px]" />       {/* # */}
          <col />                             {/* Título — flex */}
          <col className="w-[110px]" />      {/* Equipe */}
          <col className="w-[100px]" />      {/* Prioridade */}
          <col className="w-[120px]" />      {/* SLA */}
          <col className="w-[160px]" />      {/* Solicitante */}
          <col className="w-[160px]" />      {/* Técnico */}
          <col className="w-[50px]" />       {/* Ação */}
        </colgroup>
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
            <th className="text-left px-4 py-2 font-medium">#</th>
            <th className="text-left px-4 py-2 font-medium">Título</th>
            <th className="text-left px-4 py-2 font-medium">Equipe</th>
            <th className="text-center px-4 py-2 font-medium">Prioridade</th>
            <th className="text-left px-4 py-2 font-medium">SLA</th>
            <th className="text-left px-4 py-2 font-medium">Solicitante</th>
            <th className="text-left px-4 py-2 font-medium">Técnico</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.slice(0, 10).map((c) => {
            const slaVencido = c.dataLimiteSla && new Date(c.dataLimiteSla) < agora;
            return (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 text-slate-400 font-mono text-xs">#{c.numero}</td>
                <td className="px-4 py-2 text-slate-800 truncate" title={c.titulo}>{c.titulo}</td>
                <td className="px-4 py-2 text-xs">
                  {c.equipeAtual ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.equipeAtual.cor || '#94a3b8' }} />
                      {c.equipeAtual.sigla}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-2 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${prioridadeCores[c.prioridade] || ''}`}>{c.prioridade}</span>
                </td>
                <td className="px-4 py-2 text-xs">
                  {c.dataLimiteSla ? (
                    <span className={slaVencido ? 'text-red-600 font-semibold inline-flex items-center gap-1' : 'text-slate-500'}>
                      {slaVencido && <AlertCircle className="w-3 h-3 flex-shrink-0" />}
                      {formatDateBR(c.dataLimiteSla)}
                    </span>
                  ) : <span className="text-slate-400">—</span>}
                </td>
                <td className="px-4 py-2 text-xs text-slate-600 truncate" title={c.solicitante?.nome ?? ''}>{c.solicitante?.nome || '—'}</td>
                <td className="px-4 py-2 text-xs text-slate-600 truncate" title={c.tecnico?.nome ?? ''}>{c.tecnico?.nome || '—'}</td>
                <td className="px-4 py-2">
                  <Link
                    to={`/gestao-ti/chamados/${c.id}`}
                    className="text-capul-600 hover:text-capul-800"
                    title="Abrir chamado"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {items.length > 10 && (
        <div className="px-4 py-2 text-center text-xs text-slate-500 bg-slate-50/50">
          Mostrando 10 de {items.length}. Use os filtros da listagem de Chamados pra ver todos.
        </div>
      )}
    </div>
  );
}
