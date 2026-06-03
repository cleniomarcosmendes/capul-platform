import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { softwareService } from '../../services/software.service';
import { licencaService } from '../../services/licenca.service';
import { contratoService } from '../../services/contrato.service';
import {
  ArrowLeft, Pencil, Plus, Trash2, X, KeyRound,
  AlertTriangle, ExternalLink, Users, UserPlus, UserMinus,
} from 'lucide-react';
import { useToast } from '../../components/Toast';
import { SearchSelect } from '../../components/SearchSelect';
import type { SearchSelectOption } from '../../components/SearchSelect';
import { formatDateBR } from '../../utils/date';
import type {
  Software, SoftwareLicenca,
  StatusSoftware, ModeloLicenca,
  LicencaFuncionario, FornecedorConfig,
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

export function SoftwareDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { gestaoTiRole } = useAuth();
  // SUPORTE também gerencia software/licença (faz o lançamento).
  const isAdmin = ['ADMIN', 'GESTOR', 'SUPORTE'].includes(gestaoTiRole || '');
  const { toast, confirm } = useToast();

  const [software, setSoftware] = useState<Software | null>(null);
  const [loading, setLoading] = useState(true);
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
              {/* Cadastro completo do software — todos os campos sempre visíveis ('—' quando vazio). */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-sm text-slate-500 mt-1">
                <span>Fabricante: <strong className="text-slate-700">{software.fabricante || '—'}</strong></span>
                <span>Tipo: <strong className="text-slate-700">{software.tipo || '—'}</strong></span>
                <span>Criticidade: <strong className="text-slate-700">{software.criticidade || '—'}</strong></span>
                <span>Versão: <strong className="text-slate-700">{software.versaoAtual || '—'}</strong></span>
                <span>Ambiente: <strong className="text-slate-700">{software.ambiente || '—'}</strong></span>
                <span>Equipe: <strong className="text-slate-700">{software.equipeResponsavel ? `${software.equipeResponsavel.sigla} - ${software.equipeResponsavel.nome}` : '—'}</strong></span>
                <span className="col-span-2 md:col-span-3">
                  URL:{' '}
                  {software.urlAcesso ? (
                    <a href={software.urlAcesso} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-capul-600 hover:underline">
                      <ExternalLink className="w-3 h-3" />{software.urlAcesso}
                    </a>
                  ) : <strong className="text-slate-700">—</strong>}
                </span>
                <span className="col-span-2 md:col-span-3">Observações: <strong className="text-slate-700 font-normal">{software.observacoes || '—'}</strong></span>
              </div>
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
                    if (!await confirm('Excluir Software', `Excluir software "${software.nome}"? Esta acao nao pode ser desfeita.`, { variant: 'danger' })) return;
                    try {
                      await softwareService.excluir(id!);
                      navigate('/gestao-ti/softwares');
                    } catch (err: unknown) {
                      toast('error', (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao excluir');
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

        {/* Cadastro de software simplificado (03/06): só Licenças.
            Tabs Módulos/Filiais/Disponibilidade removidas a pedido. */}
        <div className="mb-2 flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-capul-500" />
          <h3 className="text-base font-semibold text-slate-800">Licenças</h3>
        </div>
        <TabLicencas software={software} isAdmin={isAdmin} onReload={reload} />
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

function TabLicencas({ software, isAdmin, onReload }: { software: Software; isAdmin: boolean; onReload: () => void }) {
  const { toast, confirm } = useToast();
  const [licencas, setLicencas] = useState<SoftwareLicenca[]>([]);
  const [loadingLic, setLoadingLic] = useState(true);
  const [showForm, setShowForm] = useState(false);
  // 03/06 — modal compartilhado criar/editar (antes só criar inline, sem edição).
  const [editingLicId, setEditingLicId] = useState<string | null>(null);
  const [expandedLicId, setExpandedLicId] = useState<string | null>(null);
  const [licencaFuncionarios, setLicencaFuncionarios] = useState<LicencaFuncionario[]>([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);
  const [matriculaInput, setMatriculaInput] = useState('');
  const [nomeInput, setNomeInput] = useState('');
  const [savingUsuario, setSavingUsuario] = useState(false);

  const [modeloLicenca, setModeloLicenca] = useState<ModeloLicenca | ''>('');
  const [quantidade, setQuantidade] = useState('');
  const [valorTotal, setValorTotal] = useState('');
  const [valorUnitario, setValorUnitario] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataVencimento, setDataVencimento] = useState('');
  const [chaveSerial, setChaveSerial] = useState('');
  const [chaveNfe, setChaveNfe] = useState('');
  const [fornecedor, setFornecedor] = useState('');
  // S11 (25/05) — FK p/ FornecedorConfig (cadastro centralizado).
  const [fornecedorId, setFornecedorId] = useState('');
  const [fornecedores, setFornecedores] = useState<FornecedorConfig[]>([]);
  const [observacoes, setObservacoes] = useState('');
  const [saving, setSaving] = useState(false);

  // S11 — options p/ SearchSelect (mesma forma da LicencasPage).
  const fornecedorOptions: SearchSelectOption[] = useMemo(() =>
    fornecedores.filter(f => f.status === 'ATIVO').map((f) => ({
      value: f.id,
      label: f.nome,
      sublabel: `${f.codigo}${f.loja ? '/' + f.loja : ''}`,
    })), [fornecedores]);

  function loadLicencas() {
    licencaService
      .listar({ softwareId: software.id })
      .then(setLicencas)
      .catch(() => {})
      .finally(() => setLoadingLic(false));
  }

  useEffect(() => { loadLicencas(); }, [software.id]);

  // S11 — carregar fornecedores cadastrados uma vez.
  useEffect(() => {
    contratoService.listarFornecedores().then(setFornecedores).catch(() => {});
  }, []);

  function resetForm() {
    setShowForm(false);
    setEditingLicId(null);
    setModeloLicenca('');
    setQuantidade('');
    setValorTotal('');
    setValorUnitario('');
    setDataInicio('');
    setDataVencimento('');
    setChaveSerial('');
    setChaveNfe('');
    setFornecedor('');
    setFornecedorId('');
    setObservacoes('');
  }

  function openEdit(lic: SoftwareLicenca) {
    setEditingLicId(lic.id);
    setModeloLicenca(lic.modeloLicenca || '');
    setQuantidade(lic.quantidade != null ? String(lic.quantidade) : '');
    setValorTotal(lic.valorTotal != null ? String(lic.valorTotal) : '');
    setValorUnitario(lic.valorUnitario != null ? String(lic.valorUnitario) : '');
    setDataInicio(lic.dataInicio ? lic.dataInicio.slice(0, 10) : '');
    setDataVencimento(lic.dataVencimento ? lic.dataVencimento.slice(0, 10) : '');
    setChaveSerial(lic.chaveSerial || '');
    setChaveNfe(lic.chaveNfe || '');
    setFornecedor(lic.fornecedor || '');
    setFornecedorId(lic.fornecedorId || '');
    setObservacoes(lic.observacoes || '');
    setShowForm(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        modeloLicenca: modeloLicenca || undefined,
        quantidade: quantidade ? parseInt(quantidade) : undefined,
        valorTotal: valorTotal ? parseFloat(valorTotal) : undefined,
        valorUnitario: valorUnitario ? parseFloat(valorUnitario) : undefined,
        dataInicio: dataInicio || undefined,
        dataVencimento: dataVencimento || undefined,
        chaveSerial: chaveSerial || undefined,
        chaveNfe: chaveNfe.replace(/\D/g, '') || undefined,
        fornecedor: fornecedor || undefined,
        observacoes: observacoes || undefined,
      };
      if (editingLicId) {
        // '' limpa a FK; UUID atualiza — manda sempre o estado atual.
        await licencaService.atualizar(editingLicId, { ...payload, fornecedorId });
        toast('success', 'Licença atualizada');
      } else {
        await licencaService.criar({ softwareId: software.id, ...payload, fornecedorId: fornecedorId || undefined });
        toast('success', 'Licença criada');
      }
      resetForm();
      loadLicencas();
      onReload();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast('error', msg || 'Erro ao salvar licença');
    }
    setSaving(false);
  }

  async function handleRenovar(licId: string) {
    if (!await confirm('Renovar Licença', 'Cria uma nova licença ATIVA copiando os dados desta (que será inativada). Os funcionários vinculados NÃO são transferidos. Continuar?')) return;
    try {
      await licencaService.renovar(licId);
      toast('success', 'Licença renovada');
      loadLicencas();
      onReload();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast('error', msg || 'Erro ao renovar licença');
    }
  }

  async function handleInativar(licId: string) {
    if (!await confirm('Inativar Licença', 'Deseja inativar esta licença?')) return;
    try {
      await licencaService.inativar(licId);
      loadLicencas();
      onReload();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast('error', msg || 'Erro ao inativar licença');
    }
  }

  async function handleExcluir(licId: string) {
    if (!await confirm('Excluir Licença', 'Deseja realmente excluir esta licença?', { variant: 'danger' })) return;
    try {
      await licencaService.excluir(licId);
      toast('success', 'Licença excluída');
      loadLicencas();
      onReload();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast('error', msg || 'Erro ao excluir licença');
    }
  }

  function isVencendo(lic: SoftwareLicenca) {
    if (!lic.dataVencimento || lic.status !== 'ATIVA') return false;
    const diff = new Date(lic.dataVencimento).getTime() - Date.now();
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
  }

  // 01/06 — vínculo de usuário liberado p/ TODOS os modelos de licença.
  // Antes restrito a POR_USUARIO/SUBSCRICAO/SAAS, o que escondia o lançamento
  // de usuário em licenças PERPÉTUA/OEM (ex.: Office com chave própria — 1
  // usuário por licença). O limite passa a ser a `quantidade` (qtd=1 → 1
  // usuário; sem qtd → ilimitado), aplicado no botão Atribuir.
  function podeGerenciarUsuarios(_lic: SoftwareLicenca) {
    return true;
  }

  async function toggleUsuarios(licId: string) {
    if (expandedLicId === licId) {
      setExpandedLicId(null);
      return;
    }
    setExpandedLicId(licId);
    setLoadingUsuarios(true);
    setMatriculaInput('');
    setNomeInput('');
    try {
      setLicencaFuncionarios(await licencaService.listarFuncionarios(licId));
    } catch { /* ignore */ }
    setLoadingUsuarios(false);
  }

  async function handleAtribuir(licId: string) {
    const mat = matriculaInput.trim();
    const nome = nomeInput.trim();
    if (!mat || !nome) return;
    setSavingUsuario(true);
    try {
      // Matrícula + nome informados manualmente (sem lookup Protheus — INFOCLIENTES
      // é cadastro de clientes, não funcionários; ver pendência Protheus).
      await licencaService.atribuirFuncionario(licId, mat, nome);
      setLicencaFuncionarios(await licencaService.listarFuncionarios(licId));
      setMatriculaInput('');
      setNomeInput('');
      loadLicencas();
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast('error', msg || 'Erro ao atribuir funcionário');
    }
    setSavingUsuario(false);
  }

  async function handleDesatribuir(licId: string, matricula: string) {
    try {
      await licencaService.desatribuirFuncionario(licId, matricula);
      setLicencaFuncionarios(await licencaService.listarFuncionarios(licId));
      loadLicencas();
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast('error', msg || 'Erro ao remover funcionário');
    }
  }

  if (loadingLic) return <p className="text-slate-500">Carregando licencas...</p>;

  return (
    <div>
      {isAdmin && (
        <Link
          to={`/gestao-ti/licencas/nova?software=${software.id}`}
          className="inline-flex items-center gap-2 text-sm text-capul-600 border border-capul-300 px-3 py-1.5 rounded-lg hover:bg-capul-50 mb-4"
          title="Abre uma nova Nota de compra já com este software no primeiro item."
        >
          <Plus className="w-4 h-4" />
          Nova Nota com este software
        </Link>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={resetForm}>
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h4 className="text-base font-semibold text-slate-800">{editingLicId ? 'Editar Licença' : 'Nova Licença'} — {software.nome}</h4>
              <button onClick={resetForm}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Modelo</label>
                  <select
                    value={modeloLicenca}
                    onChange={(e) => setModeloLicenca(e.target.value as ModeloLicenca | '')}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white w-full"
                  >
                    <option value="">Modelo</option>
                    {Object.entries(modeloLicencaLabel).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Quantidade</label>
                  <input
                    type="number"
                    value={quantidade}
                    onChange={(e) => setQuantidade(e.target.value)}
                    placeholder="Quantidade"
                    min="1"
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Fornecedor (cadastro)</label>
                  <SearchSelect
                    options={fornecedorOptions}
                    value={fornecedorId}
                    onChange={setFornecedorId}
                    placeholder="Fornecedor (cadastro)..."
                  />
                </div>
              </div>
              {/* S11 — Texto livre p/ fornecedor sem cadastro. */}
              <div className="mb-3">
                <input
                  value={fornecedor}
                  onChange={(e) => setFornecedor(e.target.value)}
                  placeholder="Fornecedor — descrição livre (opcional, p/ fornecedor sem cadastro)"
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full"
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Valor Total (R$)</label>
                  <input type="number" step="0.01" value={valorTotal} onChange={(e) => setValorTotal(e.target.value)} placeholder="Valor Total" className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Valor Unitário (R$)</label>
                  <input type="number" step="0.01" value={valorUnitario} onChange={(e) => setValorUnitario(e.target.value)} placeholder="Valor Unitário" className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Início</label>
                  <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Vencimento</label>
                  <input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Chave Serial</label>
                  <input value={chaveSerial} onChange={(e) => setChaveSerial(e.target.value)} placeholder="Chave Serial" className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Chave NF-e</label>
                  <input
                    value={chaveNfe}
                    onChange={(e) => setChaveNfe(e.target.value.replace(/\D/g, ''))}
                    placeholder="44 dígitos"
                    title="Chave da NF-e que originou esta licença (44 dígitos) — vincula ao módulo Fiscal."
                    inputMode="numeric"
                    maxLength={44}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono tracking-tight focus:outline-none focus:ring-2 focus:ring-capul-600 w-full"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Observações</label>
                  <input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Observações" className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={resetForm} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">Cancelar</button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-capul-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-capul-700 disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : (editingLicId ? 'Salvar' : 'Adicionar Licença')}
                </button>
              </div>
            </div>
          </div>
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
                  <th className="px-4 py-3 font-medium text-slate-600">Depto Alocado</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Chave Serial</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Usuário(s)</th>
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
                      <td className="px-4 py-3 text-slate-600">{lic.departamento?.nome ?? '-'}</td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-500">{lic.chaveSerial || '-'}</td>
                      <td className="px-4 py-3">
                        {podeGerenciarUsuarios(lic) ? (
                          <div className="flex flex-col gap-1 items-start">
                            <button
                              onClick={() => toggleUsuarios(lic.id)}
                              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium transition-colors ${
                                expandedLicId === lic.id
                                  ? 'bg-capul-100 text-capul-700'
                                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                              }`}
                            >
                              <Users className="w-3 h-3" />
                              {lic._count?.funcionarios ?? 0}/{lic.quantidade ?? '∞'}
                            </button>
                            {lic.funcionarios && lic.funcionarios.length > 0 && (
                              <span className="text-xs text-slate-600">
                                {lic.funcionarios.map((f) => f.nome).join(', ')}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {lic.valorTotal != null
                          ? `R$ ${Number(lic.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                          : '-'}
                      </td>
                      {/* S11 — preferir nome do cadastro; texto livre vira sublinha. */}
                      <td className="px-4 py-3 text-slate-600">
                        {lic.fornecedorRef ? (
                          <div>
                            <span className="font-medium">{lic.fornecedorRef.nome}</span>
                            <p className="text-xs text-slate-400">{lic.fornecedorRef.codigo}{lic.fornecedorRef.loja ? '/' + lic.fornecedorRef.loja : ''}</p>
                          </div>
                        ) : (
                          lic.fornecedor || '-'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {lic.dataVencimento ? (
                          <span className="flex items-center gap-1">
                            {isVencendo(lic) && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                            {formatDateBR(lic.dataVencimento)}
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
                            <button onClick={() => openEdit(lic)} className="text-xs text-capul-600 hover:underline">Editar</button>
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
                            <button onClick={() => handleExcluir(lic.id)} className="text-xs text-red-500 hover:underline">Excluir</button>
                          </div>
                        </td>
                      )}
                    </tr>
                    {/* Painel expandivel de usuarios */}
                    {expandedLicId === lic.id && podeGerenciarUsuarios(lic) && (
                      <tr>
                        <td colSpan={isAdmin ? 10 : 9} className="px-4 py-3 bg-slate-50">
                          <div className="border border-slate-200 rounded-lg bg-white p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h5 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                <Users className="w-4 h-4 text-capul-600" />
                                Funcionários Atribuídos
                                {lic.quantidade && (
                                  <span className="text-xs font-normal text-slate-500">
                                    ({licencaFuncionarios.length}/{lic.quantidade})
                                  </span>
                                )}
                              </h5>
                              {lic.quantidade && (
                                <div className="w-32 bg-slate-200 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full transition-all ${
                                      licencaFuncionarios.length >= lic.quantidade ? 'bg-red-500' : 'bg-capul-500'
                                    }`}
                                    style={{ width: `${Math.min((licencaFuncionarios.length / lic.quantidade) * 100, 100)}%` }}
                                  />
                                </div>
                              )}
                            </div>

                            {loadingUsuarios ? (
                              <p className="text-sm text-slate-400">Carregando...</p>
                            ) : (
                              <>
                                {/* Atribuir por matrícula (funcionário Protheus, sem senha) */}
                                {isAdmin && lic.status === 'ATIVA' && (
                                  <>
                                    <div className="flex flex-wrap gap-2 mb-1">
                                      <input
                                        type="text"
                                        value={matriculaInput}
                                        onChange={(e) => setMatriculaInput(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleAtribuir(lic.id); }}
                                        placeholder="Matrícula"
                                        className="w-32 border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-capul-600"
                                      />
                                      <input
                                        type="text"
                                        value={nomeInput}
                                        onChange={(e) => setNomeInput(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleAtribuir(lic.id); }}
                                        placeholder="Nome do funcionário"
                                        className="flex-1 min-w-[160px] border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-capul-600"
                                      />
                                      <button
                                        onClick={() => handleAtribuir(lic.id)}
                                        disabled={!matriculaInput.trim() || !nomeInput.trim() || savingUsuario || (lic.quantidade != null && licencaFuncionarios.length >= lic.quantidade)}
                                        className="flex items-center gap-1 bg-capul-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-capul-700 disabled:opacity-50"
                                      >
                                        <UserPlus className="w-3.5 h-3.5" />
                                        {savingUsuario ? 'Atribuindo...' : 'Atribuir'}
                                      </button>
                                    </div>
                                    <p className="text-xs text-slate-400 mb-3">Informe a matrícula e o nome do funcionário.</p>
                                  </>
                                )}

                                {/* Lista de funcionários atribuídos */}
                                {licencaFuncionarios.length === 0 ? (
                                  <p className="text-sm text-slate-400 text-center py-2">Nenhum funcionário atribuído</p>
                                ) : (
                                  <div className="space-y-1">
                                    {licencaFuncionarios.map((lf) => (
                                      <div key={lf.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-slate-50">
                                        <div className="flex items-center gap-3">
                                          <div className="w-7 h-7 rounded-full bg-capul-100 text-capul-700 flex items-center justify-center text-xs font-semibold">
                                            {(lf.nome || lf.matricula).charAt(0).toUpperCase()}
                                          </div>
                                          <div>
                                            <span className="text-sm font-medium text-slate-800">{lf.nome}</span>
                                            <span className="text-xs text-slate-400 ml-2">mat. {lf.matricula}</span>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                          <span className="text-xs text-slate-400">
                                            {new Date(lf.createdAt).toLocaleDateString('pt-BR')}
                                          </span>
                                          {isAdmin && (
                                            <button
                                              onClick={() => handleDesatribuir(lic.id, lf.matricula)}
                                              className="text-red-400 hover:text-red-600"
                                              title="Remover funcionário"
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

