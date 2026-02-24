import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { ativoService } from '../../services/ativo.service';
import { softwareService } from '../../services/software.service';
import { ArrowLeft, Server, Edit, Trash2, Plus, X, Cpu, HardDrive, Monitor, Wifi } from 'lucide-react';
import type { Ativo, AtivoSoftwareItem, StatusAtivo, TipoAtivo, Software } from '../../types';

const tipoLabel: Record<TipoAtivo, string> = {
  SERVIDOR: 'Servidor', ESTACAO_TRABALHO: 'Estacao de Trabalho', NOTEBOOK: 'Notebook',
  IMPRESSORA: 'Impressora', SWITCH: 'Switch', ROTEADOR: 'Roteador', STORAGE: 'Storage', OUTRO: 'Outro',
};

const statusLabel: Record<StatusAtivo, string> = {
  ATIVO: 'Ativo', INATIVO: 'Inativo', EM_MANUTENCAO: 'Em Manutencao', DESCARTADO: 'Descartado',
};

const statusCores: Record<StatusAtivo, string> = {
  ATIVO: 'bg-green-100 text-green-700', INATIVO: 'bg-slate-100 text-slate-600',
  EM_MANUTENCAO: 'bg-yellow-100 text-yellow-700', DESCARTADO: 'bg-red-100 text-red-700',
};

type Tab = 'softwares' | 'tecnico';

export function AtivoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { gestaoTiRole } = useAuth();
  const canManage = gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR_TI';

  const [ativo, setAtivo] = useState<Ativo | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('softwares');

  // Softwares tab state
  const [softwares, setSoftwares] = useState<AtivoSoftwareItem[]>([]);
  const [allSoftwares, setAllSoftwares] = useState<Software[]>([]);
  const [showAddSw, setShowAddSw] = useState(false);
  const [newSwId, setNewSwId] = useState('');
  const [newSwVersao, setNewSwVersao] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    ativoService.buscar(id).then((a) => {
      setAtivo(a);
      setSoftwares(a.softwares || []);
    }).catch(() => navigate('/gestao-ti/ativos'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  useEffect(() => {
    if (showAddSw && allSoftwares.length === 0) {
      softwareService.listar({ status: 'ATIVO' }).then(setAllSoftwares).catch(() => {});
    }
  }, [showAddSw, allSoftwares.length]);

  async function handleStatusChange(status: StatusAtivo) {
    if (!id || !ativo) return;
    try {
      const updated = await ativoService.alterarStatus(id, status);
      setAtivo({ ...ativo, ...updated });
    } catch { /* ignore */ }
  }

  async function handleDelete() {
    if (!id || !confirm('Tem certeza que deseja excluir este ativo?')) return;
    try {
      await ativoService.excluir(id);
      navigate('/gestao-ti/ativos');
    } catch { /* ignore */ }
  }

  async function handleAddSoftware() {
    if (!id || !newSwId) return;
    try {
      const item = await ativoService.adicionarSoftware(id, {
        softwareId: newSwId,
        versaoInstalada: newSwVersao || undefined,
      });
      setSoftwares([item, ...softwares]);
      setShowAddSw(false);
      setNewSwId('');
      setNewSwVersao('');
    } catch { /* ignore */ }
  }

  async function handleRemoveSoftware(softwareId: string) {
    if (!id || !confirm('Remover software deste ativo?')) return;
    try {
      await ativoService.removerSoftware(id, softwareId);
      setSoftwares(softwares.filter((s) => s.softwareId !== softwareId));
    } catch { /* ignore */ }
  }

  if (loading || !ativo) return <><Header title="Ativo" /><div className="p-6 text-center text-slate-500">Carregando...</div></>;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'softwares', label: `Softwares (${softwares.length})` },
    { key: 'tecnico', label: 'Info Tecnica' },
  ];

  return (
    <>
      <Header title={`Ativo ${ativo.tag}`} />
      <div className="p-6">
        <button onClick={() => navigate('/gestao-ti/ativos')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        {/* Info card */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-teal-50 rounded-lg">
                <Server className="w-6 h-6 text-teal-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">{ativo.nome}</h2>
                <p className="text-sm text-slate-500 mt-0.5">Tag: <span className="font-mono font-medium text-teal-600">{ativo.tag}</span></p>
                {ativo.descricao && <p className="text-sm text-slate-600 mt-2">{ativo.descricao}</p>}
                <div className="flex flex-wrap gap-4 mt-3 text-sm text-slate-600">
                  <span>Tipo: <strong>{tipoLabel[ativo.tipo]}</strong></span>
                  <span>Filial: <strong>{ativo.filial?.codigo} — {ativo.filial?.nomeFantasia}</strong></span>
                  {ativo.responsavel && <span>Responsavel: <strong>{ativo.responsavel.nome}</strong></span>}
                  {ativo.departamento && <span>Departamento: <strong>{ativo.departamento.nome}</strong></span>}
                  {ativo.fabricante && <span>Fabricante: <strong>{ativo.fabricante}</strong></span>}
                  {ativo.modelo && <span>Modelo: <strong>{ativo.modelo}</strong></span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded text-xs font-medium ${statusCores[ativo.status]}`}>
                {statusLabel[ativo.status]}
              </span>
              {canManage && (
                <>
                  <select
                    value={ativo.status}
                    onChange={(e) => handleStatusChange(e.target.value as StatusAtivo)}
                    className="border border-slate-200 rounded-lg px-2 py-1 text-xs"
                  >
                    {Object.entries(statusLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <Link to={`/gestao-ti/ativos/${id}/editar`} className="p-2 text-slate-400 hover:text-teal-600 transition-colors">
                    <Edit className="w-4 h-4" />
                  </Link>
                  <button onClick={handleDelete} className="p-2 text-slate-400 hover:text-red-600 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 mb-4">
          <div className="flex gap-6">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        {tab === 'softwares' && (
          <div className="bg-white rounded-lg border border-slate-200 p-5">
            {canManage && (
              <div className="mb-4">
                {!showAddSw ? (
                  <button onClick={() => setShowAddSw(true)} className="flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700 font-medium">
                    <Plus className="w-4 h-4" /> Adicionar Software
                  </button>
                ) : (
                  <div className="flex items-center gap-2 bg-teal-50 p-3 rounded-lg">
                    <select value={newSwId} onChange={(e) => setNewSwId(e.target.value)} className="flex-1 border border-slate-200 rounded px-2 py-1.5 text-sm">
                      <option value="">Selecione o software...</option>
                      {allSoftwares.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                    </select>
                    <input placeholder="Versao instalada" value={newSwVersao} onChange={(e) => setNewSwVersao(e.target.value)} className="w-36 border border-slate-200 rounded px-2 py-1.5 text-sm" />
                    <button onClick={handleAddSoftware} disabled={!newSwId} className="bg-teal-600 text-white px-3 py-1.5 rounded text-sm hover:bg-teal-700 disabled:opacity-50">Adicionar</button>
                    <button onClick={() => { setShowAddSw(false); setNewSwId(''); setNewSwVersao(''); }} className="p-1.5 text-slate-400 hover:text-slate-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {softwares.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Nenhum software instalado</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-500 uppercase bg-slate-50">
                  <tr>
                    <th className="px-4 py-2">Software</th>
                    <th className="px-4 py-2">Tipo</th>
                    <th className="px-4 py-2">Versao Instalada</th>
                    <th className="px-4 py-2">Versao Atual</th>
                    <th className="px-4 py-2">Data Instalacao</th>
                    {canManage && <th className="px-4 py-2 w-12"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {softwares.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium text-slate-700">{s.software.nome}</td>
                      <td className="px-4 py-2 text-slate-500">{s.software.tipo}</td>
                      <td className="px-4 py-2 text-slate-600">{s.versaoInstalada || '—'}</td>
                      <td className="px-4 py-2 text-slate-500">{s.software.versaoAtual || '—'}</td>
                      <td className="px-4 py-2 text-slate-500">{s.dataInstalacao ? new Date(s.dataInstalacao).toLocaleDateString('pt-BR') : '—'}</td>
                      {canManage && (
                        <td className="px-4 py-2">
                          <button onClick={() => handleRemoveSoftware(s.softwareId)} className="text-slate-400 hover:text-red-500">
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'tecnico' && (
          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <div className="grid grid-cols-3 gap-6">
              {[
                { icon: Cpu, label: 'Processador', value: ativo.processador },
                { icon: HardDrive, label: 'Memoria', value: ativo.memoriaGB ? `${ativo.memoriaGB} GB` : null },
                { icon: HardDrive, label: 'Disco', value: ativo.discoGB ? `${ativo.discoGB} GB` : null },
                { icon: Monitor, label: 'Sistema Operacional', value: ativo.sistemaOperacional },
                { icon: Wifi, label: 'IP', value: ativo.ip },
                { icon: Server, label: 'Hostname', value: ativo.hostname },
                { icon: Server, label: 'N. Serie', value: ativo.numeroSerie },
                { icon: Server, label: 'Data Aquisicao', value: ativo.dataAquisicao ? new Date(ativo.dataAquisicao).toLocaleDateString('pt-BR') : null },
                { icon: Server, label: 'Data Garantia', value: ativo.dataGarantia ? new Date(ativo.dataGarantia).toLocaleDateString('pt-BR') : null },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-start gap-3">
                    <Icon className="w-4 h-4 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-slate-500">{item.label}</p>
                      <p className="text-sm font-medium text-slate-700">{item.value || '—'}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            {ativo.observacoes && (
              <div className="mt-6 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-500 mb-1">Observacoes</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{ativo.observacoes}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
