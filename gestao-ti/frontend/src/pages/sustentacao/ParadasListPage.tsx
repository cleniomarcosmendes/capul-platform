import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { paradaService } from '../../services/parada.service';
import { softwareService } from '../../services/software.service';
import { Activity, Plus, AlertTriangle, Search, Download } from 'lucide-react';
import { exportService } from '../../services/export.service';
import type { RegistroParada, Software, MotivoParada, TipoParada, ImpactoParada, StatusParada } from '../../types';

const tipoLabel: Record<string, string> = {
  PARADA_PROGRAMADA: 'Programada',
  PARADA_NAO_PROGRAMADA: 'Nao Programada',
  MANUTENCAO_PREVENTIVA: 'Manut. Preventiva',
};

const impactoLabel: Record<string, string> = {
  TOTAL: 'Total',
  PARCIAL: 'Parcial',
};

const statusLabel: Record<string, string> = {
  EM_ANDAMENTO: 'Em Andamento',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada',
};

const statusCores: Record<string, string> = {
  EM_ANDAMENTO: 'bg-red-100 text-red-700',
  FINALIZADA: 'bg-green-100 text-green-700',
  CANCELADA: 'bg-slate-100 text-slate-600',
};

const impactoCores: Record<string, string> = {
  TOTAL: 'bg-red-100 text-red-700',
  PARCIAL: 'bg-amber-100 text-amber-700',
};

function formatDuracao(minutos: number | null): string {
  if (minutos == null) return '-';
  if (minutos < 1) return '< 1m';
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function ParadasListPage() {
  const { gestaoTiRole } = useAuth();
  const canManage = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');

  const [paradas, setParadas] = useState<RegistroParada[]>([]);
  const [softwares, setSoftwares] = useState<Software[]>([]);
  const [motivos, setMotivos] = useState<MotivoParada[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filtroSoftware, setFiltroSoftware] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroImpacto, setFiltroImpacto] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroMotivo, setFiltroMotivo] = useState('');

  useEffect(() => {
    softwareService.listar().then(setSoftwares).catch(() => {});
    paradaService.listarMotivos().then(setMotivos).catch(() => {});
  }, []);

  useEffect(() => {
    loadParadas();
  }, [filtroSoftware, filtroTipo, filtroImpacto, filtroStatus, filtroMotivo]);

  async function loadParadas() {
    setLoading(true);
    try {
      const data = await paradaService.listar({
        softwareId: filtroSoftware || undefined,
        tipo: (filtroTipo as TipoParada) || undefined,
        impacto: (filtroImpacto as ImpactoParada) || undefined,
        status: (filtroStatus as StatusParada) || undefined,
        motivoParadaId: filtroMotivo || undefined,
      });
      setParadas(data);
    } catch { /* empty */ }
    setLoading(false);
  }

  const filtered = search
    ? paradas.filter(
        (p) =>
          p.titulo.toLowerCase().includes(search.toLowerCase()) ||
          p.software.nome.toLowerCase().includes(search.toLowerCase()),
      )
    : paradas;

  const emAndamento = paradas.filter((p) => p.status === 'EM_ANDAMENTO').length;
  const finalizadas = paradas.filter((p) => p.status === 'FINALIZADA').length;
  const duracoes = paradas.filter((p) => p.duracaoMinutos).map((p) => p.duracaoMinutos!);
  const mttr = duracoes.length > 0 ? Math.round(duracoes.reduce((a, b) => a + b, 0) / duracoes.length) : 0;

  return (
    <>
      <Header title="Paradas" />
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-red-500" />
            <h3 className="text-lg font-semibold text-slate-800">Registro de Paradas</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportService.exportar('paradas')}
              className="flex items-center gap-2 bg-slate-100 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
            >
              <Download className="w-4 h-4" /> Exportar
            </button>
            {canManage && (
              <Link
                to="/gestao-ti/paradas/nova"
                className="flex items-center gap-2 bg-capul-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-capul-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nova Parada
              </Link>
            )}
          </div>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-2xl font-bold text-red-600">{emAndamento}</p>
            <p className="text-xs text-slate-500">Em Andamento</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-2xl font-bold text-green-600">{finalizadas}</p>
            <p className="text-xs text-slate-500">Finalizadas</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-2xl font-bold text-slate-800">{paradas.length}</p>
            <p className="text-xs text-slate-500">Total</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-2xl font-bold text-slate-800">{formatDuracao(mttr)}</p>
            <p className="text-xs text-slate-500">MTTR</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-wrap gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white w-56"
            />
          </div>
          <select
            value={filtroSoftware}
            onChange={(e) => setFiltroSoftware(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">Todos Softwares</option>
            {softwares.map((s) => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">Todos Tipos</option>
            {Object.entries(tipoLabel).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={filtroImpacto}
            onChange={(e) => setFiltroImpacto(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">Todos Impactos</option>
            {Object.entries(impactoLabel).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">Todos Status</option>
            {Object.entries(statusLabel).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={filtroMotivo}
            onChange={(e) => setFiltroMotivo(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">Todos Motivos</option>
            {motivos.map((m) => (
              <option key={m.id} value={m.id}>{m.nome}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="text-slate-500">Carregando...</p>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <Activity className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Nenhuma parada encontrada</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-4 py-3 font-medium text-slate-600">Titulo</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Software</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Modulo</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Motivo</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Tipo</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Impacto</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Status</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Inicio</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Fim</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Duracao</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Filiais</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((p) => (
                    <tr key={p.id} className={`hover:bg-slate-50 ${p.status === 'EM_ANDAMENTO' ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-3">
                        <Link
                          to={`/gestao-ti/paradas/${p.id}`}
                          className="text-capul-600 hover:underline font-medium"
                        >
                          {p.titulo}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{p.software.nome}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{p.softwareModulo?.nome || '-'}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{p.motivoParada?.nome || '-'}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{tipoLabel[p.tipo] || p.tipo}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${impactoCores[p.impacto] || ''}`}>
                          {impactoLabel[p.impacto] || p.impacto}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCores[p.status] || ''}`}>
                          {statusLabel[p.status] || p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {new Date(p.inicio).toLocaleDateString('pt-BR')}{' '}
                        {new Date(p.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {p.fim ? (
                          <>
                            {new Date(p.fim).toLocaleDateString('pt-BR')}{' '}
                            {new Date(p.fim).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </>
                        ) : (
                          <span className="flex items-center gap-1 text-red-500">
                            <AlertTriangle className="w-3 h-3" /> Em curso
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{formatDuracao(p.duracaoMinutos)}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{p._count.filiaisAfetadas}</td>
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
