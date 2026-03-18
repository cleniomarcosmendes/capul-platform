import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { softwareService } from '../../services/software.service';
import { licencaService } from '../../services/licenca.service';
import { coreApi } from '../../services/api';
import {
  ArrowLeft, Pencil, Plus, Trash2, X, Building2, KeyRound, Layers,
  AlertTriangle, ExternalLink, Activity, Users, UserPlus, UserMinus,
} from 'lucide-react';
import { paradaService } from '../../services/parada.service';
import { coreService } from '../../services/core.service';
import type {
  Software, SoftwareModulo, SoftwareLicenca, SoftwareFilialItem,
  StatusSoftware, StatusModulo, ModeloLicenca, RegistroParada,
  UsuarioCore, LicencaUsuario,
} from '../../types';

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

const statusModuloLabel: Record<string, string> = {
  ATIVO: 'Ativo',
  EM_IMPLANTACAO: 'Em Implantacao',
  DESATIVADO: 'Desativado',
};

const modeloLicencaLabel: Record<string, string> = {
  SUBSCRICAO: 'Subscricao',
  PERPETUA: 'Perpetua',
  POR_USUARIO: 'Por Usuario',
  POR_ESTACAO: 'Por Estacao',
  OEM: 'OEM',
  FREE_OPENSOURCE: 'Free/Open Source',
  SAAS: 'SaaS',
  OUTRO: 'Outro',
};

const statusLicLabel: Record<string, string> = {
  ATIVA: 'Ativa',
  INATIVA: 'Inativa',
  VENCIDA: 'Vencida',
};

const statusLicCores: Record<string, string> = {
  ATIVA: 'bg-green-100 text-green-700',
  INATIVA: 'bg-slate-100 text-slate-600',
  VENCIDA: 'bg-red-100 text-red-700',
};

type Tab = 'modulos' | 'filiais' | 'licencas' | 'disponibilidade';

export function SoftwareDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { gestaoTiRole } = useAuth();
  const isAdmin = gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR_TI';

  const [software, setSoftware] = useState<Software | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('modulos');
  const [error, setError] = useState('');

  function reload() {
    if (!id) return;
    softwareService
      .buscar(id)
      .then(setSoftware)
      .catch(() => setError('Erro ao carregar software'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { reload(); }, [id]);

  if (loading) {
    return (
      <>
        <Header title="Software" />
        <div className="p-6"><p className="text-slate-500">Carregando...</p></div>
      </>
    );
  }

  if (!software) {
    return (
      <>
        <Header title="Software" />
        <div className="p-6"><p className="text-red-500">{error || 'Software nao encontrado'}</p></div>
      </>
    );
  }

  return (
    <>
      <Header title={software.nome} />
      <div className="p-6">
        <button
          onClick={() => navigate('/gestao-ti/softwares')}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Header do Software */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-xl font-bold text-slate-800">{software.nome}</h3>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusCores[software.status] || ''}`}>
                  {statusLabel[software.status] || software.status}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                {software.fabricante && <span>Fabricante: <strong className="text-slate-700">{software.fabricante}</strong></span>}
                {software.tipo && <span>Tipo: <strong className="text-slate-700">{software.tipo}</strong></span>}
                {software.criticidade && <span>Criticidade: <strong className="text-slate-700">{software.criticidade}</strong></span>}
                {software.versaoAtual && <span>Versao: <strong className="text-slate-700">{software.versaoAtual}</strong></span>}
                {software.ambiente && <span>Ambiente: <strong className="text-slate-700">{software.ambiente}</strong></span>}
                {software.equipeResponsavel && (
                  <span>
                    Equipe:{' '}
                    <strong className="text-slate-700">
                      {software.equipeResponsavel.sigla} - {software.equipeResponsavel.nome}
                    </strong>
                  </span>
                )}
              </div>
              {software.urlAcesso && (
                <a
                  href={software.urlAcesso}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-capul-600 hover:underline mt-2"
                >
                  <ExternalLink className="w-3 h-3" />
                  Acessar sistema
                </a>
              )}
              {software.observacoes && (
                <p className="text-sm text-slate-500 mt-2">{software.observacoes}</p>
              )}
            </div>
            {isAdmin && (
              <div className="flex gap-2">
                <Link
                  to={`/gestao-ti/softwares/${id}/editar`}
                  className="flex items-center gap-1 text-sm text-slate-600 hover:text-capul-600 border border-slate-300 px-3 py-1.5 rounded-lg"
                >
                  <Pencil className="w-3 h-3" />
                  Editar
                </Link>
                <StatusChanger
                  current={software.status}
                  onChangeStatus={async (status) => {
                    await softwareService.alterarStatus(id!, status);
                    reload();
                  }}
                />
                <button
                  onClick={async () => {
                    if (!confirm(`Excluir software "${software.nome}"? Esta acao nao pode ser desfeita.`)) return;
                    try {
                      await softwareService.excluir(id!);
                      navigate('/gestao-ti/softwares');
                    } catch (err: unknown) {
                      alert((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao excluir');
                    }
                  }}
                  className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700 border border-red-300 px-3 py-1.5 rounded-lg hover:bg-red-50"
                >
                  <Trash2 className="w-3 h-3" />
                  Excluir
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-4 mt-4 text-sm">
            <span className="text-slate-500">{software._count.modulos} modulos</span>
            <span className="text-slate-500">{software._count.licencas} licencas</span>
            <span className="text-slate-500">{software._count.chamados} chamados</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 mb-6">
          <div className="flex gap-6">
            {([
              { key: 'modulos', label: 'Modulos', icon: Layers },
              { key: 'filiais', label: 'Filiais', icon: Building2 },
              { key: 'licencas', label: 'Licencas', icon: KeyRound },
              { key: 'disponibilidade', label: 'Disponibilidade', icon: Activity },
            ] as { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[]).map(
              (t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`flex items-center gap-2 pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                      tab === t.key
                        ? 'border-capul-600 text-capul-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {t.label}
                  </button>
                );
              },
            )}
          </div>
        </div>

        {tab === 'modulos' && (
          <TabModulos software={software} isAdmin={isAdmin} onReload={reload} />
        )}
        {tab === 'filiais' && (
          <TabFiliais software={software} isAdmin={isAdmin} onReload={reload} />
        )}
        {tab === 'licencas' && (
          <TabLicencas software={software} isAdmin={isAdmin} onReload={reload} />
        )}
        {tab === 'disponibilidade' && (
          <TabDisponibilidade software={software} />
        )}
      </div>
    </>
  );
}

// ─── Status Changer ──────────────────────────────────────────

function StatusChanger({ current, onChangeStatus }: { current: StatusSoftware; onChangeStatus: (s: StatusSoftware) => void }) {
  const opcoes: StatusSoftware[] = ['ATIVO', 'EM_IMPLANTACAO', 'DESCONTINUADO', 'HOMOLOGACAO'];
  return (
    <select
      value={current}
      onChange={(e) => onChangeStatus(e.target.value as StatusSoftware)}
      className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white"
    >
      {opcoes.map((s) => (
        <option key={s} value={s}>{statusLabel[s]}</option>
      ))}
    </select>
  );
}

// ─── Tab Módulos ──────────────────────────────────────────────

function TabModulos({ software, isAdmin, onReload }: { software: Software; isAdmin: boolean; onReload: () => void }) {
  const modulos = software.modulos || [];
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [versao, setVersao] = useState('');
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setShowForm(false);
    setEditId(null);
    setNome('');
    setDescricao('');
    setVersao('');
  }

  function startEdit(m: SoftwareModulo) {
    setEditId(m.id);
    setNome(m.nome);
    setDescricao(m.descricao || '');
    setVersao(m.versao || '');
    setShowForm(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editId) {
        await softwareService.atualizarModulo(software.id, editId, { nome, descricao: descricao || undefined, versao: versao || undefined });
      } else {
        await softwareService.criarModulo(software.id, { nome, descricao: descricao || undefined, versao: versao || undefined });
      }
      resetForm();
      onReload();
    } catch { /* ignore */ }
    setSaving(false);
  }

  async function toggleStatus(m: SoftwareModulo) {
    const next: StatusModulo = m.status === 'ATIVO' ? 'DESATIVADO' : 'ATIVO';
    await softwareService.alterarStatusModulo(software.id, m.id, next);
    onReload();
  }

  return (
    <div>
      {isAdmin && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 text-sm text-capul-600 border border-capul-300 px-3 py-1.5 rounded-lg hover:bg-capul-50 mb-4"
        >
          <Plus className="w-4 h-4" />
          Novo Modulo
        </button>
      )}

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-700">{editId ? 'Editar Modulo' : 'Novo Modulo'}</h4>
            <button onClick={resetForm}><X className="w-4 h-4 text-slate-400" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome *"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descricao"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
            <input
              value={versao}
              onChange={(e) => setVersao(e.target.value)}
              placeholder="Versao"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="mt-3">
            <button
              onClick={handleSave}
              disabled={!nome || saving}
              className="bg-capul-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-capul-700 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : editId ? 'Salvar' : 'Adicionar'}
            </button>
          </div>
        </div>
      )}

      {modulos.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <Layers className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">Nenhum modulo cadastrado</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-3 font-medium text-slate-600">Nome</th>
                <th className="px-4 py-3 font-medium text-slate-600">Descricao</th>
                <th className="px-4 py-3 font-medium text-slate-600">Versao</th>
                <th className="px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="px-4 py-3 font-medium text-slate-600">Filiais</th>
                {isAdmin && <th className="px-4 py-3 font-medium text-slate-600">Acoes</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {modulos.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{m.nome}</td>
                  <td className="px-4 py-3 text-slate-600">{m.descricao || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{m.versao || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      m.status === 'ATIVO' ? 'bg-green-100 text-green-700' :
                      m.status === 'EM_IMPLANTACAO' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {statusModuloLabel[m.status] || m.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {m.filiais?.length || 0}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(m)}
                          className="text-xs text-capul-600 hover:underline"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => toggleStatus(m)}
                          className="text-xs text-slate-500 hover:underline"
                        >
                          {m.status === 'ATIVO' ? 'Desativar' : 'Ativar'}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Tab Filiais ──────────────────────────────────────────────

function TabFiliais({ software, isAdmin, onReload }: { software: Software; isAdmin: boolean; onReload: () => void }) {
  const filiais = software.filiais || [];
  const [showAdd, setShowAdd] = useState(false);
  const [allFiliais, setAllFiliais] = useState<{ id: string; codigo: string; nomeFantasia: string }[]>([]);
  const [filialId, setFilialId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (showAdd) {
      coreApi.get('/filiais').then(({ data }) => setAllFiliais(data)).catch(() => {});
    }
  }, [showAdd]);

  const filiaisVinculadas = new Set(filiais.map((f: SoftwareFilialItem) => f.filialId));
  const filiaisDisponiveis = allFiliais.filter((f) => !filiaisVinculadas.has(f.id));

  async function handleAdd() {
    if (!filialId) return;
    setSaving(true);
    try {
      await softwareService.adicionarFilial(software.id, filialId);
      setShowAdd(false);
      setFilialId('');
      onReload();
    } catch { /* ignore */ }
    setSaving(false);
  }

  async function handleRemove(filId: string) {
    await softwareService.removerFilial(software.id, filId);
    onReload();
  }

  return (
    <div>
      {isAdmin && !showAdd && (
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 text-sm text-capul-600 border border-capul-300 px-3 py-1.5 rounded-lg hover:bg-capul-50 mb-4"
        >
          <Plus className="w-4 h-4" />
          Vincular Filial
        </button>
      )}

      {showAdd && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">Filial</label>
            <select
              value={filialId}
              onChange={(e) => setFilialId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">Selecione</option>
              {filiaisDisponiveis.map((f) => (
                <option key={f.id} value={f.id}>{f.codigo} - {f.nomeFantasia}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleAdd}
            disabled={!filialId || saving}
            className="bg-capul-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-capul-700 disabled:opacity-50"
          >
            Vincular
          </button>
          <button onClick={() => { setShowAdd(false); setFilialId(''); }}>
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      )}

      {filiais.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">Nenhuma filial vinculada</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-3 font-medium text-slate-600">Codigo</th>
                <th className="px-4 py-3 font-medium text-slate-600">Nome</th>
                <th className="px-4 py-3 font-medium text-slate-600">Vinculado em</th>
                {isAdmin && <th className="px-4 py-3 font-medium text-slate-600">Acoes</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filiais.map((sf: SoftwareFilialItem) => (
                <tr key={sf.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{sf.filial.codigo}</td>
                  <td className="px-4 py-3 text-slate-600">{sf.filial.nomeFantasia}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {new Date(sf.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleRemove(sf.filialId)}
                        className="text-xs text-red-500 hover:underline flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remover
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Tab Licenças ─────────────────────────────────────────────

const MODELOS_POR_USUARIO: ModeloLicenca[] = ['POR_USUARIO', 'SUBSCRICAO', 'SAAS'];

function TabLicencas({ software, isAdmin, onReload }: { software: Software; isAdmin: boolean; onReload: () => void }) {
  const [licencas, setLicencas] = useState<SoftwareLicenca[]>([]);
  const [loadingLic, setLoadingLic] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedLicId, setExpandedLicId] = useState<string | null>(null);
  const [allUsuarios, setAllUsuarios] = useState<UsuarioCore[]>([]);
  const [licencaUsuarios, setLicencaUsuarios] = useState<LicencaUsuario[]>([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);
  const [selectedUsuarioId, setSelectedUsuarioId] = useState('');
  const [savingUsuario, setSavingUsuario] = useState(false);

  const [modeloLicenca, setModeloLicenca] = useState<ModeloLicenca | ''>('');
  const [quantidade, setQuantidade] = useState('');
  const [valorTotal, setValorTotal] = useState('');
  const [valorUnitario, setValorUnitario] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataVencimento, setDataVencimento] = useState('');
  const [chaveSerial, setChaveSerial] = useState('');
  const [fornecedor, setFornecedor] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [saving, setSaving] = useState(false);

  function loadLicencas() {
    licencaService
      .listar({ softwareId: software.id })
      .then(setLicencas)
      .catch(() => {})
      .finally(() => setLoadingLic(false));
  }

  useEffect(() => { loadLicencas(); }, [software.id]);

  function resetForm() {
    setShowForm(false);
    setModeloLicenca('');
    setQuantidade('');
    setValorTotal('');
    setValorUnitario('');
    setDataInicio('');
    setDataVencimento('');
    setChaveSerial('');
    setFornecedor('');
    setObservacoes('');
  }

  async function handleCreate() {
    setSaving(true);
    try {
      await licencaService.criar({
        softwareId: software.id,
        modeloLicenca: modeloLicenca || undefined,
        quantidade: quantidade ? parseInt(quantidade) : undefined,
        valorTotal: valorTotal ? parseFloat(valorTotal) : undefined,
        valorUnitario: valorUnitario ? parseFloat(valorUnitario) : undefined,
        dataInicio: dataInicio || undefined,
        dataVencimento: dataVencimento || undefined,
        chaveSerial: chaveSerial || undefined,
        fornecedor: fornecedor || undefined,
        observacoes: observacoes || undefined,
      });
      resetForm();
      loadLicencas();
      onReload();
    } catch { /* ignore */ }
    setSaving(false);
  }

  async function handleRenovar(licId: string) {
    await licencaService.renovar(licId);
    loadLicencas();
    onReload();
  }

  async function handleInativar(licId: string) {
    await licencaService.inativar(licId);
    loadLicencas();
    onReload();
  }

  function isVencendo(lic: SoftwareLicenca) {
    if (!lic.dataVencimento || lic.status !== 'ATIVA') return false;
    const diff = new Date(lic.dataVencimento).getTime() - Date.now();
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
  }

  function isModeloPorUsuario(lic: SoftwareLicenca) {
    return lic.modeloLicenca && MODELOS_POR_USUARIO.includes(lic.modeloLicenca);
  }

  async function toggleUsuarios(licId: string) {
    if (expandedLicId === licId) {
      setExpandedLicId(null);
      return;
    }
    setExpandedLicId(licId);
    setLoadingUsuarios(true);
    setSelectedUsuarioId('');
    try {
      const [usuarios, todosUsuarios] = await Promise.all([
        licencaService.listarUsuarios(licId),
        allUsuarios.length ? Promise.resolve(allUsuarios) : coreService.listarUsuarios(),
      ]);
      setLicencaUsuarios(usuarios);
      if (!allUsuarios.length) setAllUsuarios(todosUsuarios);
    } catch { /* ignore */ }
    setLoadingUsuarios(false);
  }

  async function handleAtribuir(licId: string) {
    if (!selectedUsuarioId) return;
    setSavingUsuario(true);
    try {
      await licencaService.atribuirUsuario(licId, selectedUsuarioId);
      const usuarios = await licencaService.listarUsuarios(licId);
      setLicencaUsuarios(usuarios);
      setSelectedUsuarioId('');
      loadLicencas();
    } catch { /* ignore */ }
    setSavingUsuario(false);
  }

  async function handleDesatribuir(licId: string, usuarioId: string) {
    try {
      await licencaService.desatribuirUsuario(licId, usuarioId);
      const usuarios = await licencaService.listarUsuarios(licId);
      setLicencaUsuarios(usuarios);
      loadLicencas();
    } catch { /* ignore */ }
  }

  if (loadingLic) return <p className="text-slate-500">Carregando licencas...</p>;

  return (
    <div>
      {isAdmin && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 text-sm text-capul-600 border border-capul-300 px-3 py-1.5 rounded-lg hover:bg-capul-50 mb-4"
        >
          <Plus className="w-4 h-4" />
          Nova Licenca
        </button>
      )}

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-700">Nova Licenca</h4>
            <button onClick={resetForm}><X className="w-4 h-4 text-slate-400" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <select
              value={modeloLicenca}
              onChange={(e) => setModeloLicenca(e.target.value as ModeloLicenca | '')}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">Modelo</option>
              {Object.entries(modeloLicencaLabel).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <input
              type="number"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              placeholder="Quantidade"
              min="1"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
            <input
              value={fornecedor}
              onChange={(e) => setFornecedor(e.target.value)}
              placeholder="Fornecedor"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
            <input
              type="number"
              step="0.01"
              value={valorTotal}
              onChange={(e) => setValorTotal(e.target.value)}
              placeholder="Valor Total (R$)"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="number"
              step="0.01"
              value={valorUnitario}
              onChange={(e) => setValorUnitario(e.target.value)}
              placeholder="Valor Unitario (R$)"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
              title="Data Inicio"
            />
            <input
              type="date"
              value={dataVencimento}
              onChange={(e) => setDataVencimento(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
              title="Data Vencimento"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <input
              value={chaveSerial}
              onChange={(e) => setChaveSerial(e.target.value)}
              placeholder="Chave Serial"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
            <input
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observacoes"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={saving}
            className="bg-capul-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-capul-700 disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Adicionar Licenca'}
          </button>
        </div>
      )}

      {licencas.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <KeyRound className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">Nenhuma licenca cadastrada</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-4 py-3 font-medium text-slate-600">Modelo</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Qtd</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Usuarios</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Valor Total</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Fornecedor</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Vencimento</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Status</th>
                  {isAdmin && <th className="px-4 py-3 font-medium text-slate-600">Acoes</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {licencas.map((lic) => (
                  <React.Fragment key={lic.id}>
                    <tr className={`hover:bg-slate-50 ${isVencendo(lic) ? 'bg-amber-50' : ''}`}>
                      <td className="px-4 py-3 text-slate-800">
                        {lic.modeloLicenca ? modeloLicencaLabel[lic.modeloLicenca] || lic.modeloLicenca : '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{lic.quantidade ?? '-'}</td>
                      <td className="px-4 py-3">
                        {isModeloPorUsuario(lic) ? (
                          <button
                            onClick={() => toggleUsuarios(lic.id)}
                            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium transition-colors ${
                              expandedLicId === lic.id
                                ? 'bg-capul-100 text-capul-700'
                                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                            }`}
                          >
                            <Users className="w-3 h-3" />
                            {lic._count?.usuarios ?? 0}/{lic.quantidade ?? '∞'}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {lic.valorTotal != null
                          ? `R$ ${Number(lic.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{lic.fornecedor || '-'}</td>
                      <td className="px-4 py-3">
                        {lic.dataVencimento ? (
                          <span className="flex items-center gap-1">
                            {isVencendo(lic) && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                            {new Date(lic.dataVencimento).toLocaleDateString('pt-BR')}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusLicCores[lic.status] || ''}`}>
                          {statusLicLabel[lic.status] || lic.status}
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
                    {/* Painel expandivel de usuarios */}
                    {expandedLicId === lic.id && isModeloPorUsuario(lic) && (
                      <tr>
                        <td colSpan={isAdmin ? 8 : 7} className="px-4 py-3 bg-slate-50">
                          <div className="border border-slate-200 rounded-lg bg-white p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h5 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                <Users className="w-4 h-4 text-capul-600" />
                                Usuarios Atribuidos
                                {lic.quantidade && (
                                  <span className="text-xs font-normal text-slate-500">
                                    ({licencaUsuarios.length}/{lic.quantidade})
                                  </span>
                                )}
                              </h5>
                              {lic.quantidade && (
                                <div className="w-32 bg-slate-200 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full transition-all ${
                                      licencaUsuarios.length >= lic.quantidade ? 'bg-red-500' : 'bg-capul-500'
                                    }`}
                                    style={{ width: `${Math.min((licencaUsuarios.length / lic.quantidade) * 100, 100)}%` }}
                                  />
                                </div>
                              )}
                            </div>

                            {loadingUsuarios ? (
                              <p className="text-sm text-slate-400">Carregando...</p>
                            ) : (
                              <>
                                {/* Formulario atribuir */}
                                {isAdmin && lic.status === 'ATIVA' && (
                                  <div className="flex gap-2 mb-3">
                                    <select
                                      value={selectedUsuarioId}
                                      onChange={(e) => setSelectedUsuarioId(e.target.value)}
                                      className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white"
                                    >
                                      <option value="">Selecione um usuario...</option>
                                      {allUsuarios
                                        .filter((u) => !licencaUsuarios.some((lu) => lu.usuarioId === u.id))
                                        .map((u) => (
                                          <option key={u.id} value={u.id}>
                                            {u.nome} ({u.username}){u.email ? ` - ${u.email}` : ''}
                                          </option>
                                        ))}
                                    </select>
                                    <button
                                      onClick={() => handleAtribuir(lic.id)}
                                      disabled={!selectedUsuarioId || savingUsuario || (lic.quantidade != null && licencaUsuarios.length >= lic.quantidade)}
                                      className="flex items-center gap-1 bg-capul-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-capul-700 disabled:opacity-50"
                                    >
                                      <UserPlus className="w-3.5 h-3.5" />
                                      {savingUsuario ? 'Atribuindo...' : 'Atribuir'}
                                    </button>
                                  </div>
                                )}

                                {/* Lista de usuarios atribuidos */}
                                {licencaUsuarios.length === 0 ? (
                                  <p className="text-sm text-slate-400 text-center py-2">Nenhum usuario atribuido</p>
                                ) : (
                                  <div className="space-y-1">
                                    {licencaUsuarios.map((lu) => (
                                      <div key={lu.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-slate-50">
                                        <div className="flex items-center gap-3">
                                          <div className="w-7 h-7 rounded-full bg-capul-100 text-capul-700 flex items-center justify-center text-xs font-semibold">
                                            {lu.usuario.nome.charAt(0).toUpperCase()}
                                          </div>
                                          <div>
                                            <span className="text-sm font-medium text-slate-800">{lu.usuario.nome}</span>
                                            <span className="text-xs text-slate-400 ml-2">@{lu.usuario.username}</span>
                                            {lu.usuario.email && (
                                              <span className="text-xs text-slate-400 ml-2">{lu.usuario.email}</span>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                          <span className="text-xs text-slate-400">
                                            {new Date(lu.createdAt).toLocaleDateString('pt-BR')}
                                          </span>
                                          {isAdmin && (
                                            <button
                                              onClick={() => handleDesatribuir(lic.id, lu.usuarioId)}
                                              className="text-red-400 hover:text-red-600"
                                              title="Remover usuario"
                                            >
                                              <UserMinus className="w-4 h-4" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab Disponibilidade ─────────────────────────────────────

const paradaStatusCores: Record<string, string> = {
  EM_ANDAMENTO: 'bg-red-100 text-red-700',
  FINALIZADA: 'bg-green-100 text-green-700',
  CANCELADA: 'bg-slate-100 text-slate-600',
};

const paradaStatusLabel: Record<string, string> = {
  EM_ANDAMENTO: 'Em Andamento',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada',
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

function TabDisponibilidade({ software }: { software: Software }) {
  const [paradas, setParadas] = useState<RegistroParada[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    paradaService
      .listar({ softwareId: software.id })
      .then(setParadas)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [software.id]);

  if (loading) return <p className="text-slate-500">Carregando paradas...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">{paradas.length} parada(s) registrada(s)</p>
        <a
          href="/gestao-ti/paradas/nova"
          target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-capul-600 border border-capul-300 px-3 py-1.5 rounded-lg hover:bg-capul-50"
        >
          <Plus className="w-4 h-4" />
          Registrar Parada
        </a>
      </div>

      {paradas.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <Activity className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">Nenhuma parada registrada para este software</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-4 py-3 font-medium text-slate-600">Titulo</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Tipo</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Impacto</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Inicio</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Duracao</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Filiais</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paradas.map((p) => (
                  <tr key={p.id} className={`hover:bg-slate-50 ${p.status === 'EM_ANDAMENTO' ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-3">
                      <a href={`/gestao-ti/paradas/${p.id}`} target="_blank" rel="noopener noreferrer" className="text-capul-600 hover:underline font-medium">
                        {p.titulo}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                      {p.tipo === 'PARADA_PROGRAMADA' ? 'Programada' : p.tipo === 'PARADA_NAO_PROGRAMADA' ? 'Nao Programada' : 'Manut. Preventiva'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.impacto === 'TOTAL' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {p.impacto === 'TOTAL' ? 'Total' : 'Parcial'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${paradaStatusCores[p.status] || ''}`}>
                        {paradaStatusLabel[p.status] || p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {new Date(p.inicio).toLocaleDateString('pt-BR')}{' '}
                      {new Date(p.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
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
  );
}
