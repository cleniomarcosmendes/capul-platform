import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { compraService } from '../../services/compra.service';
import type { ValidarChaveNfeResult } from '../../services/compra.service';
import { contratoService } from '../../services/contrato.service';
import { coreService } from '../../services/core.service';
import { projetoService } from '../../services/projeto.service';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { useToast } from '../../components/Toast';
import { SearchSelect } from '../../components/SearchSelect';
import type { SearchSelectOption } from '../../components/SearchSelect';
import { DepartamentoField } from '../../components/DepartamentoField';
import { ArrowLeft, Plus, Trash2, Search, Check, X, Loader2, Lock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { FornecedorConfig, ProdutoConfig } from '../../types';

interface CentroCustoResumo {
  id: string;
  codigo: string;
  nome: string;
}

interface ItemForm {
  key: number;
  produtoId: string;
  quantidade: number;
  valorUnitario: number;
  centroCustoId: string;
  projetoId: string;
  observacao: string;
}

interface ProjetoResumo {
  id: string;
  numero: number;
  nome: string;
  status: string;
}

let keyCounter = 0;

function newItem(): ItemForm {
  return {
    key: ++keyCounter,
    produtoId: '',
    quantidade: 1,
    valorUnitario: 0,
    centroCustoId: '',
    projetoId: '',
    observacao: '',
  };
}

interface EquipeResumo {
  id: string;
  nome: string;
  sigla: string;
  cor: string | null;
}

export function NotaFiscalFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { gestaoTiRole } = useAuth();
  const { toast } = useToast();
  const [dirty, setDirty] = useState(false);
  const { ConfirmDialog, guardedNavigate } = useUnsavedChanges(dirty);

  const [numero, setNumero] = useState('');
  const [dataLancamento, setDataEmissao] = useState(new Date().toISOString().slice(0, 10));
  const [dataVencimento, setDataVencimento] = useState('');
  const [fornecedorId, setFornecedorId] = useState('');
  const [equipeId, setEquipeId] = useState('');
  const [observacao, setObservacao] = useState('');
  const [itens, setItens] = useState<ItemForm[]>([newItem()]);

  // Chave NF-e (14/05/2026) ─────────────────────────────────────────
  // `chaveOriginal` é a chave carregada do servidor no modo edição —
  // serve pra detectar alteração e exigir motivo de auditoria.
  // Workspace Onda 3 S7 — depto de alocação da NF.
  const [departamentoId, setDepartamentoId] = useState('');
  const [chaveNfe, setChaveNfe] = useState('');
  const [chaveOriginal, setChaveOriginal] = useState<string | null>(null);
  const [chaveValidada, setChaveValidada] = useState<ValidarChaveNfeResult | null>(null);
  const [validandoChave, setValidandoChave] = useState(false);
  const [statusNFCarregada, setStatusNFCarregada] = useState<string | null>(null);
  const [motivoAlteracaoChave, setMotivoAlteracaoChave] = useState('');

  const [fornecedores, setFornecedores] = useState<FornecedorConfig[]>([]);
  const [produtos, setProdutos] = useState<ProdutoConfig[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<CentroCustoResumo[]>([]);
  const [projetos, setProjetos] = useState<ProjetoResumo[]>([]);
  const [equipes, setEquipes] = useState<EquipeResumo[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const isAdmin = gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR';

  // Edição da chave fica BLOQUEADA quando NF já está CONFERIDA ou CANCELADA.
  // (Backend reforça — esta flag só esconde/desabilita no UI.)
  const chaveBloqueada = isEdit && statusNFCarregada !== null && statusNFCarregada !== 'REGISTRADA';
  const chaveAlterada = isEdit && chaveOriginal !== null && chaveNfe !== chaveOriginal;
  const exigeMotivoChave = chaveAlterada && (chaveOriginal ?? '').length === 44;

  useEffect(() => {
    // Chamadas independentes — uma falha nao impede as outras
    contratoService.listarFornecedores().then(setFornecedores).catch(() => {});
    contratoService.listarProdutos().then(setProdutos).catch(() => {});
    coreService.listarCentrosCusto().then(setCentrosCusto).catch(() => {});
    projetoService.listar().then((all: ProjetoResumo[]) =>
      setProjetos(all.filter(p => p.status !== 'CANCELADO'))
    ).catch(() => {});
    compraService.listarEquipesParaCompras().then((eqs) => {
      setEquipes(eqs);
      // Auto-selecionar se usuario pertence a uma unica equipe
      if (eqs.length === 1 && !isEdit) setEquipeId(eqs[0].id);
    }).catch(() => {});

    if (isEdit && id) {
      setLoading(true);
      compraService.buscarNotaFiscal(id).then((nf) => {
        setNumero(nf.numero);
        setDataEmissao(nf.dataLancamento.slice(0, 10));
        setDataVencimento(nf.dataVencimento ? nf.dataVencimento.slice(0, 10) : '');
        setFornecedorId(nf.fornecedorId);
        setEquipeId(nf.equipeId || '');
        setObservacao(nf.observacao || '');
        setStatusNFCarregada(nf.status);
        setChaveNfe(nf.chaveNfe ?? '');
        setChaveOriginal(nf.chaveNfe ?? null);
        setDepartamentoId(nf.departamentoId || '');
        setItens(nf.itens.map((i) => ({
          key: ++keyCounter,
          produtoId: i.produtoId,
          quantidade: i.quantidade,
          valorUnitario: Number(i.valorUnitario),
          centroCustoId: i.centroCustoId || '',
          projetoId: i.projetoId || '',
          observacao: i.observacao || '',
        })));
      }).catch(() => toast('error', 'Erro ao carregar nota fiscal'))
        .finally(() => setLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Opcoes para SearchSelect
  const fornecedorOptions: SearchSelectOption[] = useMemo(() =>
    fornecedores.map((f) => ({
      value: f.id,
      label: `${f.codigo} - ${f.nome}`,
      sublabel: f.loja ? `Loja: ${f.loja}` : undefined,
    })), [fornecedores]);

  const produtoOptions: SearchSelectOption[] = useMemo(() =>
    produtos.map((p) => ({
      value: p.id,
      label: `${p.codigo} - ${p.descricao}`,
      sublabel: p.tipoProduto ? `Tipo: ${p.tipoProduto.descricao}` : undefined,
    })), [produtos]);

  const centroCustoOptions: SearchSelectOption[] = useMemo(() =>
    centrosCusto.map((cc) => ({
      value: cc.id,
      label: `${cc.codigo} - ${cc.nome}`,
    })), [centrosCusto]);

  const projetoOptions: SearchSelectOption[] = useMemo(() =>
    projetos.map((p) => ({
      value: p.id,
      label: `#${p.numero} - ${p.nome}`,
      sublabel: p.status,
    })), [projetos]);

  function updateItem(key: number, field: keyof ItemForm, value: string | number) {
    setItens(prev => prev.map(i => i.key === key ? { ...i, [field]: value } : i));
    setDirty(true);
  }

  function addItem() {
    setItens(prev => [...prev, newItem()]);
    setDirty(true);
  }

  function removeItem(key: number) {
    if (itens.length <= 1) return;
    setItens(prev => prev.filter(i => i.key !== key));
    setDirty(true);
  }

  function calcularValorTotalItem(item: ItemForm): number {
    return Number((item.quantidade * item.valorUnitario).toFixed(2));
  }

  function calcularValorTotalNF(): number {
    return itens.reduce((sum, i) => sum + calcularValorTotalItem(i), 0);
  }

  /**
   * Aciona o módulo Fiscal para validar a chave digitada e abrir o modal
   * de preview. O Fiscal cuida do fluxo SZR/SZQ → fallback SEFAZ → grava
   * no Protheus. Erros (chave inválida, CNPJ não-CAPUL, NF cancelada)
   * vêm como BadRequest com mensagem clara.
   */
  async function handleValidarChave() {
    if (!/^\d{44}$/.test(chaveNfe)) {
      toast('error', 'A chave precisa ter 44 dígitos numéricos');
      return;
    }
    setValidandoChave(true);
    try {
      const result = await compraService.validarChaveNfe(chaveNfe);
      setChaveValidada(result);
      toast('success', 'Chave validada. Confira os dados no modal.');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || 'Erro ao validar chave NF-e';
      toast('error', msg);
      setChaveValidada(null);
    } finally {
      setValidandoChave(false);
    }
  }

  function handleLimparChave() {
    setChaveNfe('');
    setChaveValidada(null);
    setMotivoAlteracaoChave('');
    setDirty(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!fornecedorId) { toast('error', 'Selecione o fornecedor'); return; }
    if (itens.some(i => !i.produtoId)) { toast('error', 'Selecione o produto em todos os itens'); return; }
    if (itens.some(i => !i.centroCustoId)) { toast('error', 'Selecione o centro de custo em todos os itens'); return; }
    if (itens.some(i => i.valorUnitario <= 0)) { toast('error', 'Valor unitario deve ser maior que zero em todos os itens'); return; }

    // Validações específicas da chave NF-e
    if (chaveNfe && !/^\d{44}$/.test(chaveNfe)) {
      toast('error', 'Chave NF-e inválida — precisa de 44 dígitos numéricos');
      return;
    }
    if (exigeMotivoChave && !motivoAlteracaoChave.trim()) {
      toast('error', 'Informe o motivo da alteração da chave NF-e');
      return;
    }

    setSaving(true);
    try {
      const itensPayload = itens.map(i => ({
        produtoId: i.produtoId,
        quantidade: i.quantidade,
        valorUnitario: i.valorUnitario,
        centroCustoId: i.centroCustoId,
        projetoId: i.projetoId || undefined,
        observacao: i.observacao || undefined,
      }));

      if (isEdit && id) {
        const updatePayload: Parameters<typeof compraService.atualizarNotaFiscal>[1] = {
          numero,
          dataLancamento,
          dataVencimento: dataVencimento || undefined,
          fornecedorId,
          equipeId: equipeId || undefined,
          observacao: observacao || undefined,
          itens: itensPayload,
          departamentoId: departamentoId || undefined,
        };
        // Envia chave SOMENTE se alterada — backend interpreta `undefined`
        // como "não mexer". Para desvincular, envia `null` explícito.
        if (chaveAlterada) {
          updatePayload.chaveNfe = chaveNfe ? chaveNfe : null;
          if (exigeMotivoChave) updatePayload.motivoAlteracaoChave = motivoAlteracaoChave.trim();
        }
        await compraService.atualizarNotaFiscal(id, updatePayload);
        toast('success', 'Nota fiscal atualizada');
      } else {
        const nf = await compraService.criarNotaFiscal({
          numero,
          dataLancamento,
          dataVencimento: dataVencimento || undefined,
          fornecedorId,
          equipeId: equipeId || undefined,
          observacao: observacao || undefined,
          itens: itensPayload,
          chaveNfe: chaveNfe || undefined,
          departamentoId: departamentoId || undefined,
        });
        toast('success', 'Nota fiscal criada');
        setDirty(false);
        navigate(`/gestao-ti/notas-fiscais/${nf.id}`, { replace: true });
        return;
      }
      setDirty(false);
      navigate(`/gestao-ti/notas-fiscais/${id}`, { replace: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao salvar';
      toast('error', msg);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <>
        <Header title={isEdit ? 'Editar Nota Fiscal' : 'Nova Nota Fiscal'} />
        <div className="p-6 text-center text-slate-500">Carregando...</div>
      </>
    );
  }

  return (
    <>
      <Header title={isEdit ? 'Editar Nota Fiscal' : 'Nova Nota Fiscal'} />
      <div className="p-6 mx-auto max-w-6xl">
        <button onClick={() => guardedNavigate('/gestao-ti/notas-fiscais')}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        <form onSubmit={handleSubmit}>
          {/* Cabecalho da NF */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
            <h3 className="text-sm font-semibold text-slate-700 uppercase mb-4">Dados da Nota Fiscal</h3>
            <div className="mb-4">
              <DepartamentoField
                value={departamentoId}
                onChange={(v) => { setDepartamentoId(v); setDirty(true); }}
                help="Departamento ONDE a NF é alocada (livre — qualquer depto da empresa). Quem lançou é registrado separadamente para auditoria."
              />
            </div>
            <div className="grid grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Numero NF *</label>
                <input type="text" value={numero} onChange={(e) => { setNumero(e.target.value); setDirty(true); }}
                  required maxLength={20}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600" placeholder="123456" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data Lancamento *</label>
                <input type="date" value={dataLancamento} onChange={(e) => { setDataEmissao(e.target.value); setDirty(true); }}
                  required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data Vencimento</label>
                <input type="date" value={dataVencimento} onChange={(e) => { setDataVencimento(e.target.value); setDirty(true); }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Equipe {!isAdmin && '*'}</label>
                <select
                  value={equipeId}
                  onChange={(e) => { setEquipeId(e.target.value); setDirty(true); }}
                  required={!isAdmin}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-capul-600"
                >
                  <option value="">Selecione a equipe...</option>
                  {equipes.map((eq) => (
                    <option key={eq.id} value={eq.id}>{eq.sigla} - {eq.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fornecedor *</label>
                <SearchSelect
                  options={fornecedorOptions}
                  value={fornecedorId}
                  onChange={(v) => { setFornecedorId(v); setDirty(true); }}
                  placeholder="Buscar fornecedor..."
                  required
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Observacao</label>
              <textarea value={observacao} onChange={(e) => { setObservacao(e.target.value); setDirty(true); }}
                rows={2}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600 resize-none" placeholder="Observacoes gerais da nota fiscal" />
            </div>

            {/* Chave NF-e (vínculo opcional com módulo Fiscal) ── 14/05/2026 */}
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-slate-700">
                  Chave NF-e <span className="text-xs text-slate-400 font-normal">(opcional — vincula ao módulo Fiscal)</span>
                </label>
                {chaveBloqueada && (
                  <span className="flex items-center gap-1 text-xs text-orange-700 bg-orange-50 px-2 py-0.5 rounded">
                    <Lock className="w-3 h-3" /> Bloqueada — NF em {statusNFCarregada}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={44}
                  value={chaveNfe}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '');
                    setChaveNfe(v);
                    setChaveValidada(null); // invalida preview anterior
                    setDirty(true);
                  }}
                  disabled={chaveBloqueada}
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono tracking-tight focus:outline-none focus:ring-2 focus:ring-capul-600 disabled:bg-slate-100 disabled:text-slate-500"
                  placeholder="44 dígitos"
                />
                <button
                  type="button"
                  onClick={handleValidarChave}
                  disabled={chaveBloqueada || validandoChave || chaveNfe.length !== 44}
                  className="flex items-center gap-1.5 px-4 py-2 bg-capul-600 text-white rounded-lg text-sm hover:bg-capul-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
                  title="Consulta no módulo Fiscal (SZR/SZQ ou SEFAZ)"
                >
                  {validandoChave ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  {validandoChave ? 'Validando…' : 'Validar'}
                </button>
                {chaveNfe && !chaveBloqueada && (
                  <button
                    type="button"
                    onClick={handleLimparChave}
                    className="px-3 py-2 text-slate-600 border border-slate-300 rounded-lg text-sm hover:bg-slate-50"
                    title="Limpar chave"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {chaveValidada && (
                <div className="mt-2 flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
                  <Check className="w-4 h-4" />
                  <span>
                    <strong>{chaveValidada.parsed.emitente.razaoSocial}</strong>
                    {' '}— NF nº {chaveValidada.parsed.dadosGerais.numero}
                    {' '}— R$ {Number(chaveValidada.parsed.totais.valorNota ?? 0).toFixed(2)}
                    {' '}({chaveValidada.parsed.produtos.length} item{chaveValidada.parsed.produtos.length !== 1 ? 's' : ''})
                  </span>
                </div>
              )}

              {exigeMotivoChave && (
                <div className="mt-2">
                  <label className="block text-xs font-medium text-orange-700 mb-1">
                    Motivo da alteração da chave * <span className="font-normal text-slate-500">(gravado no audit)</span>
                  </label>
                  <input
                    type="text"
                    value={motivoAlteracaoChave}
                    onChange={(e) => { setMotivoAlteracaoChave(e.target.value); setDirty(true); }}
                    maxLength={500}
                    className="w-full border border-orange-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Ex: chave digitada errada na primeira tentativa"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Itens da NF */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-700 uppercase">Itens da Nota Fiscal</h3>
              <button type="button" onClick={addItem}
                className="flex items-center gap-1 text-sm text-capul-600 hover:text-capul-700">
                <Plus className="w-4 h-4" /> Adicionar Item
              </button>
            </div>

            <div className="space-y-4">
              {itens.map((item, idx) => (
                <div key={item.key} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-500">Item {idx + 1}</span>
                    {itens.length > 1 && (
                      <button type="button" onClick={() => removeItem(item.key)}
                        className="text-red-500 hover:text-red-700" title="Remover item">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-5 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Produto *</label>
                      <SearchSelect
                        options={produtoOptions}
                        value={item.produtoId}
                        onChange={(v) => updateItem(item.key, 'produtoId', v)}
                        placeholder="Buscar produto..."
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Qtde *</label>
                      <input type="number" min={1} value={item.quantidade}
                        onChange={(e) => updateItem(item.key, 'quantidade', parseInt(e.target.value, 10) || 1)}
                        required
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Valor Unit. *</label>
                      <input type="number" min={0.01} step={0.01} value={item.valorUnitario || ''}
                        onChange={(e) => updateItem(item.key, 'valorUnitario', parseFloat(e.target.value) || 0)}
                        required
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Valor Total</label>
                      <div className="w-full border border-slate-200 bg-slate-100 rounded-lg px-3 py-2 text-sm text-slate-700 font-medium">
                        R$ {calcularValorTotalItem(item).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-6 gap-3 mt-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Centro de Custo *</label>
                      <SearchSelect
                        options={centroCustoOptions}
                        value={item.centroCustoId}
                        onChange={(v) => updateItem(item.key, 'centroCustoId', v)}
                        placeholder="Buscar centro custo..."
                        required
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Projeto (opcional)</label>
                      <SearchSelect
                        options={projetoOptions}
                        value={item.projetoId}
                        onChange={(v) => updateItem(item.key, 'projetoId', v)}
                        placeholder="Buscar projeto..."
                      />
                    </div>
                    <div className="col-span-4">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Observacao do item</label>
                      <input type="text" value={item.observacao}
                        onChange={(e) => updateItem(item.key, 'observacao', e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600"
                        placeholder="Observacao opcional" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Total da NF */}
            <div className="mt-4 flex justify-end">
              <div className="bg-capul-50 border border-capul-200 rounded-lg px-6 py-3 text-right">
                <span className="text-sm text-slate-600">Total da Nota Fiscal: </span>
                <span className="text-lg font-bold text-capul-700">
                  R$ {calcularValorTotalNF().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Acoes */}
          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="bg-capul-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-capul-700 disabled:opacity-50 transition-colors">
              {saving ? 'Salvando...' : isEdit ? 'Atualizar' : 'Salvar'}
            </button>
            <button type="button" onClick={() => guardedNavigate('/gestao-ti/notas-fiscais')}
              className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2.5">Cancelar</button>
          </div>
        </form>

        {ConfirmDialog}

        {/* Modal de preview NF-e validada — lista produtos read-only.
            Informativo apenas: a NF Compras mantém seus itens manuais. */}
        {chaveValidada && (
          <div
            className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4"
            onClick={() => setChaveValidada(null)}
          >
            <div
              className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <h4 className="text-base font-semibold text-slate-800">Preview NF-e</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Origem: <span className="font-mono">{chaveValidada.origem}</span>
                  </p>
                </div>
                <button onClick={() => setChaveValidada(null)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="px-6 py-4 overflow-y-auto flex-1">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs uppercase text-slate-500 font-semibold">Emitente</p>
                    <p className="text-sm text-slate-800">{chaveValidada.parsed.emitente.razaoSocial}</p>
                    <p className="text-xs text-slate-500 font-mono">CNPJ {chaveValidada.parsed.emitente.cnpj ?? chaveValidada.parsed.emitente.cpf ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500 font-semibold">Destinatário</p>
                    <p className="text-sm text-slate-800">{chaveValidada.parsed.destinatario.razaoSocial}</p>
                    <p className="text-xs text-slate-500 font-mono">CNPJ {chaveValidada.parsed.destinatario.cnpj ?? chaveValidada.parsed.destinatario.cpf ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500 font-semibold">Número / Série</p>
                    <p className="text-sm text-slate-800">
                      {chaveValidada.parsed.dadosGerais.numero}
                      {chaveValidada.parsed.dadosGerais.serie ? ` / ${chaveValidada.parsed.dadosGerais.serie}` : ''}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500 font-semibold">Valor Total</p>
                    <p className="text-sm text-slate-800 font-semibold">
                      R$ {Number(chaveValidada.parsed.totais.valorNota ?? 0).toFixed(2)}
                    </p>
                  </div>
                  {chaveValidada.parsed.protocoloAutorizacao && (
                    <div className="col-span-2">
                      <p className="text-xs uppercase text-slate-500 font-semibold">Autorização SEFAZ</p>
                      <p className="text-sm text-slate-800">
                        {chaveValidada.parsed.protocoloAutorizacao.cStat}
                        {' - '}
                        {chaveValidada.parsed.protocoloAutorizacao.motivo}
                        {' · Protocolo '}
                        <span className="font-mono">{chaveValidada.parsed.protocoloAutorizacao.protocolo}</span>
                      </p>
                    </div>
                  )}
                </div>

                <p className="text-xs uppercase text-slate-500 font-semibold mb-2">
                  Produtos da NF-e ({chaveValidada.parsed.produtos.length})
                </p>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">#</th>
                        <th className="px-3 py-2 text-left font-medium">Código</th>
                        <th className="px-3 py-2 text-left font-medium">Descrição</th>
                        <th className="px-3 py-2 text-right font-medium">Qtd</th>
                        <th className="px-3 py-2 text-left font-medium">UN</th>
                        <th className="px-3 py-2 text-right font-medium">V. Unit</th>
                        <th className="px-3 py-2 text-right font-medium">V. Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chaveValidada.parsed.produtos.map((p) => (
                        <tr key={p.item} className="border-t border-slate-100">
                          <td className="px-3 py-1.5 text-slate-500">{p.item}</td>
                          <td className="px-3 py-1.5 font-mono text-slate-700">{p.codigo}</td>
                          <td className="px-3 py-1.5 text-slate-700">{p.descricao}</td>
                          <td className="px-3 py-1.5 text-right text-slate-700">{Number(p.quantidadeComercial ?? 0)}</td>
                          <td className="px-3 py-1.5 text-slate-500">{p.unidadeComercial ?? '—'}</td>
                          <td className="px-3 py-1.5 text-right text-slate-700">R$ {Number(p.valorUnitarioComercial ?? 0).toFixed(4)}</td>
                          <td className="px-3 py-1.5 text-right text-slate-700">R$ {Number(p.valorTotalBruto ?? 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="text-xs text-slate-500 mt-3 italic">
                  ℹ️ Os itens acima são apenas do XML da NF-e (informativo).
                  Os itens da NF Compras continuam sendo cadastrados manualmente abaixo.
                </p>
              </div>
              <div className="border-t border-slate-200 px-6 py-3 flex justify-end gap-2">
                <button
                  onClick={() => setChaveValidada(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
