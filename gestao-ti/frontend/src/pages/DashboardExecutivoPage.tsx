import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../layouts/Header';
import { dashboardService } from '../services/dashboard.service';
import {
  PieChart, Ticket, FileText, Activity, FolderKanban, AppWindow, Server, BookMarked,
} from 'lucide-react';
import type { DashboardExecutivo, TipoAtivo } from '../types';

const tipoAtivoLabel: Record<TipoAtivo, string> = {
  SERVIDOR: 'Servidores', ESTACAO_TRABALHO: 'Estacoes', NOTEBOOK: 'Notebooks',
  IMPRESSORA: 'Impressoras', SWITCH: 'Switches', ROTEADOR: 'Roteadores',
  STORAGE: 'Storage', OUTRO: 'Outros',
};

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface KpiCardProps {
  label: string;
  value: string | number;
  color?: string;
  sub?: string;
}

function KpiCard({ label, value, color = 'text-slate-800', sub }: KpiCardProps) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export function DashboardExecutivoPage() {
  const [data, setData] = useState<DashboardExecutivo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardService.getExecutivo()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <><Header title="Dashboard Executivo" /><div className="p-6 text-center text-slate-500">Carregando...</div></>;
  if (!data) return <><Header title="Dashboard Executivo" /><div className="p-6 text-center text-slate-400">Erro ao carregar dados</div></>;

  return (
    <>
      <Header title="Dashboard Executivo" />
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <PieChart className="w-6 h-6 text-indigo-500" />
          <h3 className="text-lg font-semibold text-slate-800">Visao Consolidada</h3>
        </div>

        {/* 1. Suporte */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Ticket className="w-4 h-4 text-blue-500" />
              <h4 className="text-sm font-semibold text-slate-700">Suporte</h4>
            </div>
            <Link to="/gestao-ti/chamados" className="text-xs text-blue-600 hover:underline">Ver detalhes</Link>
          </div>
          <div className="grid grid-cols-7 gap-3">
            <KpiCard label="Abertos" value={data.chamados.abertos} color="text-blue-600" />
            <KpiCard label="Em Atendimento" value={data.chamados.emAtendimento} color="text-amber-600" />
            <KpiCard label="Pendentes" value={data.chamados.pendentes} color="text-orange-600" />
            <KpiCard label="Fechados/Mes" value={data.chamados.fechadosMes} color="text-green-600" />
            <KpiCard label="SLA Estourado" value={data.chamados.slaEstourado} color={data.chamados.slaEstourado > 0 ? 'text-red-600' : 'text-green-600'} />
            <KpiCard label="Tempo Medio" value={`${data.chamados.tempoMedioResolucaoHoras}h`} color="text-slate-700" sub="Resolucao (30d)" />
            <KpiCard label="SLA Compliance" value={`${data.chamados.slaCompliancePercent}%`} color={data.chamados.slaCompliancePercent >= 90 ? 'text-green-600' : 'text-red-600'} />
          </div>
        </section>

        {/* 2. Contratos */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-500" />
              <h4 className="text-sm font-semibold text-slate-700">Contratos</h4>
            </div>
            <Link to="/gestao-ti/contratos" className="text-xs text-indigo-600 hover:underline">Ver detalhes</Link>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <KpiCard label="Ativos" value={data.contratos.totalAtivos} color="text-indigo-600" />
            <KpiCard label="Valor Comprometido" value={formatCurrency(data.contratos.valorComprometido)} color="text-slate-700" />
            <KpiCard label="Vencendo 30d" value={data.contratos.vencendo30d} color={data.contratos.vencendo30d > 0 ? 'text-amber-600' : 'text-green-600'} />
            <KpiCard label="Parcelas Atrasadas" value={data.contratos.parcelasAtrasadas} color={data.contratos.parcelasAtrasadas > 0 ? 'text-red-600' : 'text-green-600'} />
          </div>
        </section>

        {/* 3. Sustentacao */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-rose-500" />
              <h4 className="text-sm font-semibold text-slate-700">Sustentacao</h4>
            </div>
            <Link to="/gestao-ti/disponibilidade" className="text-xs text-rose-600 hover:underline">Ver detalhes</Link>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <KpiCard label="Paradas Ativas" value={data.sustentacao.paradasEmAndamento} color={data.sustentacao.paradasEmAndamento > 0 ? 'text-red-600' : 'text-green-600'} />
            <KpiCard label="Paradas/Mes" value={data.sustentacao.totalParadasMes} color="text-slate-700" />
            <KpiCard label="MTTR" value={data.sustentacao.mttrFormatado || '—'} color="text-slate-700" sub="Mean Time to Recovery" />
          </div>
        </section>

        {/* 4. Projetos */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-capul-500" />
              <h4 className="text-sm font-semibold text-slate-700">Projetos</h4>
            </div>
            <Link to="/gestao-ti/projetos" className="text-xs text-capul-600 hover:underline">Ver detalhes</Link>
          </div>
          <div className="grid grid-cols-5 gap-3">
            <KpiCard label="Ativos" value={data.projetos.totalAtivos} color="text-capul-600" />
            <KpiCard label="Em Andamento" value={data.projetos.emAndamento} color="text-blue-600" />
            <KpiCard label="Custo Previsto" value={formatCurrency(data.projetos.custoPrevistoTotal)} color="text-slate-700" />
            <KpiCard label="Custo Realizado" value={formatCurrency(data.projetos.custoRealizadoTotal)} color="text-slate-700" />
            <KpiCard label="Riscos Abertos" value={data.projetos.riscosAbertos} color={data.projetos.riscosAbertos > 0 ? 'text-amber-600' : 'text-green-600'} />
          </div>
        </section>

        {/* 5. Portfolio */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AppWindow className="w-4 h-4 text-emerald-500" />
              <h4 className="text-sm font-semibold text-slate-700">Portfolio</h4>
            </div>
            <Link to="/gestao-ti/softwares" className="text-xs text-emerald-600 hover:underline">Ver detalhes</Link>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <KpiCard label="Softwares" value={data.portfolio.totalSoftwares} color="text-emerald-600" />
            <KpiCard label="Licencas Ativas" value={data.portfolio.licencasAtivas} color="text-green-600" />
            <KpiCard label="Vencendo 30d" value={data.portfolio.licencasVencendo30d} color={data.portfolio.licencasVencendo30d > 0 ? 'text-amber-600' : 'text-green-600'} />
            <KpiCard label="Custo Licencas" value={formatCurrency(data.portfolio.custoLicencas)} color="text-slate-700" />
          </div>
        </section>

        {/* 6. Infraestrutura (Ativos) */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-teal-500" />
              <h4 className="text-sm font-semibold text-slate-700">Infraestrutura</h4>
            </div>
            <Link to="/gestao-ti/ativos" className="text-xs text-teal-600 hover:underline">Ver detalhes</Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <KpiCard label="Total Ativos" value={data.ativos.totalAtivos} color="text-teal-600" />
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-2">Por Tipo</p>
              <div className="flex flex-wrap gap-2">
                {data.ativos.porTipo.map((t) => (
                  <span key={t.tipo} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs">
                    {tipoAtivoLabel[t.tipo] || t.tipo}: <strong>{t.total}</strong>
                  </span>
                ))}
                {data.ativos.porTipo.length === 0 && <span className="text-xs text-slate-400">Nenhum ativo</span>}
              </div>
            </div>
          </div>
        </section>

        {/* 7. Conhecimento */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BookMarked className="w-4 h-4 text-amber-500" />
              <h4 className="text-sm font-semibold text-slate-700">Conhecimento</h4>
            </div>
            <Link to="/gestao-ti/conhecimento" className="text-xs text-amber-600 hover:underline">Ver detalhes</Link>
          </div>
          <div className="grid grid-cols-1 gap-3 max-w-xs">
            <KpiCard label="Artigos Publicados" value={data.conhecimento.totalArtigosPublicados} color="text-amber-600" />
          </div>
        </section>
      </div>
    </>
  );
}
