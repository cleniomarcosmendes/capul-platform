import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { projetoService } from '../../services/projeto.service';
import { softwareService } from '../../services/software.service';
import { FolderKanban, Plus, Search, Download } from 'lucide-react';
import { exportService } from '../../services/export.service';
import type { Projeto, Software, TipoProjeto, ModoProjeto, StatusProjeto } from '../../types';

const tipoLabel: Record<string, string> = {
  DESENVOLVIMENTO_INTERNO: 'Desenv. Interno',
  IMPLANTACAO_TERCEIRO: 'Implantacao',
  INFRAESTRUTURA: 'Infraestrutura',
  OUTRO: 'Outro',
};

const modoLabel: Record<string, string> = {
  SIMPLES: 'Simples',
  COMPLETO: 'Completo',
};

const statusLabel: Record<string, string> = {
  PLANEJAMENTO: 'Planejamento',
  EM_ANDAMENTO: 'Em Andamento',
  PAUSADO: 'Pausado',
  CONCLUIDO: 'Concluido',
  CANCELADO: 'Cancelado',
};

const statusCores: Record<string, string> = {
  PLANEJAMENTO: 'bg-blue-100 text-blue-700',
  EM_ANDAMENTO: 'bg-yellow-100 text-yellow-700',
  PAUSADO: 'bg-orange-100 text-orange-700',
  CONCLUIDO: 'bg-green-100 text-green-700',
  CANCELADO: 'bg-slate-100 text-slate-600',
};

const modoCores: Record<string, string> = {
  SIMPLES: 'bg-slate-100 text-slate-600',
  COMPLETO: 'bg-capul-100 text-capul-700',
};

export function ProjetosListPage() {
  const { gestaoTiRole } = useAuth();
  const canManage = ['ADMIN', 'GESTOR_TI'].includes(gestaoTiRole || '');

  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [softwares, setSoftwares] = useState<Software[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<TipoProjeto | ''>('');
  const [filtroModo, setFiltroModo] = useState<ModoProjeto | ''>('');
  const [filtroStatus, setFiltroStatus] = useState<StatusProjeto | ''>('');
  const [filtroSoftware, setFiltroSoftware] = useState('');
  const [apenasRaiz, setApenasRaiz] = useState(true);

  useEffect(() => {
    softwareService.listar().then(setSoftwares).catch(() => {});
  }, []);

  useEffect(() => {
    loadData();
  }, [filtroTipo, filtroModo, filtroStatus, filtroSoftware, apenasRaiz]);

  async function loadData() {
    setLoading(true);
    try {
      const data = await projetoService.listar({
        tipo: filtroTipo || undefined,
        modo: filtroModo || undefined,
        status: filtroStatus || undefined,
        softwareId: filtroSoftware || undefined,
        search: search || undefined,
        apenasRaiz: apenasRaiz || undefined,
      });
      setProjetos(data);
    } catch { /* empty */ }
    setLoading(false);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    loadData();
  }

  const totalAtivos = projetos.filter((p) =>
    ['PLANEJAMENTO', 'EM_ANDAMENTO', 'PAUSADO'].includes(p.status),
  ).length;
  const emAndamento = projetos.filter((p) => p.status === 'EM_ANDAMENTO').length;
  const planejamento = projetos.filter((p) => p.status === 'PLANEJAMENTO').length;
  const concluidos = projetos.filter((p) => p.status === 'CONCLUIDO').length;

  return (
    <>
      <Header title="Projetos" />
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FolderKanban className="w-6 h-6 text-capul-500" />
            <h3 className="text-lg font-semibold text-slate-800">Projetos de T.I.</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportService.exportar('projetos')}
              className="flex items-center gap-2 bg-slate-100 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
            >
              <Download className="w-4 h-4" /> Exportar
            </button>
            {canManage && (
              <Link
                to="/gestao-ti/projetos/novo"
                className="flex items-center gap-2 bg-capul-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-capul-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Novo Projeto
              </Link>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <p className="text-2xl font-bold text-slate-800">{totalAtivos}</p>
            <p className="text-xs text-slate-500 mt-1">Ativos</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <p className="text-2xl font-bold text-yellow-600">{emAndamento}</p>
            <p className="text-xs text-slate-500 mt-1">Em Andamento</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <p className="text-2xl font-bold text-blue-600">{planejamento}</p>
            <p className="text-xs text-slate-500 mt-1">Planejamento</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <p className="text-2xl font-bold text-green-600">{concluidos}</p>
            <p className="text-xs text-slate-500 mt-1">Concluidos</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex flex-wrap gap-3 items-end">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm w-48"
              />
            </div>
            <button type="submit" className="bg-slate-100 text-slate-700 px-3 py-2 rounded-lg text-sm hover:bg-slate-200">
              Buscar
            </button>
          </form>
          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value as TipoProjeto | '')} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">Todos Tipos</option>
            {Object.entries(tipoLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={filtroModo} onChange={(e) => setFiltroModo(e.target.value as ModoProjeto | '')} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">Todos Modos</option>
            {Object.entries(modoLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value as StatusProjeto | '')} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">Todos Status</option>
            {Object.entries(statusLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={filtroSoftware} onChange={(e) => setFiltroSoftware(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">Todos Softwares</option>
            {softwares.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={apenasRaiz}
              onChange={(e) => setApenasRaiz(e.target.checked)}
              className="rounded"
            />
            Apenas raiz
          </label>
        </div>

        {loading ? (
          <p className="text-slate-500">Carregando...</p>
        ) : projetos.length === 0 ? (
          <p className="text-slate-500">Nenhum projeto encontrado</p>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-4 py-3 font-medium text-slate-600">#</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Nome</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Tipo</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Modo</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Status</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Software</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Responsavel</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Inicio</th>
                    <th className="px-4 py-3 font-medium text-slate-600 text-right">Sub</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {projetos.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-500">{p.numero}</td>
                      <td className="px-4 py-3">
                        <Link to={`/gestao-ti/projetos/${p.id}`} className="text-capul-600 hover:underline font-medium">
                          {p.nome}
                        </Link>
                        {p.nivel > 1 && (
                          <span className="ml-2 text-xs text-slate-400">N{p.nivel}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{tipoLabel[p.tipo] || p.tipo}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${modoCores[p.modo]}`}>
                          {modoLabel[p.modo]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCores[p.status]}`}>
                          {statusLabel[p.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{p.software?.nome || '-'}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{p.responsavel.nome}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {p.dataInicio ? new Date(p.dataInicio).toLocaleDateString('pt-BR') : '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 font-medium">
                        {p._count.subProjetos}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
