import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { compraService } from '../../services/compra.service';
import { contratoService } from '../../services/contrato.service';
import { coreService } from '../../services/core.service';
import { projetoService } from '../../services/projeto.service';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { useToast } from '../../components/Toast';
import { SearchSelect } from '../../components/SearchSelect';
import type { SearchSelectOption } from '../../components/SearchSelect';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { FornecedorConfig, ProdutoConfig, Departamento } from '../../types';

interface ItemForm {
  key: number;
  produtoId: string;
  quantidade: number;
  valorUnitario: number;
  departamentoId: string;
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
    departamentoId: '',
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
  const [fornecedorId, setFornecedorId] = useState('');
  const [equipeId, setEquipeId] = useState('');
  const [observacao, setObservacao] = useState('');
  const [itens, setItens] = useState<ItemForm[]>([newItem()]);

  const [fornecedores, setFornecedores] = useState<FornecedorConfig[]>([]);
  const [produtos, setProdutos] = useState<ProdutoConfig[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [projetos, setProjetos] = useState<ProjetoResumo[]>([]);
  const [equipes, setEquipes] = useState<EquipeResumo[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const isAdmin = gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR_TI';

  useEffect(() => {
    // Chamadas independentes — uma falha nao impede as outras
    contratoService.listarFornecedores().then(setFornecedores).catch(() => {});
    contratoService.listarProdutos().then(setProdutos).catch(() => {});
    coreService.listarDepartamentos().then(setDepartamentos).catch(() => {});
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
        setFornecedorId(nf.fornecedorId);
        setEquipeId(nf.equipeId || '');
        setObservacao(nf.observacao || '');
        setItens(nf.itens.map((i) => ({
          key: ++keyCounter,
          produtoId: i.produtoId,
          quantidade: i.quantidade,
          valorUnitario: Number(i.valorUnitario),
          departamentoId: i.departamentoId,
          projetoId: i.projetoId || '',
          observacao: i.observacao || '',
        })));
      }).catch(() => toast('error', 'Erro ao carregar nota fiscal'))
        .finally(() => setLoading(false));
    }
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

  const departamentoOptions: SearchSelectOption[] = useMemo(() =>
    departamentos.map((d) => ({
      value: d.id,
      label: d.nome,
    })), [departamentos]);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!fornecedorId) { toast('error', 'Selecione o fornecedor'); return; }
    if (itens.some(i => !i.produtoId)) { toast('error', 'Selecione o produto em todos os itens'); return; }
    if (itens.some(i => !i.departamentoId)) { toast('error', 'Selecione o departamento em todos os itens'); return; }
    if (itens.some(i => i.valorUnitario <= 0)) { toast('error', 'Valor unitario deve ser maior que zero em todos os itens'); return; }

    setSaving(true);
    try {
      const payload = {
        numero,
        dataLancamento,
        fornecedorId,
        equipeId: equipeId || undefined,
        observacao: observacao || undefined,
        itens: itens.map(i => ({
          produtoId: i.produtoId,
          quantidade: i.quantidade,
          valorUnitario: i.valorUnitario,
          departamentoId: i.departamentoId,
          projetoId: i.projetoId || undefined,
          observacao: i.observacao || undefined,
        })),
      };

      if (isEdit && id) {
        await compraService.atualizarNotaFiscal(id, payload);
        toast('success', 'Nota fiscal atualizada');
      } else {
        const nf = await compraService.criarNotaFiscal(payload);
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
      <div className="p-6 max-w-6xl">
        <button onClick={() => guardedNavigate('/gestao-ti/notas-fiscais')}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        <form onSubmit={handleSubmit}>
          {/* Cabecalho da NF */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
            <h3 className="text-sm font-semibold text-slate-700 uppercase mb-4">Dados da Nota Fiscal</h3>
            <div className="grid grid-cols-4 gap-4">
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
          </div>

          {/* Itens da NF */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
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
                  <div className="grid grid-cols-6 gap-3">
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
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Departamento *</label>
                      <SearchSelect
                        options={departamentoOptions}
                        value={item.departamentoId}
                        onChange={(v) => updateItem(item.key, 'departamentoId', v)}
                        placeholder="Buscar depto..."
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-6 gap-3 mt-3">
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
      </div>
    </>
  );
}
