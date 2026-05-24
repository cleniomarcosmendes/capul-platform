import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { dashboardService, type PainelProjetosData } from '../../services/dashboard.service';
import {
  ListChecks, Flag, FolderClock, Target,
  ChevronDown, ChevronRight, AlertCircle, ExternalLink,
} from 'lucide-react';
import { formatDateBR } from '../../utils/date';

/**
 * Painel de Gestão de Projeto — foco em atividades, pendências e prazos.
 *
 * Visibilidade aplicada no backend (C2.10):
 * - ADMIN escapa
 * - USUARIO_CHAVE/TERCEIRIZADO: só projetos vinculados (usuariosChave)
 * - STAFF: depto-dono OR responsável OR membro OR usuariosChave
 *
 * Substitui "Minhas Pendências" — cobre o mesmo escopo e adiciona
 * projetos atrasados + marcos próximos.
 */
export function PainelProjetosPage() {
  const [data, setData] = useState<PainelProjetosData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState<Record<string, boolean>>({
    atividades: true,
    pendencias: false,
    projetos: false,
    marcos: false,
  });

  useEffect(() => {
    dashboardService.getPainelProjetos()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function toggle(key: string) {
    setExpandido((s) => ({ ...s, [key]: !s[key] }));
  }

  return (
    <>
      <Header title="Painel de Gestão de Projeto" />
      <div className="p-4 md:p-6 space-y-4">
        {loading ? (
          <div className="text-center py-12 text-slate-500">Carregando...</div>
        ) : !data ? (
          <div className="text-center py-12 text-slate-500">Erro ao carregar.</div>
        ) : (
          <div className="space-y-3">
            {/* Atividades */}
            <CardPainel
              icon={ListChecks}
              titulo="Atividades de Projeto"
              subtitulo={`${data.resumo.atividadesVencidas} vencidas · ${data.resumo.atividadesHoje} vencem hoje · vence em até 7 dias`}
              total={data.resumo.atividadesTotal}
              urgentes={data.resumo.atividadesVencidas}
              expandido={expandido.atividades}
              onToggle={() => toggle('atividades')}
            >
              <ListaAtividades items={data.atividades} />
            </CardPainel>

            {/* Pendências */}
            <CardPainel
              icon={Flag}
              titulo="Pendências de Projeto"
              subtitulo={`${data.resumo.pendenciasVencidas} vencidas · ${data.resumo.pendenciasUrgentes} urgentes/altas abertas`}
              total={data.resumo.pendenciasTotal}
              urgentes={data.resumo.pendenciasVencidas + data.resumo.pendenciasUrgentes}
              expandido={expandido.pendencias}
              onToggle={() => toggle('pendencias')}
            >
              <ListaPendencias items={data.pendencias} />
            </CardPainel>

            {/* Projetos Atrasados */}
            <CardPainel
              icon={FolderClock}
              titulo="Projetos Atrasados"
              subtitulo="dataFim já passou e status ≠ Concluído/Cancelado"
              total={data.resumo.projetosAtrasadosTotal}
              urgentes={data.resumo.projetosAtrasadosTotal}
              expandido={expandido.projetos}
              onToggle={() => toggle('projetos')}
            >
              <ListaProjetos items={data.projetosAtrasados} />
            </CardPainel>

            {/* Marcos Próximos */}
            <CardPainel
              icon={Target}
              titulo="Marcos Próximos"
              subtitulo="Fases com data fim prevista nos próximos 30 dias"
              total={data.resumo.marcosProximosTotal}
              urgentes={0}
              expandido={expandido.marcos}
              onToggle={() => toggle('marcos')}
            >
              <ListaMarcos items={data.marcosProximos} />
            </CardPainel>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Card colapsável ───────────────────────────────────────────────

interface CardPainelProps {
  icon: typeof ListChecks;
  titulo: string;
  subtitulo: string;
  total: number;
  urgentes: number;
  expandido: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function CardPainel({ icon: Icon, titulo, subtitulo, total, urgentes, expandido, onToggle, children }: CardPainelProps) {
  // Semáforo pela quantidade de urgentes
  const cor = urgentes > 5 ? 'red' : urgentes > 0 ? 'amber' : total > 0 ? 'blue' : 'slate';
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

// ─── Listas ────────────────────────────────────────────────────────

const statusAtivCores: Record<string, string> = {
  PENDENTE: 'bg-yellow-100 text-yellow-700',
  EM_ANDAMENTO: 'bg-blue-100 text-blue-700',
};
const statusPendCores: Record<string, string> = {
  ABERTA: 'bg-blue-100 text-blue-700',
  EM_ANDAMENTO: 'bg-yellow-100 text-yellow-700',
  AGUARDANDO_VALIDACAO: 'bg-orange-100 text-orange-700',
};
const prioridadeCores: Record<string, string> = {
  BAIXA: 'bg-green-100 text-green-700',
  MEDIA: 'bg-yellow-100 text-yellow-700',
  ALTA: 'bg-orange-100 text-orange-700',
  URGENTE: 'bg-red-100 text-red-700',
};
const statusProjCores: Record<string, string> = {
  PLANEJAMENTO: 'bg-slate-100 text-slate-700',
  EM_ANDAMENTO: 'bg-blue-100 text-blue-700',
  EM_HOMOLOGACAO: 'bg-purple-100 text-purple-700',
  LIBERADO_PARA_PRODUCAO: 'bg-emerald-100 text-emerald-700',
  PAUSADO: 'bg-amber-100 text-amber-700',
};

function ListaAtividades({ items }: { items: PainelProjetosData['atividades'] }) {
  if (items.length === 0) {
    return <div className="px-4 py-6 text-center text-sm text-slate-400">Nenhuma atividade pendente. 🎉</div>;
  }
  const agora = new Date();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
            <th className="text-left px-4 py-2 font-medium">Atividade</th>
            <th className="text-left px-4 py-2 font-medium">Projeto</th>
            <th className="text-left px-4 py-2 font-medium">Fase</th>
            <th className="text-left px-4 py-2 font-medium">Prazo</th>
            <th className="text-center px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.slice(0, 10).map((a) => {
            const vencida = a.dataFimPrevista && new Date(a.dataFimPrevista) < agora;
            return (
              <tr key={a.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 text-slate-800 max-w-[260px] truncate">{a.titulo}</td>
                <td className="px-4 py-2 text-slate-600 text-xs">
                  <span className="font-mono text-slate-400">P#{a.projeto.numero}</span> {a.projeto.nome}
                </td>
                <td className="px-4 py-2 text-slate-500 text-xs">{a.fase?.nome || '—'}</td>
                <td className="px-4 py-2 text-xs">
                  {a.dataFimPrevista ? (
                    <span className={vencida ? 'text-red-600 font-semibold inline-flex items-center gap-1' : 'text-slate-500'}>
                      {vencida && <AlertCircle className="w-3 h-3" />}
                      {formatDateBR(a.dataFimPrevista)}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-2 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusAtivCores[a.status] || ''}`}>{a.status}</span>
                </td>
                <td className="px-4 py-2">
                  <Link to={`/gestao-ti/projetos/${a.projeto.id}?tab=atividades`} className="text-capul-600 hover:text-capul-800" title="Abrir projeto">
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Rodape total={items.length} />
    </div>
  );
}

function ListaPendencias({ items }: { items: PainelProjetosData['pendencias'] }) {
  if (items.length === 0) {
    return <div className="px-4 py-6 text-center text-sm text-slate-400">Nenhuma pendência aberta. 🎉</div>;
  }
  const agora = new Date();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
            <th className="text-left px-4 py-2 font-medium">#</th>
            <th className="text-left px-4 py-2 font-medium">Título</th>
            <th className="text-left px-4 py-2 font-medium">Projeto</th>
            <th className="text-center px-4 py-2 font-medium">Prioridade</th>
            <th className="text-left px-4 py-2 font-medium">Prazo</th>
            <th className="text-center px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.slice(0, 10).map((p) => {
            const vencida = p.dataLimite && new Date(p.dataLimite) < agora;
            return (
              <tr key={p.id} className={`hover:bg-slate-50 ${vencida ? 'bg-red-50/20' : ''}`}>
                <td className="px-4 py-2 text-slate-400 font-mono text-xs">#{p.numero}</td>
                <td className="px-4 py-2 text-slate-800 max-w-[220px] truncate">{p.titulo}</td>
                <td className="px-4 py-2 text-slate-600 text-xs">
                  <span className="font-mono text-slate-400">P#{p.projeto.numero}</span> {p.projeto.nome}
                </td>
                <td className="px-4 py-2 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${prioridadeCores[p.prioridade] || ''}`}>{p.prioridade}</span>
                </td>
                <td className="px-4 py-2 text-xs">
                  {p.dataLimite ? (
                    <span className={vencida ? 'text-red-600 font-bold inline-flex items-center gap-1' : 'text-slate-500'}>
                      {vencida && <AlertCircle className="w-3 h-3" />}
                      {formatDateBR(p.dataLimite)}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-2 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusPendCores[p.status] || ''}`}>{p.status}</span>
                </td>
                <td className="px-4 py-2">
                  <Link to={`/gestao-ti/projetos/${p.projeto.id}?tab=pendencias`} className="text-capul-600 hover:text-capul-800" title="Abrir projeto">
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Rodape total={items.length} />
    </div>
  );
}

function ListaProjetos({ items }: { items: PainelProjetosData['projetosAtrasados'] }) {
  if (items.length === 0) {
    return <div className="px-4 py-6 text-center text-sm text-slate-400">Nenhum projeto atrasado. 🎉</div>;
  }
  const agora = new Date();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
            <th className="text-left px-4 py-2 font-medium">#</th>
            <th className="text-left px-4 py-2 font-medium">Projeto</th>
            <th className="text-left px-4 py-2 font-medium">Depto</th>
            <th className="text-left px-4 py-2 font-medium">Responsável</th>
            <th className="text-left px-4 py-2 font-medium">Atraso</th>
            <th className="text-center px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.slice(0, 10).map((p) => {
            const dias = p.dataFimPrevista
              ? Math.floor((agora.getTime() - new Date(p.dataFimPrevista).getTime()) / (24 * 3600 * 1000))
              : 0;
            return (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 text-slate-400 font-mono text-xs">P#{p.numero}</td>
                <td className="px-4 py-2 text-slate-800 max-w-[260px] truncate">{p.nome}</td>
                <td className="px-4 py-2 text-xs text-slate-500">{p.departamento?.nome || '—'}</td>
                <td className="px-4 py-2 text-xs text-slate-600">{p.responsavel?.nome || '—'}</td>
                <td className="px-4 py-2 text-xs">
                  <span className="text-red-600 font-semibold">
                    {dias}d
                  </span>
                  <span className="text-slate-400 ml-1">
                    ({p.dataFimPrevista ? formatDateBR(p.dataFimPrevista) : '—'})
                  </span>
                </td>
                <td className="px-4 py-2 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusProjCores[p.status] || 'bg-slate-100 text-slate-700'}`}>{p.status}</span>
                </td>
                <td className="px-4 py-2">
                  <Link to={`/gestao-ti/projetos/${p.id}`} className="text-capul-600 hover:text-capul-800" title="Abrir projeto">
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Rodape total={items.length} />
    </div>
  );
}

function ListaMarcos({ items }: { items: PainelProjetosData['marcosProximos'] }) {
  if (items.length === 0) {
    return <div className="px-4 py-6 text-center text-sm text-slate-400">Nenhum marco nos próximos 30 dias.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
            <th className="text-left px-4 py-2 font-medium">Fase</th>
            <th className="text-left px-4 py-2 font-medium">Projeto</th>
            <th className="text-left px-4 py-2 font-medium">Prevista</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.slice(0, 10).map((m) => (
            <tr key={m.id} className="hover:bg-slate-50">
              <td className="px-4 py-2 text-slate-800">{m.nome}</td>
              <td className="px-4 py-2 text-slate-600 text-xs">
                <span className="font-mono text-slate-400">P#{m.projeto.numero}</span> {m.projeto.nome}
              </td>
              <td className="px-4 py-2 text-xs text-slate-500">
                {m.dataFimPrevista ? formatDateBR(m.dataFimPrevista) : '—'}
              </td>
              <td className="px-4 py-2">
                <Link to={`/gestao-ti/projetos/${m.projeto.id}?tab=fases`} className="text-capul-600 hover:text-capul-800" title="Abrir projeto">
                  <ExternalLink className="w-4 h-4" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Rodape total={items.length} />
    </div>
  );
}

function Rodape({ total }: { total: number }) {
  if (total <= 10) return null;
  return (
    <div className="px-4 py-2 text-center text-xs text-slate-500 bg-slate-50/50">
      Mostrando 10 de {total}.
    </div>
  );
}
