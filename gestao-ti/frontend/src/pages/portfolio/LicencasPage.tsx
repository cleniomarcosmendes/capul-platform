import { useEffect, useState } from 'react';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { licencaService } from '../../services/licenca.service';
import { softwareService } from '../../services/software.service';
import { KeyRound, AlertTriangle, Download } from 'lucide-react';
import { exportService } from '../../services/export.service';
import type { SoftwareLicenca, Software, StatusLicenca } from '../../types';
import { formatDateBR } from '../../utils/date';

const modeloLabel: Record<string, string> = {
  SUBSCRICAO: 'Subscricao',
  PERPETUA: 'Perpetua',
  POR_USUARIO: 'Por Usuario',
  POR_ESTACAO: 'Por Estacao',
  OEM: 'OEM',
  FREE_OPENSOURCE: 'Free/Open Source',
  SAAS: 'SaaS',
  OUTRO: 'Outro',
};

const statusLabel: Record<string, string> = {
  ATIVA: 'Ativa',
  INATIVA: 'Inativa',
  VENCIDA: 'Vencida',
};

const statusCores: Record<string, string> = {
  ATIVA: 'bg-green-100 text-green-700',
  INATIVA: 'bg-slate-100 text-slate-600',
  VENCIDA: 'bg-red-100 text-red-700',
};

export function LicencasPage() {
  const { gestaoTiRole } = useAuth();
  const isAdmin = gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR_TI';

  const [licencas, setLicencas] = useState<SoftwareLicenca[]>([]);
  const [softwares, setSoftwares] = useState<Software[]>([]);
  const [loading, setLoading] = useState(true);

  const [filtroStatus, setFiltroStatus] = useState<StatusLicenca | ''>('');
  const [filtroSoftware, setFiltroSoftware] = useState('');
  const [filtroVencendo, setFiltroVencendo] = useState('');

  useEffect(() => {
    softwareService.listar().then(setSoftwares).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    licencaService
      .listar({
        status: filtroStatus || undefined,
        softwareId: filtroSoftware || undefined,
        vencendoEm: filtroVencendo ? parseInt(filtroVencendo) : undefined,
      })
      .then(setLicencas)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filtroStatus, filtroSoftware, filtroVencendo]);

  function isVencendo(lic: SoftwareLicenca) {
    if (!lic.dataVencimento || lic.status !== 'ATIVA') return false;
    const diff = new Date(lic.dataVencimento).getTime() - Date.now();
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
  }

  async function handleRenovar(licId: string) {
    await licencaService.renovar(licId);
    setLoading(true);
    licencaService
      .listar({
        status: filtroStatus || undefined,
        softwareId: filtroSoftware || undefined,
        vencendoEm: filtroVencendo ? parseInt(filtroVencendo) : undefined,
      })
      .then(setLicencas)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  async function handleInativar(licId: string) {
    await licencaService.inativar(licId);
    setLoading(true);
    licencaService
      .listar({
        status: filtroStatus || undefined,
        softwareId: filtroSoftware || undefined,
        vencendoEm: filtroVencendo ? parseInt(filtroVencendo) : undefined,
      })
      .then(setLicencas)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  const custoTotal = licencas
    .filter((l) => l.status === 'ATIVA' && l.valorTotal != null)
    .reduce((sum, l) => sum + Number(l.valorTotal), 0);

  return (
    <>
      <Header title="Licencas" />
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <KeyRound className="w-6 h-6 text-capul-500" />
            <h3 className="text-lg font-semibold text-slate-800">Gestao de Licencas</h3>
          </div>
          <button
            onClick={() => exportService.exportar('licencas')}
            className="flex items-center gap-2 bg-slate-100 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
          >
            <Download className="w-4 h-4" /> Exportar
          </button>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-2xl font-bold text-slate-800">{licencas.filter((l) => l.status === 'ATIVA').length}</p>
            <p className="text-xs text-slate-500">Ativas</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-2xl font-bold text-amber-600">{licencas.filter(isVencendo).length}</p>
            <p className="text-xs text-slate-500">Vencendo em 30d</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-2xl font-bold text-red-600">{licencas.filter((l) => l.status === 'VENCIDA').length}</p>
            <p className="text-xs text-slate-500">Vencidas</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-2xl font-bold text-slate-800">
              R$ {custoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-slate-500">Custo Ativas</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-wrap gap-3">
          <select
            value={filtroStatus}
            onChange={(e) => { setFiltroStatus(e.target.value as StatusLicenca | ''); setFiltroVencendo(''); }}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">Todos os status</option>
            {Object.entries(statusLabel).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={filtroSoftware}
            onChange={(e) => setFiltroSoftware(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">Todos os softwares</option>
            {softwares.map((s) => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
          <select
            value={filtroVencendo}
            onChange={(e) => { setFiltroVencendo(e.target.value); setFiltroStatus(''); }}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">Vencimento</option>
            <option value="30">Vencendo em 30 dias</option>
            <option value="60">Vencendo em 60 dias</option>
            <option value="90">Vencendo em 90 dias</option>
          </select>
        </div>

        {loading ? (
          <p className="text-slate-500">Carregando...</p>
        ) : licencas.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <KeyRound className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Nenhuma licenca encontrada</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-4 py-3 font-medium text-slate-600">Software</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Modelo</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Qtd</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Usuarios</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Valor Total</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Fornecedor</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Inicio</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Vencimento</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Contrato</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Status</th>
                    {isAdmin && <th className="px-4 py-3 font-medium text-slate-600">Acoes</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {licencas.map((lic) => (
                    <tr key={lic.id} className={`hover:bg-slate-50 ${isVencendo(lic) ? 'bg-amber-50' : ''}`}>
                      <td className="px-4 py-3">
                        <a
                          href={`/gestao-ti/softwares/${lic.softwareId}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-capul-600 hover:underline font-medium"
                        >
                          {lic.software.nome}
                        </a>
                        {lic.software.fabricante && (
                          <p className="text-xs text-slate-400">{lic.software.fabricante}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {lic.modeloLicenca ? modeloLabel[lic.modeloLicenca] || lic.modeloLicenca : '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{lic.quantidade ?? '-'}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {lic.modeloLicenca && ['POR_USUARIO', 'SUBSCRICAO', 'SAAS'].includes(lic.modeloLicenca)
                          ? <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{lic._count?.usuarios ?? 0}/{lic.quantidade ?? '∞'}</span>
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {lic.valorTotal != null
                          ? `R$ ${Number(lic.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{lic.fornecedor || '-'}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {lic.dataInicio ? formatDateBR(lic.dataInicio) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {lic.dataVencimento ? (
                          <span className="flex items-center gap-1 text-sm">
                            {isVencendo(lic) && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                            {formatDateBR(lic.dataVencimento)}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {lic.contrato ? (
                          <a href={`/gestao-ti/contratos/${lic.contrato.id}`} target="_blank" rel="noopener noreferrer" className="text-capul-600 hover:underline text-xs">
                            #{lic.contrato.numero}
                          </a>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCores[lic.status] || ''}`}>
                          {statusLabel[lic.status] || lic.status}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {lic.status === 'ATIVA' && (
                              <>
                                <button
                                  onClick={() => handleRenovar(lic.id)}
                                  className="text-xs text-capul-600 hover:underline"
                                >
                                  Renovar
                                </button>
                                <button
                                  onClick={() => handleInativar(lic.id)}
                                  className="text-xs text-slate-500 hover:underline"
                                >
                                  Inativar
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
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
