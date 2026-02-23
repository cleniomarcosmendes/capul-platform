import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { contratoService } from '../../services/contrato.service';
import { FileText, Plus, Search, AlertTriangle, Download } from 'lucide-react';
import { exportService } from '../../services/export.service';
import type { Contrato, TipoContrato, StatusContrato } from '../../types';

const statusCores: Record<string, string> = {
  RASCUNHO: 'bg-slate-100 text-slate-700',
  ATIVO: 'bg-green-100 text-green-700',
  SUSPENSO: 'bg-yellow-100 text-yellow-700',
  VENCIDO: 'bg-red-100 text-red-700',
  RENOVADO: 'bg-blue-100 text-blue-700',
  CANCELADO: 'bg-slate-200 text-slate-500',
};

const tipoLabels: Record<string, string> = {
  LICENCIAMENTO: 'Licenciamento',
  MANUTENCAO: 'Manutencao',
  SUPORTE: 'Suporte',
  CONSULTORIA: 'Consultoria',
  DESENVOLVIMENTO: 'Desenvolvimento',
  CLOUD_SAAS: 'Cloud/SaaS',
  OUTSOURCING: 'Outsourcing',
  OUTRO: 'Outro',
};

const statusLabels: Record<string, string> = {
  RASCUNHO: 'Rascunho',
  ATIVO: 'Ativo',
  SUSPENSO: 'Suspenso',
  VENCIDO: 'Vencido',
  RENOVADO: 'Renovado',
  CANCELADO: 'Cancelado',
};

export function ContratosListPage() {
  const { gestaoTiRole } = useAuth();
  const canManage = ['ADMIN', 'GESTOR_TI'].includes(gestaoTiRole || '');

  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterVencendo, setFilterVencendo] = useState('');

  useEffect(() => {
    loadContratos();
  }, [filterTipo, filterStatus, filterVencendo]);

  async function loadContratos() {
    setLoading(true);
    try {
      const data = await contratoService.listar({
        tipo: (filterTipo as TipoContrato) || undefined,
        status: (filterStatus as StatusContrato) || undefined,
        vencendoEm: filterVencendo ? parseInt(filterVencendo, 10) : undefined,
      });
      setContratos(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  const filtered = contratos.filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      c.titulo.toLowerCase().includes(s) ||
      c.fornecedor.toLowerCase().includes(s) ||
      String(c.numero).includes(s)
    );
  });

  const totalAtivos = contratos.filter((c) => c.status === 'ATIVO').length;
  const valorTotal = contratos
    .filter((c) => ['ATIVO', 'SUSPENSO'].includes(c.status))
    .reduce((s, c) => s + Number(c.valorTotal), 0);

  return (
    <>
      <Header title="Contratos" />
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <p className="text-2xl font-bold text-slate-800">{totalAtivos}</p>
              <p className="text-xs text-slate-500">Ativos</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <p className="text-2xl font-bold text-slate-800">
                R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-500">Valor Comprometido</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportService.exportar('contratos')}
              className="flex items-center gap-2 bg-slate-100 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
            >
              <Download className="w-4 h-4" /> Exportar
            </button>
            {canManage && (
              <Link
                to="/gestao-ti/contratos/novo"
                className="flex items-center gap-2 bg-capul-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-capul-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Novo Contrato
              </Link>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por titulo, fornecedor, numero..."
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">Todos os Tipos</option>
            {Object.entries(tipoLabels).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">Todos os Status</option>
            {Object.entries(statusLabels).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={filterVencendo}
            onChange={(e) => setFilterVencendo(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">Vencimento</option>
            <option value="30">Vencendo em 30 dias</option>
            <option value="60">Vencendo em 60 dias</option>
            <option value="90">Vencendo em 90 dias</option>
          </select>
        </div>

        {loading ? (
          <p className="text-slate-500">Carregando contratos...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum contrato encontrado</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">#</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Titulo</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Fornecedor</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Valor</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Vigencia</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Software</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">Parcelas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => {
                  const diasVencimento = Math.ceil((new Date(c.dataFim).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  const vencendoEm30 = c.status === 'ATIVO' && diasVencimento <= 30 && diasVencimento >= 0;

                  return (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-500">{c.numero}</td>
                      <td className="px-4 py-3">
                        <Link to={`/gestao-ti/contratos/${c.id}`} className="text-capul-600 hover:underline font-medium">
                          {c.titulo}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{tipoLabels[c.tipo] || c.tipo}</td>
                      <td className="px-4 py-3 text-slate-600">{c.fornecedor}</td>
                      <td className="px-4 py-3 text-right text-slate-700 font-medium">
                        R$ {Number(c.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <div className="flex items-center gap-1">
                          {new Date(c.dataInicio).toLocaleDateString('pt-BR')} - {new Date(c.dataFim).toLocaleDateString('pt-BR')}
                          {vencendoEm30 && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{c.software?.nome || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusCores[c.status] || ''}`}>
                          {statusLabels[c.status] || c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-500">{c._count.parcelas}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
