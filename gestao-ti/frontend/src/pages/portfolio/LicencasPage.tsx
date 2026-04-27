import React, { useEffect, useState, useCallback } from 'react';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { licencaService } from '../../services/licenca.service';
import { softwareService } from '../../services/software.service';
import { KeyRound, AlertTriangle, Download, Plus, X, Search } from 'lucide-react';
import { exportService } from '../../services/export.service';
import type { SoftwareLicenca, Software, StatusLicenca, CategoriaLicenca } from '../../types';

import { formatDateBR } from '../../utils/date';
import { useToast } from '../../components/Toast';
import { Paginator } from '../../components/Paginator';

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
  const isAdmin = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');
  const { toast, confirm } = useToast();

  const [licencas, setLicencas] = useState<SoftwareLicenca[]>([]);
  // Paginação 23/04/2026
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [totalLicencas, setTotalLicencas] = useState<number>(0);
  const [categorias, setCategorias] = useState<CategoriaLicenca[]>([]);
  const [softwares, setSoftwares] = useState<Software[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<StatusLicenca | ''>('');
  const [filtroSoftware, setFiltroSoftware] = useState('');
  const [filtroVencendo, setFiltroVencendo] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');

  // Form fields
  const [formTipo, setFormTipo] = useState<'software' | 'avulsa'>('avulsa');
  const [formSoftwareId, setFormSoftwareId] = useState('');
  const [formNome, setFormNome] = useState('');
  const [formCategoria, setFormCategoria] = useState('');
  const [formModelo, setFormModelo] = useState('');
  const [formQtd, setFormQtd] = useState('');
  const [formFornecedor, setFormFornecedor] = useState('');
  const [formValorTotal, setFormValorTotal] = useState('');
  const [formValorUnitario, setFormValorUnitario] = useState('');
  const [formDataInicio, setFormDataInicio] = useState('');
  const [formDataVencimento, setFormDataVencimento] = useState('');
  const [formChaveSerial, setFormChaveSerial] = useState('');
  const [formObservacoes, setFormObservacoes] = useState('');

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editModelo, setEditModelo] = useState('');
  const [editQtd, setEditQtd] = useState('');
  const [editFornecedor, setEditFornecedor] = useState('');
  const [editValorTotal, setEditValorTotal] = useState('');
  const [editValorUnitario, setEditValorUnitario] = useState('');
  const [editDataInicio, setEditDataInicio] = useState('');
  const [editDataVencimento, setEditDataVencimento] = useState('');
  const [editChaveSerial, setEditChaveSerial] = useState('');
  const [editObservacoes, setEditObservacoes] = useState('');
  const [editNome, setEditNome] = useState('');
  const [editCategoriaId, setEditCategoriaId] = useState('');

  useEffect(() => {
    softwareService.listar().then(setSoftwares).catch(() => {});
    licencaService.listarCategorias().then(setCategorias).catch(() => {});
  }, []);

  const carregarLicencas = useCallback(() => {
    setLoading(true);
    licencaService
      .listarPaginado({
        status: filtroStatus || undefined,
        softwareId: filtroSoftware || undefined,
        vencendoEm: filtroVencendo ? parseInt(filtroVencendo) : undefined,
        categoriaId: filtroCategoria || undefined,
        page,
        pageSize,
      })
      .then((res) => {
        setLicencas(res.items);
        setTotalLicencas(res.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filtroStatus, filtroSoftware, filtroVencendo, filtroCategoria, page, pageSize]);

  // Volta pra página 1 ao mudar filtro.
  useEffect(() => { setPage(1); }, [filtroStatus, filtroSoftware, filtroVencendo, filtroCategoria, pageSize]);

  useEffect(() => {
    carregarLicencas();
  }, [carregarLicencas]);

  function isVencendo(lic: SoftwareLicenca) {
    if (!lic.dataVencimento || lic.status !== 'ATIVA') return false;
    const diff = new Date(lic.dataVencimento).getTime() - Date.now();
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
  }

  function getNomeLicenca(lic: SoftwareLicenca) {
    if (lic.software) return lic.software.nome;
    return lic.nome || 'Licenca avulsa';
  }

  function getSubtitle(lic: SoftwareLicenca) {
    if (lic.software?.fabricante) return lic.software.fabricante;
    if (lic.categoria) return lic.categoria.nome;
    return null;
  }

  function startEdit(lic: SoftwareLicenca) {
    setEditingId(lic.id);
    setEditModelo(lic.modeloLicenca || '');
    setEditQtd(lic.quantidade != null ? String(lic.quantidade) : '');
    setEditFornecedor(lic.fornecedor || '');
    setEditValorTotal(lic.valorTotal != null ? String(lic.valorTotal) : '');
    setEditValorUnitario(lic.valorUnitario != null ? String(lic.valorUnitario) : '');
    setEditDataInicio(lic.dataInicio ? lic.dataInicio.slice(0, 10) : '');
    setEditDataVencimento(lic.dataVencimento ? lic.dataVencimento.slice(0, 10) : '');
    setEditChaveSerial(lic.chaveSerial || '');
    setEditObservacoes(lic.observacoes || '');
    setEditNome(lic.nome || '');
    setEditCategoriaId(lic.categoriaId || '');
  }

  async function handleSaveEdit() {
    if (!editingId) return;
    setSaving(true);
    try {
      await licencaService.atualizar(editingId, {
        nome: editNome || undefined,
        categoriaId: editCategoriaId || undefined,
        modeloLicenca: editModelo || undefined,
        quantidade: editQtd ? parseInt(editQtd) : undefined,
        fornecedor: editFornecedor || undefined,
        valorTotal: editValorTotal ? parseFloat(editValorTotal) : undefined,
        valorUnitario: editValorUnitario ? parseFloat(editValorUnitario) : undefined,
        dataInicio: editDataInicio || undefined,
        dataVencimento: editDataVencimento || undefined,
        chaveSerial: editChaveSerial || undefined,
        observacoes: editObservacoes || undefined,
      });
      setEditingId(null);
      carregarLicencas();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFormError(msg || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function handleExcluir(licId: string) {
    if (!await confirm('Excluir Licenca', 'Deseja realmente excluir esta licenca?', { variant: 'danger' })) return;
    try {
      await licencaService.excluir(licId);
      carregarLicencas();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast('error', msg || 'Erro ao excluir licenca');
    }
  }

  async function handleRenovar(licId: string) {
    await licencaService.renovar(licId);
    carregarLicencas();
  }

  async function handleInativar(licId: string) {
    await licencaService.inativar(licId);
    carregarLicencas();
  }

  function resetForm() {
    setFormTipo('avulsa');
    setFormSoftwareId('');
    setFormNome('');
    setFormCategoria('');
    setFormModelo('');
    setFormQtd('');
    setFormFornecedor('');
    setFormValorTotal('');
    setFormValorUnitario('');
    setFormDataInicio('');
    setFormDataVencimento('');
    setFormChaveSerial('');
    setFormObservacoes('');
    setFormError('');
  }

  async function handleCriar() {
    setFormError('');
    if (formTipo === 'software' && !formSoftwareId) {
      setFormError('Selecione o software');
      return;
    }
    if (formTipo === 'avulsa' && !formNome.trim()) {
      setFormError('Informe o nome da licenca');
      return;
    }

    setSaving(true);
    try {
      await licencaService.criar({
        softwareId: formTipo === 'software' ? formSoftwareId : undefined,
        nome: formTipo === 'avulsa' ? formNome.trim() : undefined,
        categoriaId: formTipo === 'avulsa' && formCategoria ? formCategoria : undefined,
        modeloLicenca: formModelo || undefined,
        quantidade: formQtd ? parseInt(formQtd) : undefined,
        fornecedor: formFornecedor || undefined,
        valorTotal: formValorTotal ? parseFloat(formValorTotal) : undefined,
        valorUnitario: formValorUnitario ? parseFloat(formValorUnitario) : undefined,
        dataInicio: formDataInicio || undefined,
        dataVencimento: formDataVencimento || undefined,
        chaveSerial: formChaveSerial || undefined,
        observacoes: formObservacoes || undefined,
      });
      setShowForm(false);
      resetForm();
      carregarLicencas();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFormError(msg || 'Erro ao criar licenca');
    } finally {
      setSaving(false);
    }
  }

  const licencasFiltradas = licencas.filter((l) => {
    if (!busca.trim()) return true;
    const termo = busca.toLowerCase();
    const nomeLic = l.software?.nome || l.nome || '';
    return nomeLic.toLowerCase().includes(termo) || (l.fornecedor?.toLowerCase().includes(termo));
  });

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
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => { setShowForm(!showForm); if (!showForm) resetForm(); }}
                className="flex items-center gap-2 bg-capul-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-capul-700 transition-colors"
              >
                <Plus className="w-4 h-4" /> Nova Licenca
              </button>
            )}
            <button
              onClick={() => exportService.exportar('licencas')}
              className="flex items-center gap-2 bg-slate-100 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
            >
              <Download className="w-4 h-4" /> Exportar
            </button>
          </div>
        </div>

        {/* Formulario Nova Licenca */}
        {showForm && (
          <div className="bg-white rounded-xl border border-capul-200 p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-slate-700">Nova Licenca</h4>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tipo: Software ou Avulsa */}
            <div className="flex gap-4 mb-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" checked={formTipo === 'avulsa'} onChange={() => setFormTipo('avulsa')} className="accent-capul-600" />
                Licenca Avulsa (Certificado, Dominio, etc.)
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" checked={formTipo === 'software'} onChange={() => setFormTipo('software')} className="accent-capul-600" />
                Vinculada a Software
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              {formTipo === 'software' ? (
                <select value={formSoftwareId} onChange={(e) => setFormSoftwareId(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">Selecione o software *</option>
                  {softwares.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              ) : (
                <>
                  <input type="text" placeholder="Nome da licenca *" value={formNome} onChange={(e) => setFormNome(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                  <select value={formCategoria} onChange={(e) => setFormCategoria(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">Categoria</option>
                    {categorias.filter(c => c.status === 'ATIVO').map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </>
              )}
              <select value={formModelo} onChange={(e) => setFormModelo(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
                <option value="">Modelo</option>
                {Object.entries(modeloLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <input type="number" min="1" placeholder="Quantidade" value={formQtd} onChange={(e) => setFormQtd(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              <input type="text" placeholder="Fornecedor" value={formFornecedor} onChange={(e) => setFormFornecedor(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              <input type="number" step="0.01" min="0" placeholder="Valor Total" value={formValorTotal} onChange={(e) => setFormValorTotal(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              <input type="number" step="0.01" min="0" placeholder="Valor Unitario" value={formValorUnitario} onChange={(e) => setFormValorUnitario(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Inicio</label>
                <input type="date" value={formDataInicio} onChange={(e) => setFormDataInicio(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Vencimento</label>
                <input type="date" value={formDataVencimento} onChange={(e) => setFormDataVencimento(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full" />
              </div>
              <input type="text" placeholder="Chave Serial" value={formChaveSerial} onChange={(e) => setFormChaveSerial(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              <input type="text" placeholder="Observacoes" value={formObservacoes} onChange={(e) => setFormObservacoes(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>

            {formError && <p className="text-xs text-red-600 mb-2">{formError}</p>}

            <div className="flex justify-end">
              <button onClick={handleCriar} disabled={saving} className="bg-capul-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-capul-700 disabled:opacity-50">
                {saving ? 'Salvando...' : 'Criar Licenca'}
              </button>
            </div>
          </div>
        )}

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
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por licenca ou fornecedor..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm bg-white w-64"
            />
          </div>
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
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">Todas as categorias</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
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
        ) : licencasFiltradas.length === 0 ? (
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
                    <th className="px-4 py-3 font-medium text-slate-600">Licenca</th>
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
                  {licencasFiltradas.map((lic) => (
                    <React.Fragment key={lic.id}>
                    <tr className={`hover:bg-slate-50 ${isVencendo(lic) ? 'bg-amber-50' : ''}`}>
                      <td className="px-4 py-3">
                        {lic.software ? (
                          <a
                            href={`/gestao-ti/softwares/${lic.softwareId}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-capul-600 hover:underline font-medium"
                          >
                            {lic.software.nome}
                          </a>
                        ) : (
                          <span className="font-medium text-slate-700">{getNomeLicenca(lic)}</span>
                        )}
                        {getSubtitle(lic) && (
                          <p className="text-xs text-slate-400">{getSubtitle(lic)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {lic.modeloLicenca ? modeloLabel[lic.modeloLicenca] || lic.modeloLicenca : '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{lic.quantidade ?? '-'}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {lic.modeloLicenca && ['POR_USUARIO', 'SUBSCRICAO', 'SAAS'].includes(lic.modeloLicenca)
                          ? <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{lic._count?.usuarios ?? 0}/{lic.quantidade ?? '\u221E'}</span>
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
                            <button onClick={() => startEdit(lic)} className="text-xs text-capul-600 hover:underline">Editar</button>
                            {lic.status === 'ATIVA' && (
                              <>
                                <button onClick={() => handleRenovar(lic.id)} className="text-xs text-capul-600 hover:underline">Renovar</button>
                                <button onClick={() => handleInativar(lic.id)} className="text-xs text-slate-500 hover:underline">Inativar</button>
                              </>
                            )}
                            <button onClick={() => handleExcluir(lic.id)} className="text-xs text-red-500 hover:underline">Excluir</button>
                          </div>
                        </td>
                      )}
                    </tr>
                    {editingId === lic.id && (
                      <tr className="bg-amber-50">
                        <td colSpan={isAdmin ? 11 : 10} className="px-4 py-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                            {!lic.software && (
                              <>
                                <input type="text" placeholder="Nome" value={editNome} onChange={(e) => setEditNome(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                                <select value={editCategoriaId} onChange={(e) => setEditCategoriaId(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
                                  <option value="">Categoria</option>
                                  {categorias.filter(c => c.status === 'ATIVO').map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                </select>
                              </>
                            )}
                            <select value={editModelo} onChange={(e) => setEditModelo(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
                              <option value="">Modelo</option>
                              {Object.entries(modeloLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                            <input type="number" min="1" placeholder="Quantidade" value={editQtd} onChange={(e) => setEditQtd(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                            <input type="text" placeholder="Fornecedor" value={editFornecedor} onChange={(e) => setEditFornecedor(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                            <input type="number" step="0.01" min="0" placeholder="Valor Total" value={editValorTotal} onChange={(e) => setEditValorTotal(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                            <input type="number" step="0.01" min="0" placeholder="Valor Unitario" value={editValorUnitario} onChange={(e) => setEditValorUnitario(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                            <input type="text" placeholder="Chave Serial" value={editChaveSerial} onChange={(e) => setEditChaveSerial(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                            <div>
                              <label className="text-xs text-slate-500 mb-1 block">Inicio</label>
                              <input type="date" value={editDataInicio} onChange={(e) => setEditDataInicio(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full" />
                            </div>
                            <div>
                              <label className="text-xs text-slate-500 mb-1 block">Vencimento</label>
                              <input type="date" value={editDataVencimento} onChange={(e) => setEditDataVencimento(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full" />
                            </div>
                            <input type="text" placeholder="Observacoes" value={editObservacoes} onChange={(e) => setEditObservacoes(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm col-span-2" />
                          </div>
                          {formError && <p className="text-xs text-red-600 mb-2">{formError}</p>}
                          <div className="flex justify-end gap-2">
                            <button onClick={() => { setEditingId(null); setFormError(''); }} className="text-xs text-slate-500 hover:underline">Cancelar</button>
                            <button onClick={handleSaveEdit} disabled={saving} className="bg-capul-600 text-white px-4 py-1.5 rounded-lg text-xs hover:bg-capul-700 disabled:opacity-50">
                              {saving ? 'Salvando...' : 'Salvar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            {!loading && (
              <Paginator
                total={totalLicencas}
                shownCount={licencas.length}
                page={page}
                setPage={setPage}
                pageSize={pageSize}
                setPageSize={setPageSize}
                labelSingular="licença"
                labelPlural="licenças"
              />
            )}
          </div>
        )}
      </div>
    </>
  );
}
