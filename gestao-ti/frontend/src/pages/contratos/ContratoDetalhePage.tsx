import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { contratoService } from '../../services/contrato.service';
import { coreService } from '../../services/core.service';
import { licencaService } from '../../services/licenca.service';
import {
  ArrowLeft, Edit3, RefreshCw, Receipt, PieChart, KeyRound, Clock,
  X, FileText, Upload, Download, Trash2, Printer,
  ChevronDown, ChevronRight, Copy, Zap, Pencil, Check,
} from 'lucide-react';
import type {
  Contrato,
  StatusContrato,
  ParcelaContrato,
  ContratoHistorico,
  SoftwareLicenca,
  CentroCusto,
  NaturezaContrato,
  ModalidadeRateio,
  RateioTemplate,
  AnexoContrato,
  ContratoRenovacaoReg,
  ParcelaRateioItem,
} from '../../types';

// ─── Helpers ────────────────────────────────────────────────

function fmtCurrency(v: number | null | undefined): string {
  return `R$ ${Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '-';
  // Usar split para evitar problema de timezone UTC-3
  const dateStr = d.substring(0, 10); // "2026-03-17"
  const [y, m, day] = dateStr.split('-');
  return `${day}/${m}/${y}`;
}

function fmtDateTime(d: string): string {
  return new Date(d).toLocaleString('pt-BR');
}

function fmtFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extractErrorMsg(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data;
  if (!data?.message) return fallback;
  return Array.isArray(data.message) ? data.message.join('. ') : data.message;
}

// ─── ConfirmModal ───────────────────────────────────────────

function ConfirmModal({ open, title, message, onConfirm, onCancel }: {
  open: boolean; title: string; message: string; onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-2">{title}</h3>
        <p className="text-sm text-slate-600 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancelar</button>
          <button onClick={onConfirm} className="px-4 py-2 bg-capul-600 text-white rounded-lg text-sm font-medium hover:bg-capul-700">Confirmar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Toast hook ─────────────────────────────────────────────

function useToast() {
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const show = useCallback((type: 'success' | 'error', message: string) => setToast({ type, message }), []);
  const el = toast ? (
    <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
      {toast.message}
    </div>
  ) : null;
  return { show, el };
}

// ─── Constants ──────────────────────────────────────────────

const statusCores: Record<string, string> = {
  ATIVO: 'bg-green-100 text-green-700',
  SUSPENSO: 'bg-yellow-100 text-yellow-700',
  VENCIDO: 'bg-red-100 text-red-700',
  RENOVADO: 'bg-blue-100 text-blue-700',
  CANCELADO: 'bg-slate-200 text-slate-500',
};

const statusLabels: Record<string, string> = {
  ATIVO: 'Ativo', SUSPENSO: 'Suspenso',
  VENCIDO: 'Vencido', RENOVADO: 'Renovado', CANCELADO: 'Cancelado',
};

const parcelaStatusCores: Record<string, string> = {
  PENDENTE: 'bg-yellow-100 text-yellow-700',
  PAGA: 'bg-green-100 text-green-700',
  ATRASADA: 'bg-red-100 text-red-700',
  CANCELADA: 'bg-slate-200 text-slate-500',
};

const modalidadeLabels: Record<string, string> = {
  PERCENTUAL_CUSTOMIZADO: 'Percentual Customizado',
  VALOR_FIXO: 'Valor Fixo',
  PROPORCIONAL_CRITERIO: 'Proporcional por Criterio',
  IGUALITARIO: 'Igualitario',
  SEM_RATEIO: 'Sem Rateio',
};

const TRANSICOES: Record<string, StatusContrato[]> = {
  ATIVO: ['SUSPENSO', 'VENCIDO', 'CANCELADO'],
  SUSPENSO: ['ATIVO', 'CANCELADO'],
  VENCIDO: ['RENOVADO', 'ATIVO'],
  CANCELADO: ['ATIVO'],
};

type Tab = 'geral' | 'parcelas' | 'rateio' | 'licencas' | 'renovacoes' | 'historico';

// ─── Main Page ──────────────────────────────────────────────

export function ContratoDetalhePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { gestaoTiRole } = useAuth();
  const canManage = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');
  const toast = useToast();

  const [contrato, setContrato] = useState<Contrato | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('geral');

  // Confirm modal state
  const [confirmState, setConfirmState] = useState<{
    title: string; message: string; resolve: (v: boolean) => void;
  } | null>(null);

  const confirm = useCallback((title: string, message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({ title, message, resolve });
    });
  }, []);

  const handleConfirmOk = useCallback(() => {
    confirmState?.resolve(true);
    setConfirmState(null);
  }, [confirmState]);

  const handleConfirmCancel = useCallback(() => {
    confirmState?.resolve(false);
    setConfirmState(null);
  }, [confirmState]);

  // Renovar modal
  const [showRenovar, setShowRenovar] = useState(false);
  const [renovarForm, setRenovarForm] = useState({
    indiceReajuste: '', percentualReajuste: '', novoValorTotal: '',
    novaDataInicio: '', novaDataFim: '', gerarParcelas: false,
    quantidadeParcelas: '', primeiroVencimento: '',
  });
  const [renovando, setRenovando] = useState(false);

  async function load() {
    if (!id) return;
    try {
      const data = await contratoService.buscar(id);
      setContrato(data);
    } catch {
      toast.show('error', 'Erro ao carregar contrato');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function handleStatus(status: StatusContrato) {
    if (!id) return;
    const ok = await confirm('Alterar Status', `Deseja alterar o status para "${statusLabels[status]}"?`);
    if (!ok) return;
    try {
      const data = await contratoService.alterarStatus(id, status);
      setContrato(data);
      toast.show('success', `Status alterado para ${statusLabels[status]}`);
    } catch (err) {
      toast.show('error', extractErrorMsg(err, 'Erro ao alterar status'));
    }
  }

  async function handleRenovar() {
    if (!id) return;
    setRenovando(true);
    try {
      const payload: Record<string, unknown> = {};
      if (renovarForm.indiceReajuste) payload.indiceReajuste = renovarForm.indiceReajuste;
      if (renovarForm.percentualReajuste) payload.percentualReajuste = parseFloat(renovarForm.percentualReajuste);
      if (renovarForm.novoValorTotal) payload.novoValorTotal = parseFloat(renovarForm.novoValorTotal);
      if (renovarForm.novaDataInicio) payload.novaDataInicio = renovarForm.novaDataInicio;
      if (renovarForm.novaDataFim) payload.novaDataFim = renovarForm.novaDataFim;
      if (renovarForm.gerarParcelas) {
        payload.gerarParcelas = true;
        if (renovarForm.quantidadeParcelas) payload.quantidadeParcelas = parseInt(renovarForm.quantidadeParcelas, 10);
        if (renovarForm.primeiroVencimento) payload.primeiroVencimento = renovarForm.primeiroVencimento;
      }
      const novo = await contratoService.renovar(id, payload as Parameters<typeof contratoService.renovar>[1]);
      toast.show('success', 'Contrato renovado com sucesso');
      setShowRenovar(false);
      navigate(`/gestao-ti/contratos/${novo.id}`);
    } catch (err) {
      toast.show('error', extractErrorMsg(err, 'Erro ao renovar contrato'));
    } finally {
      setRenovando(false);
    }
  }

  if (loading) return <><Header title="Contrato" /><div className="p-6"><p className="text-slate-500">Carregando...</p></div></>;
  if (!contrato) return <><Header title="Contrato" /><div className="p-6"><p className="text-red-500">Contrato nao encontrado</p></div></>;

  const finalizado = ['RENOVADO', 'CANCELADO'].includes(contrato.status);
  const transicoesPermitidas = TRANSICOES[contrato.status] || [];

  const tabs: { key: Tab; label: string; icon: typeof Receipt }[] = [
    { key: 'geral', label: 'Geral', icon: FileText },
    { key: 'parcelas', label: 'Parcelas', icon: Receipt },
    { key: 'rateio', label: 'Rateio Template', icon: PieChart },
    { key: 'licencas', label: 'Licencas', icon: KeyRound },
    { key: 'renovacoes', label: 'Renovacoes', icon: RefreshCw },
    { key: 'historico', label: 'Historico', icon: Clock },
  ];

  return (
    <>
      <Header title={`Contrato #${contrato.numero}`} />
      {toast.el}
      <ConfirmModal
        open={!!confirmState}
        title={confirmState?.title || ''}
        message={confirmState?.message || ''}
        onConfirm={handleConfirmOk}
        onCancel={handleConfirmCancel}
      />

      {/* Renovar Modal */}
      {showRenovar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-lg max-w-lg w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Renovar Contrato</h3>
            <div className="space-y-3">
              {contrato.modalidadeValor === 'FIXO' ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Indice Reajuste</label>
                      <input value={renovarForm.indiceReajuste}
                        onChange={(e) => setRenovarForm({ ...renovarForm, indiceReajuste: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Ex: IGPM, IPCA" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">% Reajuste</label>
                      <input type="number" step="0.01" value={renovarForm.percentualReajuste}
                        onChange={(e) => setRenovarForm({ ...renovarForm, percentualReajuste: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Ex: 5.5" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">OU Novo Valor Total (R$)</label>
                    <input type="number" step="0.01" value={renovarForm.novoValorTotal}
                      onChange={(e) => setRenovarForm({ ...renovarForm, novoValorTotal: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Sobrescreve o percentual" />
                  </div>
                </>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs text-amber-700">Contrato com valor variavel — nao possui percentual de reajuste. Os valores das parcelas serao definidos individualmente.</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Nova Data Inicio</label>
                  <input type="date" value={renovarForm.novaDataInicio}
                    onChange={(e) => setRenovarForm({ ...renovarForm, novaDataInicio: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Nova Data Fim</label>
                  <input type="date" value={renovarForm.novaDataFim}
                    onChange={(e) => setRenovarForm({ ...renovarForm, novaDataFim: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="border-t border-slate-200 pt-3">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={renovarForm.gerarParcelas}
                    onChange={(e) => setRenovarForm({ ...renovarForm, gerarParcelas: e.target.checked })}
                    className="rounded border-slate-300" />
                  Gerar parcelas automaticamente
                </label>
                {renovarForm.gerarParcelas && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Quantidade de Parcelas</label>
                      <input type="number" min="1" value={renovarForm.quantidadeParcelas}
                        onChange={(e) => setRenovarForm({ ...renovarForm, quantidadeParcelas: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Primeiro Vencimento</label>
                      <input type="date" value={renovarForm.primeiroVencimento}
                        onChange={(e) => setRenovarForm({ ...renovarForm, primeiroVencimento: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowRenovar(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancelar</button>
              <button onClick={handleRenovar} disabled={renovando}
                className="px-4 py-2 bg-capul-600 text-white rounded-lg text-sm font-medium hover:bg-capul-700 disabled:opacity-50">
                {renovando ? 'Renovando...' : 'Renovar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="p-6">
        <button onClick={() => navigate('/gestao-ti/contratos')}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        {/* Header info */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-xl font-bold text-slate-800">{contrato.titulo}</h2>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusCores[contrato.status]}`}>
                  {statusLabels[contrato.status]}
                </span>
              </div>
              <p className="text-sm text-slate-500">
                {contrato.tipoContrato?.nome || '-'}
                {contrato.fornecedorRef ? ` | Fornecedor: ${contrato.fornecedorRef.nome} (${contrato.fornecedorRef.codigo}${contrato.fornecedorRef.loja ? `/${contrato.fornecedorRef.loja}` : ''})` : contrato.fornecedor ? ` | Fornecedor: ${contrato.fornecedor}` : ''}
              </p>
              {contrato.software && (
                <p className="text-sm text-slate-500 mt-1">
                  Software: <a href={`/gestao-ti/softwares/${contrato.software.id}`} target="_blank" rel="noopener noreferrer" className="text-capul-600 hover:underline">{contrato.software.nome}</a>
                </p>
              )}
              {contrato.contratoOriginal && (
                <p className="text-sm text-slate-500 mt-1">
                  Renovacao de: <Link to={`/gestao-ti/contratos/${contrato.contratoOriginal.id}`} className="text-capul-600 hover:underline">
                    #{contrato.contratoOriginal.numero} - {contrato.contratoOriginal.titulo}
                  </Link>
                </p>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-slate-500">
                {contrato.filial && <span>Filial: {contrato.filial.codigo} - {contrato.filial.nomeFantasia}</span>}
                {contrato.numeroContrato && <span>Nro: {contrato.numeroContrato}</span>}
                <span>Modalidade: {contrato.modalidadeValor === 'FIXO' ? 'Valor Fixo' : 'Valor Variavel'}</span>
              </div>
            </div>
            {canManage && !finalizado && (
              <div className="flex items-center gap-2">
                <Link to={`/gestao-ti/contratos/${contrato.id}/editar`}
                  className="flex items-center gap-1 text-sm text-slate-600 border border-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-50">
                  <Edit3 className="w-3.5 h-3.5" /> Editar
                </Link>
                {(contrato.status === 'ATIVO' || contrato.status === 'VENCIDO') && (
                  <button onClick={() => setShowRenovar(true)}
                    className="flex items-center gap-1 text-sm text-capul-600 border border-capul-300 px-3 py-1.5 rounded-lg hover:bg-capul-50">
                    <RefreshCw className="w-3.5 h-3.5" /> Renovar
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Valor Total</p>
              <p className="font-semibold text-slate-800">{fmtCurrency(contrato.valorTotal)}</p>
            </div>
            {contrato.valorMensal != null && (
              <div>
                <p className="text-slate-500">Valor Mensal</p>
                <p className="font-semibold text-slate-800">{fmtCurrency(contrato.valorMensal)}</p>
              </div>
            )}
            <div>
              <p className="text-slate-500">Vigencia</p>
              <p className="font-semibold text-slate-800">{fmtDate(contrato.dataInicio)} - {fmtDate(contrato.dataFim)}</p>
            </div>
            <div>
              <p className="text-slate-500">Parcelas / Licencas / Anexos</p>
              <p className="font-semibold text-slate-800">{contrato._count.parcelas} / {contrato._count.licencas} / {contrato._count.anexos}</p>
            </div>
          </div>

          {canManage && transicoesPermitidas.length > 0 && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-200">
              <span className="text-xs text-slate-500">Alterar status:</span>
              {transicoesPermitidas.map((s) => (
                <button key={s} onClick={() => handleStatus(s)}
                  className={`text-xs px-3 py-1 rounded-full border ${statusCores[s]} hover:opacity-80`}>
                  {statusLabels[s]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-slate-200 overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab === t.key ? 'border-capul-600 text-capul-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}>
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            );
          })}
        </div>

        {tab === 'geral' && <TabGeral contrato={contrato} canManage={canManage} onReload={load} toast={toast} confirm={confirm} />}
        {tab === 'parcelas' && <TabParcelas contrato={contrato} canManage={canManage} onReload={load} toast={toast} confirm={confirm} />}
        {tab === 'rateio' && <TabRateioTemplate contrato={contrato} canManage={canManage} onReload={load} toast={toast} />}
        {tab === 'licencas' && <TabLicencas contrato={contrato} canManage={canManage} onReload={load} toast={toast} confirm={confirm} />}
        {tab === 'renovacoes' && <TabRenovacoes contrato={contrato} />}
        {tab === 'historico' && <TabHistorico historicos={contrato.historicos || []} />}
      </div>
    </>
  );
}

// ─── Types for shared props ─────────────────────────────────

interface TabProps {
  contrato: Contrato;
  canManage: boolean;
  onReload: () => void;
  toast: { show: (type: 'success' | 'error', message: string) => void };
}

interface TabPropsWithConfirm extends TabProps {
  confirm: (title: string, message: string) => Promise<boolean>;
}

// ─── Tab Geral ──────────────────────────────────────────────

function TabGeral({ contrato, canManage, onReload, toast, confirm }: TabPropsWithConfirm) {
  const finalizado = ['RENOVADO', 'CANCELADO'].includes(contrato.status);
  const [anexos, setAnexos] = useState<AnexoContrato[]>(contrato.anexos || []);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    contratoService.listarAnexos(contrato.id).then(setAnexos).catch(() => {});
  }, [contrato.id]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await contratoService.uploadAnexo(contrato.id, file);
      const updated = await contratoService.listarAnexos(contrato.id);
      setAnexos(updated);
      toast.show('success', 'Anexo enviado com sucesso');
      onReload();
    } catch (err) {
      toast.show('error', extractErrorMsg(err, 'Erro ao enviar anexo'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDownload(anexo: AnexoContrato) {
    try {
      const blob = await contratoService.downloadAnexo(contrato.id, anexo.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = anexo.nomeOriginal;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.show('error', 'Erro ao baixar anexo');
    }
  }

  async function handleExcluirAnexo(anexo: AnexoContrato) {
    const ok = await confirm('Excluir Anexo', `Deseja excluir o arquivo "${anexo.nomeOriginal}"?`);
    if (!ok) return;
    try {
      await contratoService.excluirAnexo(contrato.id, anexo.id);
      setAnexos((prev) => prev.filter((a) => a.id !== anexo.id));
      toast.show('success', 'Anexo excluido');
      onReload();
    } catch (err) {
      toast.show('error', extractErrorMsg(err, 'Erro ao excluir anexo'));
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h4 className="font-semibold text-slate-700 mb-4">Informacoes do Contrato</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <InfoItem label="Tipo Contrato" value={contrato.tipoContrato?.nome || '-'} />
          <InfoItem label="Fornecedor" value={contrato.fornecedorRef ? `${contrato.fornecedorRef.codigo}${contrato.fornecedorRef.loja ? `/${contrato.fornecedorRef.loja}` : ''} — ${contrato.fornecedorRef.nome}` : contrato.fornecedor || '-'} />
          <InfoItem label="Produto (ERP)" value={contrato.produtoRef ? `${contrato.produtoRef.codigo} — ${contrato.produtoRef.descricao}` : contrato.codigoProduto ? `${contrato.codigoProduto}${contrato.descricaoProduto ? ` — ${contrato.descricaoProduto}` : ''}` : '-'} />
          <InfoItem label="Filial" value={contrato.filial ? `${contrato.filial.codigo} - ${contrato.filial.nomeFantasia}` : '-'} />
          <InfoItem label="Software" value={contrato.software?.nome || '-'} />
          <InfoItem label="Numero Contrato" value={contrato.numeroContrato || '-'} />
          <InfoItem label="Modalidade Valor" value={contrato.modalidadeValor === 'FIXO' ? 'Valor Fixo' : 'Valor Variavel'} />
          <InfoItem label="Valor Total" value={fmtCurrency(contrato.valorTotal)} />
          <InfoItem label="Valor Mensal" value={contrato.valorMensal != null ? fmtCurrency(contrato.valorMensal) : '-'} />
          <InfoItem label="Data Inicio" value={fmtDate(contrato.dataInicio)} />
          <InfoItem label="Data Fim" value={fmtDate(contrato.dataFim)} />
          <InfoItem label="Data Assinatura" value={fmtDate(contrato.dataAssinatura)} />
          <InfoItem label="Data Renovacao" value={fmtDate(contrato.dataRenovacao)} />
          <InfoItem label="Renovacao Automatica" value={contrato.renovacaoAutomatica ? 'Sim' : 'Nao'} />
          <InfoItem label="Alerta Vencimento" value={`${contrato.diasAlertaVencimento} dias`} />
        </div>
        {contrato.descricao && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <p className="text-xs text-slate-500 mb-1">Descricao</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{contrato.descricao}</p>
          </div>
        )}
        {contrato.observacoes && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <p className="text-xs text-slate-500 mb-1">Observacoes</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{contrato.observacoes}</p>
          </div>
        )}
        <div className="mt-4 pt-4 border-t border-slate-200 text-xs text-slate-400">
          Criado em {fmtDateTime(contrato.createdAt)} | Atualizado em {fmtDateTime(contrato.updatedAt)}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h4 className="font-semibold text-slate-700">Anexos ({anexos.length})</h4>
          {canManage && !finalizado && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 text-sm text-capul-600 hover:text-capul-700 font-medium"
            >
              <Upload className="w-4 h-4" />
              {uploading ? 'Enviando...' : 'Anexar Arquivo'}
            </button>
          )}
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
        </div>
        {anexos.length === 0 ? (
          <p className="px-6 py-8 text-sm text-slate-400 text-center">Nenhum anexo</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {anexos.map((a) => (
              <div key={a.id} className="px-6 py-3 flex items-center gap-3">
                <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 truncate">{a.nomeOriginal}</p>
                  <p className="text-xs text-slate-400">{fmtFileSize(a.tamanho)} | {fmtDateTime(a.createdAt)}</p>
                </div>
                <button onClick={() => handleDownload(a)} className="text-slate-400 hover:text-capul-600" title="Download">
                  <Download className="w-4 h-4" />
                </button>
                {canManage && !finalizado && (
                  <button onClick={() => handleExcluirAnexo(a)} className="text-slate-400 hover:text-red-500" title="Excluir">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-500 text-xs">{label}</p>
      <p className="font-medium text-slate-800">{value}</p>
    </div>
  );
}

// ─── Tab Parcelas ───────────────────────────────────────────

function TabParcelas({ contrato, canManage, onReload, toast, confirm }: TabPropsWithConfirm) {
  const parcelas = contrato.parcelas || [];
  const finalizado = ['RENOVADO', 'CANCELADO'].includes(contrato.status);

  const [showForm, setShowForm] = useState(false);
  const [numero, setNumero] = useState(String(parcelas.length + 1));
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [dataVencimento, setDataVencimento] = useState('');
  const [notaFiscal, setNotaFiscal] = useState('');
  const [saving, setSaving] = useState(false);

  // Pagar modal
  const [pagarModal, setPagarModal] = useState<ParcelaContrato | null>(null);
  const [pagarNF, setPagarNF] = useState('');
  const [pagarData, setPagarData] = useState('');
  const [pagando, setPagando] = useState(false);

  // Editing parcela
  const [editingId, setEditingId] = useState<string | null>(null);

  async function handleSaveEdit(p: ParcelaContrato, campos: { descricao?: string; notaFiscal?: string; observacoes?: string; valor?: number; dataVencimento?: string; dataPagamento?: string }) {
    try {
      await contratoService.atualizarParcela(contrato.id, p.id, campos);
      toast.show('success', `Parcela #${p.numero} atualizada`);
      setEditingId(null);
      onReload();
    } catch (err) {
      toast.show('error', extractErrorMsg(err, 'Erro ao atualizar parcela'));
    }
  }

  // Expanded parcela for rateio
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [parcelaRateio, setParcelaRateio] = useState<ParcelaRateioItem[]>([]);
  const [loadingRateio, setLoadingRateio] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const num = parseInt(numero, 10);
      await contratoService.criarParcela(contrato.id, {
        numero: num,
        descricao: descricao || `Parcela ${num}`,
        valor: parseFloat(valor),
        dataVencimento,
        notaFiscal: notaFiscal || undefined,
      });
      setShowForm(false);
      setDescricao('');
      setValor('');
      setDataVencimento('');
      setNotaFiscal('');
      toast.show('success', 'Parcela criada com sucesso');
      onReload();
    } catch (err) {
      toast.show('error', extractErrorMsg(err, 'Erro ao criar parcela'));
    } finally {
      setSaving(false);
    }
  }

  function handlePagar(p: ParcelaContrato) {
    setPagarNF(p.notaFiscal || '');
    setPagarData(new Date().toISOString().slice(0, 10));
    setPagarModal(p);
  }

  async function confirmarPagar() {
    if (!pagarModal) return;
    setPagando(true);
    try {
      await contratoService.pagarParcela(contrato.id, pagarModal.id, {
        notaFiscal: pagarNF || undefined,
        dataPagamento: pagarData || undefined,
      });
      toast.show('success', `Parcela #${pagarModal.numero} paga com sucesso`);
      setPagarModal(null);
      setPagarNF('');
      setPagarData('');
      onReload();
    } catch (err) {
      toast.show('error', extractErrorMsg(err, 'Erro ao pagar parcela'));
    } finally {
      setPagando(false);
    }
  }

  async function handleCancelar(p: ParcelaContrato) {
    const ok = await confirm('Cancelar Parcela', `Deseja cancelar a parcela #${p.numero}? Esta acao nao pode ser desfeita.`);
    if (!ok) return;
    try {
      await contratoService.cancelarParcela(contrato.id, p.id);
      toast.show('success', `Parcela #${p.numero} cancelada`);
      onReload();
    } catch (err) {
      toast.show('error', extractErrorMsg(err, 'Erro ao cancelar parcela'));
    }
  }

  async function toggleExpand(parcelaId: string) {
    if (expandedId === parcelaId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(parcelaId);
    setLoadingRateio(true);
    try {
      const itens = await contratoService.obterRateioParcela(contrato.id, parcelaId);
      setParcelaRateio(itens);
    } catch {
      setParcelaRateio([]);
    } finally {
      setLoadingRateio(false);
    }
  }

  async function handleGerarRateioTemplate(parcelaId: string) {
    try {
      const itens = await contratoService.gerarRateioParcela(contrato.id, parcelaId, true);
      setParcelaRateio(itens);
      toast.show('success', 'Rateio gerado via template');
    } catch (err) {
      toast.show('error', extractErrorMsg(err, 'Erro ao gerar rateio. Verifique se ha template configurado.'));
    }
  }

  async function handleCopiarPendentes(parcelaId: string) {
    const ok = await confirm('Copiar Rateio', 'Deseja copiar o rateio desta parcela para todas as parcelas pendentes?');
    if (!ok) return;
    try {
      const result = await contratoService.copiarRateioParaPendentes(contrato.id, parcelaId);
      toast.show('success', `Rateio copiado para ${result.parcelasCopied} parcela(s)`);
    } catch (err) {
      toast.show('error', extractErrorMsg(err, 'Erro ao copiar rateio'));
    }
  }

  async function handleImprimirRateio(parcelaId: string, parcelaNumero: number) {
    try {
      const blob = await contratoService.downloadRelatorioRateio(contrato.id, parcelaId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Rateio_Contrato${contrato.numero}_Parcela${parcelaNumero}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.show('error', extractErrorMsg(err, 'Erro ao gerar relatorio de rateio'));
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <h4 className="font-semibold text-slate-700">Parcelas ({parcelas.length})</h4>
        {canManage && !finalizado && (
          <button onClick={() => { setShowForm(!showForm); setNumero(String(parcelas.length + 1)); }}
            className="text-xs text-capul-600 hover:underline">{showForm ? 'Cancelar' : '+ Nova Parcela'}</button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1">#</label>
            <input type="number" min="1" value={numero} onChange={(e) => setNumero(e.target.value)} required
              className="w-16 border border-slate-300 rounded px-2 py-1.5 text-sm" />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs text-slate-500 mb-1">Descricao</label>
            <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder={`Parcela ${numero}`}
              className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Valor (R$) *</label>
            <input type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} required
              className="w-32 border border-slate-300 rounded px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Vencimento *</label>
            <input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} required
              className="border border-slate-300 rounded px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Nota Fiscal</label>
            <input value={notaFiscal} onChange={(e) => setNotaFiscal(e.target.value)}
              className="w-32 border border-slate-300 rounded px-2 py-1.5 text-sm" />
          </div>
          <button type="submit" disabled={saving}
            className="bg-capul-600 text-white px-4 py-1.5 rounded text-sm hover:bg-capul-700 disabled:opacity-50">
            {saving ? 'Salvando...' : 'Adicionar'}
          </button>
        </form>
      )}

      {parcelas.length === 0 ? (
        <p className="px-6 py-8 text-sm text-slate-400 text-center">Nenhuma parcela cadastrada</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-slate-600 w-8"></th>
              <th className="text-left px-4 py-2 font-medium text-slate-600">#</th>
              <th className="text-left px-4 py-2 font-medium text-slate-600">Descricao</th>
              <th className="text-right px-4 py-2 font-medium text-slate-600">Valor</th>
              <th className="text-left px-4 py-2 font-medium text-slate-600">Vencimento</th>
              <th className="text-center px-4 py-2 font-medium text-slate-600">Status</th>
              <th className="text-left px-4 py-2 font-medium text-slate-600">NF</th>
              <th className="text-left px-4 py-2 font-medium text-slate-600">Dt. Envio</th>
              {canManage && <th className="text-center px-4 py-2 font-medium text-slate-600">Acoes</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {parcelas.map((p) => (
              <ParcelaRow
                key={p.id}
                parcela={p}
                expanded={expandedId === p.id}
                rateioItens={expandedId === p.id ? parcelaRateio : []}
                loadingRateio={loadingRateio && expandedId === p.id}
                canManage={canManage}
                editing={editingId === p.id}
                onToggle={() => toggleExpand(p.id)}
                onPagar={() => handlePagar(p)}
                onCancelar={() => handleCancelar(p)}
                onEdit={() => setEditingId(p.id)}
                onCancelEdit={() => setEditingId(null)}
                onSaveEdit={(campos) => handleSaveEdit(p, campos)}
                onGerarTemplate={() => handleGerarRateioTemplate(p.id)}
                onCopiarPendentes={() => handleCopiarPendentes(p.id)}
                onImprimirRateio={() => handleImprimirRateio(p.id, p.numero)}
              />
            ))}
          </tbody>
        </table>
      )}

      {/* Modal Pagar Parcela */}
      {pagarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-1">Registrar Pagamento</h3>
            <p className="text-sm text-slate-500 mb-4">
              Parcela #{pagarModal.numero} — {fmtCurrency(pagarModal.valor)} — Venc. {fmtDate(pagarModal.dataVencimento)}
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nota Fiscal</label>
                <input
                  value={pagarNF}
                  onChange={(e) => setPagarNF(e.target.value)}
                  placeholder="Numero da nota fiscal"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-capul-500 focus:border-capul-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Data de Envio</label>
                <input
                  type="date"
                  value={pagarData}
                  onChange={(e) => setPagarData(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-capul-500 focus:border-capul-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => { setPagarModal(null); setPagarNF(''); }}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                disabled={pagando}
              >
                Cancelar
              </button>
              <button
                onClick={confirmarPagar}
                disabled={pagando}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {pagando ? 'Processando...' : 'Confirmar Pagamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ParcelaRow({ parcela: p, expanded, rateioItens, loadingRateio, canManage, editing, onToggle, onPagar, onCancelar, onEdit, onCancelEdit, onSaveEdit, onGerarTemplate, onCopiarPendentes, onImprimirRateio }: {
  parcela: ParcelaContrato;
  expanded: boolean;
  rateioItens: ParcelaRateioItem[];
  loadingRateio: boolean;
  canManage: boolean;
  editing: boolean;
  onToggle: () => void;
  onPagar: () => void;
  onCancelar: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (campos: { descricao?: string; notaFiscal?: string; observacoes?: string; valor?: number; dataVencimento?: string; dataPagamento?: string }) => void;
  onGerarTemplate: () => void;
  onCopiarPendentes: () => void;
  onImprimirRateio: () => void;
}) {
  const [editDesc, setEditDesc] = useState(p.descricao || '');
  const [editNF, setEditNF] = useState(p.notaFiscal || '');
  const [editValor, setEditValor] = useState(String(p.valor));
  const [editVenc, setEditVenc] = useState(p.dataVencimento ? p.dataVencimento.substring(0, 10) : '');
  const [editObs, setEditObs] = useState(p.observacoes || '');
  const [editDataEnvio, setEditDataEnvio] = useState(p.dataPagamento ? p.dataPagamento.substring(0, 10) : '');

  useEffect(() => {
    if (editing) {
      setEditDesc(p.descricao || '');
      setEditNF(p.notaFiscal || '');
      setEditValor(String(p.valor));
      setEditVenc(p.dataVencimento ? p.dataVencimento.substring(0, 10) : '');
      setEditObs(p.observacoes || '');
      setEditDataEnvio(p.dataPagamento ? p.dataPagamento.substring(0, 10) : '');
    }
  }, [editing, p]);

  const isPaga = p.status === 'PAGA';

  if (editing) {
    return (
      <>
        <tr className="bg-amber-50">
          <td className="px-4 py-2.5 text-slate-400">
            <Pencil className="w-4 h-4 text-amber-500" />
          </td>
          <td className="px-4 py-2.5 text-slate-500">{p.numero}</td>
          <td className="px-4 py-2.5">
            {isPaga ? <span className="text-sm text-slate-600">{p.descricao || '-'}</span> : (
              <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Descricao"
                className="w-full border border-slate-300 rounded px-2 py-1 text-sm" />
            )}
          </td>
          <td className="px-4 py-2.5">
            {isPaga ? <span className="text-sm text-slate-600 text-right">{fmtCurrency(p.valor)}</span> : (
              <input type="number" step="0.01" value={editValor} onChange={(e) => setEditValor(e.target.value)}
                className="w-28 border border-slate-300 rounded px-2 py-1 text-sm text-right" />
            )}
          </td>
          <td className="px-4 py-2.5">
            {isPaga ? <span className="text-sm text-slate-600">{fmtDate(p.dataVencimento)}</span> : (
              <input type="date" value={editVenc} onChange={(e) => setEditVenc(e.target.value)}
                className="border border-slate-300 rounded px-2 py-1 text-sm" />
            )}
          </td>
          <td className="px-4 py-2.5 text-center">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${parcelaStatusCores[p.status]}`}>{p.status}</span>
          </td>
          <td className="px-4 py-2.5">
            <input value={editNF} onChange={(e) => setEditNF(e.target.value)} placeholder="Nota Fiscal"
              className="w-full border border-slate-300 rounded px-2 py-1 text-sm" />
          </td>
          <td className="px-4 py-2.5">
            {isPaga ? (
              <input type="date" value={editDataEnvio} onChange={(e) => setEditDataEnvio(e.target.value)}
                className="border border-slate-300 rounded px-2 py-1 text-sm" />
            ) : (
              <span className="text-slate-400 text-sm">{p.dataPagamento ? fmtDate(p.dataPagamento) : '-'}</span>
            )}
          </td>
          {canManage && (
            <td className="px-4 py-2.5 text-center">
              <div className="flex items-center justify-center gap-2">
                <button onClick={() => onSaveEdit({
                  ...(isPaga ? {} : {
                    descricao: editDesc || undefined,
                    valor: parseFloat(editValor),
                    dataVencimento: editVenc || undefined,
                  }),
                  notaFiscal: editNF || undefined,
                  observacoes: editObs || undefined,
                  ...(isPaga ? { dataPagamento: editDataEnvio || undefined } : {}),
                })} className="text-xs text-green-600 hover:underline flex items-center gap-0.5">
                  <Check className="w-3 h-3" /> Salvar
                </button>
                <button onClick={onCancelEdit} className="text-xs text-slate-500 hover:underline flex items-center gap-0.5">
                  <X className="w-3 h-3" /> Cancelar
                </button>
              </div>
            </td>
          )}
        </tr>
        <tr className="bg-amber-50">
          <td colSpan={canManage ? 9 : 8} className="px-8 pb-3">
            <label className="block text-xs text-slate-500 mb-1">Observacoes</label>
            <input value={editObs} onChange={(e) => setEditObs(e.target.value)} placeholder="Observacoes da parcela"
              className="w-full border border-slate-300 rounded px-2 py-1 text-sm" />
          </td>
        </tr>
      </>
    );
  }

  return (
    <>
      <tr className="hover:bg-slate-50 cursor-pointer" onClick={onToggle}>
        <td className="px-4 py-2.5 text-slate-400">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </td>
        <td className="px-4 py-2.5 text-slate-500">{p.numero}</td>
        <td className="px-4 py-2.5 text-slate-700">{p.descricao || '-'}</td>
        <td className="px-4 py-2.5 text-right font-medium text-slate-700">{fmtCurrency(p.valor)}</td>
        <td className="px-4 py-2.5 text-slate-600">{fmtDate(p.dataVencimento)}</td>
        <td className="px-4 py-2.5 text-center">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${parcelaStatusCores[p.status]}`}>{p.status}</span>
        </td>
        <td className="px-4 py-2.5 text-slate-600">{p.notaFiscal || '-'}</td>
        <td className="px-4 py-2.5 text-slate-600">{p.dataPagamento ? fmtDate(p.dataPagamento) : '-'}</td>
        {canManage && (
          <td className="px-4 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
            {p.status === 'PENDENTE' && (
              <div className="flex items-center justify-center gap-2">
                <button onClick={onEdit} className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                  <Pencil className="w-3 h-3" /> Editar
                </button>
                <button onClick={onPagar} className="text-xs text-green-600 hover:underline">Pagar</button>
                <button onClick={onCancelar} className="text-xs text-red-500 hover:underline">Cancelar</button>
              </div>
            )}
            {p.status === 'PAGA' && (
              <div className="flex items-center justify-center gap-2">
                <button onClick={onEdit} className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                  <Pencil className="w-3 h-3" /> Editar
                </button>
              </div>
            )}
          </td>
        )}
      </tr>
      {expanded && (
        <tr>
          <td colSpan={canManage ? 9 : 8} className="bg-slate-50 px-8 py-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Rateio da Parcela #{p.numero}</h5>
                <div className="flex gap-2">
                  {canManage && p.status !== 'CANCELADA' && (
                    <>
                      <button onClick={onGerarTemplate}
                        className="flex items-center gap-1 text-xs text-capul-600 hover:underline">
                        <Zap className="w-3 h-3" /> {p.status === 'PAGA' ? 'Recalcular Rateio' : 'Gerar via Template'}
                      </button>
                      {rateioItens.length > 0 && p.status === 'PENDENTE' && (
                        <button onClick={onCopiarPendentes}
                          className="flex items-center gap-1 text-xs text-slate-600 hover:underline">
                          <Copy className="w-3 h-3" /> Copiar p/ Pendentes
                        </button>
                      )}
                    </>
                  )}
                  {rateioItens.length > 0 && (
                    <button onClick={onImprimirRateio}
                      className="flex items-center gap-1 text-xs text-indigo-600 hover:underline">
                      <Printer className="w-3 h-3" /> Imprimir Rateio
                    </button>
                  )}
                </div>
              </div>
              {loadingRateio ? (
                <p className="text-xs text-slate-400">Carregando...</p>
              ) : rateioItens.length === 0 ? (
                <p className="text-xs text-slate-400">Nenhum rateio configurado para esta parcela</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-1.5 font-medium text-slate-500">Centro de Custo</th>
                      <th className="text-left py-1.5 font-medium text-slate-500">Natureza</th>
                      <th className="text-right py-1.5 font-medium text-slate-500">%</th>
                      <th className="text-right py-1.5 font-medium text-slate-500">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rateioItens.map((ri) => (
                      <tr key={ri.id}>
                        <td className="py-1.5 text-slate-700">{ri.centroCusto.codigo} - {ri.centroCusto.nome}</td>
                        <td className="py-1.5 text-slate-600">{ri.natureza ? `${ri.natureza.codigo} - ${ri.natureza.nome}` : '-'}</td>
                        <td className="py-1.5 text-right text-slate-600">{ri.percentual != null ? `${Number(ri.percentual).toFixed(2)}%` : '-'}</td>
                        <td className="py-1.5 text-right font-medium text-slate-800">{fmtCurrency(ri.valorCalculado)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {p.observacoes && (
                <p className="text-xs text-slate-500">Obs: {p.observacoes}</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Tab Rateio Template ────────────────────────────────────

function TabRateioTemplate({ contrato, canManage, onReload, toast }: TabProps) {
  const finalizado = ['RENOVADO', 'CANCELADO'].includes(contrato.status);

  const [template, setTemplate] = useState<RateioTemplate | null>(contrato.rateioTemplate || null);
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);
  const [naturezas, setNaturezas] = useState<NaturezaContrato[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [modalidade, setModalidade] = useState<ModalidadeRateio>('PERCENTUAL_CUSTOMIZADO');
  const [criterio, setCriterio] = useState('');
  const [itens, setItens] = useState<{ centroCustoId: string; naturezaId: string; percentual: string; valorFixo: string; parametro: string }[]>([]);
  const [simulacao, setSimulacao] = useState<{ centroCustoId: string; valorCalculado: number }[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    coreService.listarCentrosCusto().then(setCentrosCusto).catch(() => {});
    contratoService.listarNaturezas().then(setNaturezas).catch(() => {});
    contratoService.obterRateioTemplate(contrato.id).then(setTemplate).catch(() => {});
  }, [contrato.id]);

  function startEditing() {
    if (template) {
      setModalidade(template.modalidade);
      setCriterio(template.criterio || '');
      setItens(template.itens.map((i) => ({
        centroCustoId: i.centroCustoId,
        naturezaId: i.naturezaId || '',
        percentual: i.percentual != null ? String(i.percentual) : '',
        valorFixo: i.valorFixo != null ? String(i.valorFixo) : '',
        parametro: i.parametro != null ? String(i.parametro) : '',
      })));
    } else {
      setModalidade('PERCENTUAL_CUSTOMIZADO');
      setCriterio('');
      setItens([]);
    }
    setSimulacao(null);
    setShowForm(true);
  }

  function addItem() {
    setItens([...itens, { centroCustoId: '', naturezaId: '', percentual: '', valorFixo: '', parametro: '' }]);
  }

  function updateItem(idx: number, field: string, value: string) {
    const updated = [...itens];
    updated[idx] = { ...updated[idx], [field]: value };
    setItens(updated);
  }

  function removeItem(idx: number) {
    setItens(itens.filter((_, i) => i !== idx));
  }

  function buildPayload() {
    return {
      modalidade,
      criterio: criterio || undefined,
      itens: itens.map((i) => ({
        centroCustoId: i.centroCustoId,
        naturezaId: i.naturezaId || undefined,
        percentual: i.percentual ? parseFloat(i.percentual) : undefined,
        valorFixo: i.valorFixo ? parseFloat(i.valorFixo) : undefined,
        parametro: i.parametro ? parseFloat(i.parametro) : undefined,
      })),
    };
  }

  function validate(): boolean {
    const payload = buildPayload();
    if (payload.itens.length === 0) {
      toast.show('error', 'Adicione ao menos um centro de custo.');
      return false;
    }
    if (payload.itens.some((i) => !i.centroCustoId)) {
      toast.show('error', 'Selecione o centro de custo em todos os itens.');
      return false;
    }
    return true;
  }

  async function handleSimular() {
    if (!validate()) return;
    try {
      const result = await contratoService.simularRateioTemplate(contrato.id, buildPayload());
      setSimulacao(result as unknown as { centroCustoId: string; valorCalculado: number }[]);
      toast.show('success', 'Simulacao realizada com sucesso');
    } catch (err) {
      toast.show('error', extractErrorMsg(err, 'Erro ao simular rateio'));
    }
  }

  async function handleConfirmar() {
    if (!validate()) return;
    setSaving(true);
    try {
      const saved = await contratoService.configurarRateioTemplate(contrato.id, buildPayload());
      setTemplate(saved);
      setShowForm(false);
      setSimulacao(null);
      toast.show('success', 'Rateio template configurado com sucesso');
      onReload();
    } catch (err) {
      toast.show('error', extractErrorMsg(err, 'Erro ao configurar rateio'));
    } finally {
      setSaving(false);
    }
  }

  const ccMap = Object.fromEntries(centrosCusto.map((c) => [c.id, c]));

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <h4 className="font-semibold text-slate-700">Rateio Template</h4>
        {canManage && !finalizado && (
          <button onClick={() => showForm ? setShowForm(false) : startEditing()}
            className="text-xs text-capul-600 hover:underline">
            {showForm ? 'Cancelar' : (template ? 'Editar Template' : 'Configurar Template')}
          </button>
        )}
      </div>

      {template && !showForm && (
        <div className="px-6 py-4">
          <p className="text-sm text-slate-600 mb-3">
            Modalidade: <span className="font-medium">{modalidadeLabels[template.modalidade]}</span>
            {template.criterio && <span className="text-slate-400"> ({template.criterio})</span>}
          </p>
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Centro de Custo</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Natureza</th>
                <th className="text-right px-3 py-2 font-medium text-slate-600">%</th>
                <th className="text-right px-3 py-2 font-medium text-slate-600">Valor Fixo</th>
                <th className="text-right px-3 py-2 font-medium text-slate-600">Parametro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {template.itens.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-2 text-slate-700">{item.centroCusto.codigo} - {item.centroCusto.nome}</td>
                  <td className="px-3 py-2 text-slate-600">{item.natureza ? `${item.natureza.codigo} - ${item.natureza.nome}` : '-'}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{item.percentual != null ? `${Number(item.percentual).toFixed(2)}%` : '-'}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{item.valorFixo != null ? fmtCurrency(item.valorFixo) : '-'}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{item.parametro != null ? String(item.parametro) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-slate-400 mt-3">Atualizado em {fmtDateTime(template.updatedAt)}</p>
        </div>
      )}

      {!template && !showForm && (
        <p className="px-6 py-8 text-sm text-slate-400 text-center">Nenhum rateio template configurado</p>
      )}

      {showForm && (
        <div className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Modalidade</label>
              <select value={modalidade} onChange={(e) => { setModalidade(e.target.value as ModalidadeRateio); setSimulacao(null); }}
                className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white">
                {Object.entries(modalidadeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            {modalidade === 'PROPORCIONAL_CRITERIO' && (
              <div>
                <label className="block text-xs text-slate-500 mb-1">Criterio</label>
                <input value={criterio} onChange={(e) => setCriterio(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" placeholder="Ex: num. funcionarios" />
              </div>
            )}
          </div>

          <div className="space-y-2">
            {itens.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 flex-wrap">
                <select value={item.centroCustoId} onChange={(e) => updateItem(idx, 'centroCustoId', e.target.value)}
                  className="flex-[3] min-w-[180px] border border-slate-300 rounded px-2 py-1.5 text-sm bg-white">
                  <option value="">Selecione CC...</option>
                  {centrosCusto.map((cc) => <option key={cc.id} value={cc.id}>{cc.codigo} - {cc.nome}</option>)}
                </select>
                <select value={item.naturezaId} onChange={(e) => updateItem(idx, 'naturezaId', e.target.value)}
                  className="flex-[2] min-w-[200px] border border-slate-300 rounded px-2 py-1.5 text-sm bg-white">
                  <option value="">Natureza...</option>
                  {naturezas.map((n) => <option key={n.id} value={n.id}>{n.codigo} - {n.nome}</option>)}
                </select>
                {modalidade === 'PERCENTUAL_CUSTOMIZADO' && (
                  <input type="number" step="0.01" placeholder="%" value={item.percentual} onChange={(e) => updateItem(idx, 'percentual', e.target.value)}
                    className="w-24 border border-slate-300 rounded px-2 py-1.5 text-sm" />
                )}
                {modalidade === 'VALOR_FIXO' && (
                  <input type="number" step="0.01" placeholder="R$" value={item.valorFixo} onChange={(e) => updateItem(idx, 'valorFixo', e.target.value)}
                    className="w-32 border border-slate-300 rounded px-2 py-1.5 text-sm" />
                )}
                {modalidade === 'PROPORCIONAL_CRITERIO' && (
                  <input type="number" step="0.01" placeholder="Param." value={item.parametro} onChange={(e) => updateItem(idx, 'parametro', e.target.value)}
                    className="w-28 border border-slate-300 rounded px-2 py-1.5 text-sm" />
                )}
                <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button onClick={addItem} className="text-xs text-capul-600 hover:underline">+ Adicionar CC</button>
          </div>

          {simulacao && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-xs font-medium text-green-700 mb-2">Resultado da Simulacao:</p>
              {simulacao.map((s, i) => (
                <p key={i} className="text-sm text-green-800">
                  {ccMap[s.centroCustoId]?.codigo} - {ccMap[s.centroCustoId]?.nome || s.centroCustoId}: {fmtCurrency(s.valorCalculado)}
                </p>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={handleSimular} className="text-sm border border-capul-300 text-capul-600 px-4 py-1.5 rounded hover:bg-capul-50">
              Simular
            </button>
            <button onClick={handleConfirmar} disabled={saving}
              className="text-sm bg-capul-600 text-white px-4 py-1.5 rounded hover:bg-capul-700 disabled:opacity-50">
              {saving ? 'Salvando...' : 'Confirmar Template'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab Licencas ───────────────────────────────────────────

function TabLicencas({ contrato, canManage, onReload, toast, confirm }: TabPropsWithConfirm) {
  const licencas = contrato.licencas || [];
  const finalizado = ['RENOVADO', 'CANCELADO'].includes(contrato.status);

  const [disponiveis, setDisponiveis] = useState<SoftwareLicenca[]>([]);
  const [showVincular, setShowVincular] = useState(false);
  const [selectedLicId, setSelectedLicId] = useState('');

  async function loadDisponiveis() {
    try {
      const all = await licencaService.listar({ status: 'ATIVA' });
      const semContrato = all.filter((l: SoftwareLicenca) => !l.contratoId);
      setDisponiveis(semContrato);
    } catch { /* ignore */ }
  }

  async function handleVincular() {
    if (!selectedLicId) return;
    try {
      await contratoService.vincularLicenca(contrato.id, selectedLicId);
      setShowVincular(false);
      setSelectedLicId('');
      toast.show('success', 'Licenca vinculada com sucesso');
      onReload();
    } catch (err) {
      toast.show('error', extractErrorMsg(err, 'Erro ao vincular licenca'));
    }
  }

  async function handleDesvincular(licId: string) {
    const ok = await confirm('Desvincular Licenca', 'Deseja remover o vinculo desta licenca com o contrato?');
    if (!ok) return;
    try {
      await contratoService.desvincularLicenca(contrato.id, licId);
      toast.show('success', 'Licenca desvinculada');
      onReload();
    } catch (err) {
      toast.show('error', extractErrorMsg(err, 'Erro ao desvincular licenca'));
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <h4 className="font-semibold text-slate-700">Licencas Vinculadas ({licencas.length})</h4>
        {canManage && !finalizado && (
          <button onClick={() => { setShowVincular(!showVincular); if (!showVincular) loadDisponiveis(); }}
            className="text-xs text-capul-600 hover:underline">{showVincular ? 'Cancelar' : '+ Vincular Licenca'}</button>
        )}
      </div>

      {showVincular && (
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs text-slate-500 mb-1">Selecione a licenca</label>
            <select value={selectedLicId} onChange={(e) => setSelectedLicId(e.target.value)}
              className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white">
              <option value="">Selecione...</option>
              {disponiveis.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.software.nome} - {l.modeloLicenca || 'S/M'} ({fmtCurrency(l.valorTotal)})
                </option>
              ))}
            </select>
          </div>
          <button onClick={handleVincular} disabled={!selectedLicId}
            className="bg-capul-600 text-white px-4 py-1.5 rounded text-sm hover:bg-capul-700 disabled:opacity-50">Vincular</button>
        </div>
      )}

      {licencas.length === 0 ? (
        <p className="px-6 py-8 text-sm text-slate-400 text-center">Nenhuma licenca vinculada</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-slate-600">Software</th>
              <th className="text-left px-4 py-2 font-medium text-slate-600">Modelo</th>
              <th className="text-right px-4 py-2 font-medium text-slate-600">Valor</th>
              <th className="text-left px-4 py-2 font-medium text-slate-600">Vencimento</th>
              <th className="text-center px-4 py-2 font-medium text-slate-600">Status</th>
              {canManage && <th className="text-center px-4 py-2 font-medium text-slate-600">Acoes</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {licencas.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5"><a href={`/gestao-ti/softwares/${l.software.id}`} target="_blank" rel="noopener noreferrer" className="text-capul-600 hover:underline">{l.software.nome}</a></td>
                <td className="px-4 py-2.5 text-slate-600">{l.modeloLicenca || '-'}</td>
                <td className="px-4 py-2.5 text-right text-slate-700">{fmtCurrency(l.valorTotal)}</td>
                <td className="px-4 py-2.5 text-slate-600">{fmtDate(l.dataVencimento)}</td>
                <td className="px-4 py-2.5 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${l.status === 'ATIVA' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                    {l.status}
                  </span>
                </td>
                {canManage && (
                  <td className="px-4 py-2.5 text-center">
                    <button onClick={() => handleDesvincular(l.id)} className="text-xs text-red-500 hover:underline">Desvincular</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Tab Renovacoes ─────────────────────────────────────────

function TabRenovacoes({ contrato }: { contrato: Contrato }) {
  const [renovacoes, setRenovacoes] = useState<ContratoRenovacaoReg[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    contratoService.listarRenovacoes(contrato.id)
      .then(setRenovacoes)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [contrato.id]);

  // Build chain from contratoOriginal and contratosRenovados
  const chain: { id: string; numero: number; titulo: string; valorTotal?: number; dataInicio?: string; dataFim?: string; status: StatusContrato; isCurrent: boolean }[] = [];

  // Walk up to original
  if (contrato.contratoOriginal) {
    chain.push({
      id: contrato.contratoOriginal.id,
      numero: contrato.contratoOriginal.numero,
      titulo: contrato.contratoOriginal.titulo,
      status: 'RENOVADO' as StatusContrato,
      isCurrent: false,
    });
  }

  // Current
  chain.push({
    id: contrato.id,
    numero: contrato.numero,
    titulo: contrato.titulo,
    valorTotal: contrato.valorTotal,
    dataInicio: contrato.dataInicio,
    dataFim: contrato.dataFim,
    status: contrato.status,
    isCurrent: true,
  });

  // Children
  if (contrato.contratosRenovados) {
    contrato.contratosRenovados.forEach((c) => {
      chain.push({
        id: c.id,
        numero: c.numero,
        titulo: c.titulo,
        valorTotal: c.valorTotal,
        dataInicio: c.dataInicio,
        dataFim: c.dataFim,
        status: c.status,
        isCurrent: false,
      });
    });
  }

  return (
    <div className="space-y-6">
      {/* Chain */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h4 className="font-semibold text-slate-700">Cadeia de Contratos</h4>
        </div>
        {chain.length <= 1 && !contrato.contratoOriginal && contrato.contratosRenovados?.length === 0 ? (
          <p className="px-6 py-8 text-sm text-slate-400 text-center">Este contrato nao possui renovacoes</p>
        ) : (
          <div className="px-6 py-4 space-y-3">
            {chain.map((c, idx) => (
              <div key={c.id} className="flex items-center gap-3">
                {idx > 0 && <div className="w-4 text-center text-slate-300">&#8594;</div>}
                <div className={`flex-1 p-3 rounded-lg border ${c.isCurrent ? 'border-capul-300 bg-capul-50' : 'border-slate-200'}`}>
                  <div className="flex items-center gap-2">
                    {c.isCurrent ? (
                      <span className="text-sm font-semibold text-capul-700">#{c.numero} - {c.titulo}</span>
                    ) : (
                      <Link to={`/gestao-ti/contratos/${c.id}`} className="text-sm font-semibold text-capul-600 hover:underline">
                        #{c.numero} - {c.titulo}
                      </Link>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusCores[c.status]}`}>
                      {statusLabels[c.status]}
                    </span>
                  </div>
                  {c.valorTotal != null && (
                    <p className="text-xs text-slate-500 mt-1">
                      {fmtCurrency(c.valorTotal)}
                      {c.dataInicio && c.dataFim && ` | ${fmtDate(c.dataInicio)} - ${fmtDate(c.dataFim)}`}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Renovation details */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h4 className="font-semibold text-slate-700">Detalhes das Renovacoes ({renovacoes.length})</h4>
        </div>
        {loading ? (
          <p className="px-6 py-8 text-sm text-slate-400 text-center">Carregando...</p>
        ) : renovacoes.length === 0 ? (
          <p className="px-6 py-8 text-sm text-slate-400 text-center">Nenhum registro de renovacao</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {renovacoes.map((r) => (
              <div key={r.id} className="px-6 py-4">
                <div className="flex items-center gap-2 mb-2">
                  <RefreshCw className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium text-slate-700">Renovacao em {fmtDateTime(r.createdAt)}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">Contrato Anterior</p>
                    <Link to={`/gestao-ti/contratos/${r.contratoAnteriorId}`} className="text-capul-600 hover:underline text-sm">
                      #{r.contratoAnterior.numero} - {r.contratoAnterior.titulo}
                    </Link>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Contrato Novo</p>
                    <Link to={`/gestao-ti/contratos/${r.contratoNovoId}`} className="text-capul-600 hover:underline text-sm">
                      #{r.contratoNovo.numero} - {r.contratoNovo.titulo}
                    </Link>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Valor</p>
                    <p className="text-slate-700">
                      {fmtCurrency(r.valorAnterior)} <span className="text-slate-400 mx-1">&#8594;</span> {fmtCurrency(r.valorNovo)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Reajuste</p>
                    <p className="text-slate-700">
                      {r.indiceReajuste || '-'}
                      {r.percentualReajuste != null && ` (${Number(r.percentualReajuste).toFixed(2)}%)`}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab Historico ──────────────────────────────────────────

function TabHistorico({ historicos }: { historicos: ContratoHistorico[] }) {
  const tipoLabels: Record<string, string> = {
    CRIACAO: 'Criacao',
    ATIVACAO: 'Ativacao',
    ALTERACAO: 'Alteracao',
    SUSPENSAO: 'Suspensao',
    RENOVACAO: 'Renovacao',
    CANCELAMENTO: 'Cancelamento',
    VENCIMENTO: 'Vencimento',
    RATEIO_ALTERADO: 'Rateio Alterado',
    PARCELA_PAGA: 'Parcela Paga',
    OBSERVACAO: 'Observacao',
  };

  const tipoCores: Record<string, string> = {
    CRIACAO: 'bg-blue-400',
    ATIVACAO: 'bg-green-400',
    ALTERACAO: 'bg-yellow-400',
    SUSPENSAO: 'bg-orange-400',
    RENOVACAO: 'bg-indigo-400',
    CANCELAMENTO: 'bg-red-400',
    VENCIMENTO: 'bg-red-300',
    RATEIO_ALTERADO: 'bg-purple-400',
    PARCELA_PAGA: 'bg-emerald-400',
    OBSERVACAO: 'bg-slate-400',
  };

  if (historicos.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 px-6 py-8 text-center">
        <p className="text-sm text-slate-400">Nenhum registro no historico</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-6 py-4 border-b border-slate-200">
        <h4 className="font-semibold text-slate-700">Historico ({historicos.length})</h4>
      </div>
      <div className="divide-y divide-slate-100">
        {historicos.map((h) => (
          <div key={h.id} className="px-6 py-3 flex items-start gap-3">
            <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${tipoCores[h.tipo] || 'bg-capul-400'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-700">
                <span className="font-medium">{tipoLabels[h.tipo] || h.tipo.replace(/_/g, ' ')}</span>
                {h.descricao && <span className="text-slate-500"> — {h.descricao}</span>}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {h.usuario.nome} em {fmtDateTime(h.createdAt)}
              </p>
              {h.dadosJson && (
                <details className="mt-1">
                  <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600">Ver dados</summary>
                  <pre className="text-xs text-slate-500 mt-1 bg-slate-50 rounded p-2 overflow-auto max-h-32">
                    {JSON.stringify(JSON.parse(h.dadosJson), null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
