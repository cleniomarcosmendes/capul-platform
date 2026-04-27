import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { softwareService } from '../../services/software.service';
import { equipeService } from '../../services/equipe.service';
import { Plus, Search, AppWindow, Download, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { exportService } from '../../services/export.service';
import { Paginator } from '../../components/Paginator';
import type { Software, EquipeTI, TipoSoftware, Criticidade, StatusSoftware } from '../../types';

const statusCores: Record<string, string> = {
  ATIVO: 'bg-green-100 text-green-700',
  EM_IMPLANTACAO: 'bg-blue-100 text-blue-700',
  DESCONTINUADO: 'bg-red-100 text-red-700',
  HOMOLOGACAO: 'bg-yellow-100 text-yellow-700',
};

const statusLabel: Record<string, string> = {
  ATIVO: 'Ativo',
  EM_IMPLANTACAO: 'Em Implantacao',
  DESCONTINUADO: 'Descontinuado',
  HOMOLOGACAO: 'Homologacao',
};

const tipoLabel: Record<string, string> = {
  ERP: 'ERP',
  CRM: 'CRM',
  SEGURANCA: 'Seguranca',
  COLABORACAO: 'Colaboracao',
  INFRAESTRUTURA: 'Infraestrutura',
  OPERACIONAL: 'Operacional',
  OUTROS: 'Outros',
};

const criticidadeLabel: Record<string, string> = {
  CRITICO: 'Critico',
  ALTO: 'Alto',
  MEDIO: 'Medio',
  BAIXO: 'Baixo',
};

const criticidadeCores: Record<string, string> = {
  CRITICO: 'bg-red-100 text-red-700',
  ALTO: 'bg-orange-100 text-orange-700',
  MEDIO: 'bg-yellow-100 text-yellow-700',
  BAIXO: 'bg-green-100 text-green-700',
};

export function SoftwaresListPage() {
  const { gestaoTiRole } = useAuth();
  const isAdmin = gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR_TI';

  const [softwares, setSoftwares] = useState<Software[]>([]);
  // Paginação 23/04/2026
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [totalSoftwares, setTotalSoftwares] = useState<number>(0);
  const [equipes, setEquipes] = useState<EquipeTI[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');

  const [filtroTipo, setFiltroTipo] = useState<TipoSoftware | ''>('');
  const [filtroCriticidade, setFiltroCriticidade] = useState<Criticidade | ''>('');
  const [filtroStatus, setFiltroStatus] = useState<StatusSoftware | ''>('');
  const [filtroEquipe, setFiltroEquipe] = useState('');

  type SortKey = 'nome' | 'tipo' | 'criticidade' | 'status';
  type SortDir = 'asc' | 'desc';
  const [sortKey, setSortKey] = useState<SortKey>('nome');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }
  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-slate-300" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-capul-600" /> : <ArrowDown className="w-3 h-3 text-capul-600" />;
  }

  useEffect(() => {
    equipeService.listar('ATIVO').then(setEquipes).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    softwareService
      .listarPaginado({
        tipo: filtroTipo || undefined,
        criticidade: filtroCriticidade || undefined,
        status: filtroStatus || undefined,
        equipeId: filtroEquipe || undefined,
        page,
        pageSize,
      })
      .then((res) => {
        setSoftwares(res.items);
        setTotalSoftwares(res.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filtroTipo, filtroCriticidade, filtroStatus, filtroEquipe, page, pageSize]);

  useEffect(() => { setPage(1); }, [filtroTipo, filtroCriticidade, filtroStatus, filtroEquipe, pageSize]);

  const filtered = useMemo(() => {
    if (!busca) return softwares;
    const s = busca.toLowerCase();
    return softwares.filter((sw) => sw.nome.toLowerCase().includes(s) || sw.fabricante?.toLowerCase().includes(s));
  }, [softwares, busca]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va: string, vb: string;
      switch (sortKey) {
        case 'nome': va = a.nome.toLowerCase(); vb = b.nome.toLowerCase(); break;
        case 'tipo': va = a.tipo || ''; vb = b.tipo || ''; break;
        case 'criticidade': va = a.criticidade || ''; vb = b.criticidade || ''; break;
        case 'status': va = a.status; vb = b.status; break;
        default: va = ''; vb = '';
      }
      const cmp = va.localeCompare(vb);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  return (
    <>
      <Header title="Softwares" />
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <AppWindow className="w-6 h-6 text-capul-500" />
            <h3 className="text-lg font-semibold text-slate-800">Portfolio de Aplicacoes</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportService.exportar('softwares')}
              className="flex items-center gap-2 bg-slate-100 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
            >
              <Download className="w-4 h-4" /> Exportar
            </button>
            {isAdmin && (
              <Link
                to="/gestao-ti/softwares/novo"
                className="flex items-center gap-2 bg-capul-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-capul-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Novo Software
              </Link>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 mb-4">
          <div className="p-4 flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome ou fabricante..."
                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value as TipoSoftware | '')}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">Todos os tipos</option>
              {Object.entries(tipoLabel).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select
              value={filtroCriticidade}
              onChange={(e) => setFiltroCriticidade(e.target.value as Criticidade | '')}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">Criticidade</option>
              {Object.entries(criticidadeLabel).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value as StatusSoftware | '')}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">Status</option>
              {Object.entries(statusLabel).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select
              value={filtroEquipe}
              onChange={(e) => setFiltroEquipe(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">Equipe</option>
              {equipes.map((e) => (
                <option key={e.id} value={e.id}>{e.sigla} - {e.nome}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <p className="text-slate-500">Carregando...</p>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <AppWindow className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Nenhum software encontrado</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    <th className="px-4 py-3"><button onClick={() => toggleSort('nome')} className="flex items-center gap-1 hover:text-slate-700">Nome <SortIcon col="nome" /></button></th>
                    <th className="px-4 py-3"><button onClick={() => toggleSort('tipo')} className="flex items-center gap-1 hover:text-slate-700">Tipo <SortIcon col="tipo" /></button></th>
                    <th className="px-4 py-3"><button onClick={() => toggleSort('criticidade')} className="flex items-center gap-1 hover:text-slate-700">Criticidade <SortIcon col="criticidade" /></button></th>
                    <th className="px-4 py-3">Equipe</th>
                    <th className="px-4 py-3">Versao</th>
                    <th className="px-4 py-3"><button onClick={() => toggleSort('status')} className="flex items-center gap-1 hover:text-slate-700">Status <SortIcon col="status" /></button></th>
                    <th className="px-4 py-3 text-center">Modulos</th>
                    <th className="px-4 py-3 text-center">Licencas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sorted.map((sw) => (
                    <tr key={sw.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <Link to={`/gestao-ti/softwares/${sw.id}`} className="text-capul-600 hover:underline font-medium">
                          {sw.nome}
                        </Link>
                        {sw.fabricante && (
                          <p className="text-xs text-slate-400">{sw.fabricante}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {sw.tipo ? tipoLabel[sw.tipo] || sw.tipo : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {sw.criticidade ? (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${criticidadeCores[sw.criticidade] || ''}`}>
                            {criticidadeLabel[sw.criticidade] || sw.criticidade}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {sw.equipeResponsavel ? (
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: sw.equipeResponsavel.cor || '#006838' }} />
                            {sw.equipeResponsavel.sigla}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{sw.versaoAtual || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCores[sw.status] || ''}`}>
                          {statusLabel[sw.status] || sw.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600">{sw._count.modulos}</td>
                      <td className="px-4 py-3 text-center text-slate-600">{sw._count.licencas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {!loading && (
          <Paginator
            total={totalSoftwares}
            shownCount={softwares.length}
            page={page}
            setPage={setPage}
            pageSize={pageSize}
            setPageSize={setPageSize}
            labelSingular="software"
            labelPlural="softwares"
          />
        )}
      </div>
    </>
  );
}
