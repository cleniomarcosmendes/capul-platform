import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { Plus, Trash2, KeyRound } from 'lucide-react';
import { softwareService } from '../../services/software.service';
import { licencaService } from '../../services/licenca.service';
import { contratoService } from '../../services/contrato.service';
import { licencaCompraService } from '../../services/licencaCompra.service';
import type { LicencaItemPayload } from '../../services/licencaCompra.service';
import { SearchSelect } from '../../components/SearchSelect';
import type { SearchSelectOption } from '../../components/SearchSelect';
import { DepartamentoField } from '../../components/DepartamentoField';
import { useToast } from '../../components/Toast';
import type { Software, CategoriaLicenca, FornecedorConfig } from '../../types';

const modeloLabel: Record<string, string> = {
  SUBSCRICAO: 'Assinatura', PERPETUA: 'Perpétua', POR_USUARIO: 'Por Usuário',
  POR_ESTACAO: 'Por Estação', OEM: 'OEM', FREE_OPENSOURCE: 'Free/Open Source',
  SAAS: 'SaaS', OUTRO: 'Outro',
};

interface ItemForm {
  key: number;
  softwareId: string;
  nome: string;
  categoriaId: string;
  modeloLicenca: string;
  quantidade: string;
  valorUnitario: string;
  chaveSerial: string;
  observacoes: string;
  departamentoId: string;
}

let seq = 1;
function newItem(): ItemForm {
  return { key: seq++, softwareId: '', nome: '', categoriaId: '', modeloLicenca: '', quantidade: '', valorUnitario: '', chaveSerial: '', observacoes: '', departamentoId: '' };
}

export function NotaLicencaFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [softwares, setSoftwares] = useState<Software[]>([]);
  const [categorias, setCategorias] = useState<CategoriaLicenca[]>([]);
  const [fornecedores, setFornecedores] = useState<FornecedorConfig[]>([]);

  // Cabeçalho
  const [semNota, setSemNota] = useState(false);
  const [numero, setNumero] = useState('');
  const [fornecedorId, setFornecedorId] = useState('');
  const [fornecedorTexto, setFornecedorTexto] = useState('');
  const [dataLancamento, setDataLancamento] = useState(new Date().toISOString().slice(0, 10));
  const [dataVencimento, setDataVencimento] = useState('');
  const [chaveNfe, setChaveNfe] = useState('');
  const [observacao, setObservacao] = useState('');

  const [itens, setItens] = useState<ItemForm[]>([newItem()]);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    softwareService.listar().then(setSoftwares).catch(() => {});
    licencaService.listarCategorias().then(setCategorias).catch(() => {});
    contratoService.listarFornecedores().then(setFornecedores).catch(() => {});
  }, []);

  // Atalho "Nova Nota com este software" (vindo do detalhe do software):
  // pré-preenche o software do primeiro item.
  useEffect(() => {
    const sw = searchParams.get('software');
    if (sw) setItens((prev) => prev.map((it, i) => (i === 0 ? { ...it, softwareId: sw } : it)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fornecedorOptions: SearchSelectOption[] = fornecedores
    .filter((f) => f.status === 'ATIVO')
    .map((f) => ({ value: f.id, label: f.nome, sublabel: `${f.codigo}${f.loja ? '/' + f.loja : ''}` }));
  const softwareOptions: SearchSelectOption[] = softwares.map((s) => ({ value: s.id, label: s.nome, sublabel: s.fabricante || undefined }));

  function updateItem(key: number, patch: Partial<ItemForm>) {
    setItens((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }
  function addItem() { setItens((prev) => [...prev, newItem()]); }
  function removeItem(key: number) { setItens((prev) => (prev.length > 1 ? prev.filter((it) => it.key !== key) : prev)); }

  function itemTotal(it: ItemForm): number {
    const q = parseInt(it.quantidade) || 0;
    const v = parseFloat(it.valorUnitario) || 0;
    return q && v ? q * v : v;
  }
  const totalNota = itens.reduce((s, it) => s + itemTotal(it), 0);

  async function handleSalvar() {
    setErro('');
    if (!semNota && !numero.trim()) { setErro('Informe o número da NF ou marque "Sem nota fiscal"'); return; }
    for (const it of itens) {
      if (!it.softwareId && !it.nome.trim()) { setErro('Cada licença precisa de um software ou de um nome (avulsa)'); return; }
      if (!it.departamentoId) { setErro('Informe o "Depto Licença Alocada" de cada licença'); return; }
    }
    const itensPayload: LicencaItemPayload[] = itens.map((it) => ({
      softwareId: it.softwareId || undefined,
      nome: it.softwareId ? undefined : it.nome.trim() || undefined,
      categoriaId: it.softwareId ? undefined : it.categoriaId || undefined,
      modeloLicenca: it.modeloLicenca || undefined,
      quantidade: it.quantidade ? parseInt(it.quantidade) : undefined,
      valorUnitario: it.valorUnitario ? parseFloat(it.valorUnitario) : undefined,
      chaveSerial: it.chaveSerial || undefined,
      observacoes: it.observacoes || undefined,
      departamentoId: it.departamentoId,
    }));
    setSaving(true);
    try {
      const nota = await licencaCompraService.criar({
        numero: semNota ? undefined : numero.trim(),
        semNota,
        dataLancamento,
        dataVencimento: dataVencimento || undefined,
        fornecedorId: semNota ? undefined : fornecedorId || undefined,
        fornecedor: fornecedorTexto || undefined,
        chaveNfe: semNota ? undefined : (chaveNfe || undefined),
        observacao: observacao || undefined,
        itens: itensPayload,
      });
      toast('success', 'Nota de licenças registrada');
      // Se veio do detalhe de um software ("Nova Nota com este software"),
      // volta pra ele (a licença nova aparece na lista). Senão, vai pro detalhe da nota.
      const origemSoftware = searchParams.get('software');
      navigate(origemSoftware ? `/gestao-ti/softwares/${origemSoftware}` : `/gestao-ti/licencas/${nota.id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErro(Array.isArray(msg) ? msg.join(', ') : (msg || 'Erro ao salvar'));
    }
    setSaving(false);
  }

  return (
    <>
      <Header title="Nova Nota de Licenças" />
      <div className="p-6 max-w-5xl">
        {/* Cabeçalho */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700 uppercase flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-capul-500" /> Dados da Nota Fiscal de compra
            </h3>
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input type="checkbox" checked={semNota} onChange={(e) => setSemNota(e.target.checked)} className="accent-capul-600" />
              Sem nota fiscal (S/N)
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Número NF {!semNota && '*'}</label>
              <input type="text" value={semNota ? 'S/N' : numero} disabled={semNota} maxLength={20}
                onChange={(e) => setNumero(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600 disabled:bg-slate-100 disabled:text-slate-500"
                placeholder="123456" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data Lançamento *</label>
              <input type="date" value={dataLancamento} onChange={(e) => setDataLancamento(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Vencimento</label>
              <input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fornecedor (cadastro)</label>
              <SearchSelect options={fornecedorOptions} value={fornecedorId} onChange={setFornecedorId} placeholder="Buscar fornecedor..." />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fornecedor (texto livre)</label>
              <input type="text" value={fornecedorTexto} onChange={(e) => setFornecedorTexto(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600"
                placeholder="Opcional — fornecedor sem cadastro" />
            </div>
            {!semNota && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Chave NF-e</label>
                <input type="text" inputMode="numeric" maxLength={44} value={chaveNfe}
                  onChange={(e) => setChaveNfe(e.target.value.replace(/\D/g, ''))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono tracking-tight focus:outline-none focus:ring-2 focus:ring-capul-600"
                  placeholder="44 dígitos" />
              </div>
            )}
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">Observação</label>
            <input type="text" value={observacao} onChange={(e) => setObservacao(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600"
              placeholder="Observações gerais da nota" />
          </div>
        </div>

        {/* Itens = Licenças */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700 uppercase">Licenças (itens da nota)</h3>
            <button type="button" onClick={addItem} className="flex items-center gap-1 text-sm text-capul-600 hover:text-capul-700">
              <Plus className="w-4 h-4" /> Adicionar Licença
            </button>
          </div>
          <div className="space-y-4">
            {itens.map((it, idx) => (
              <div key={it.key} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-500">Licença {idx + 1}</span>
                  {itens.length > 1 && (
                    <button type="button" onClick={() => removeItem(it.key)} className="text-red-500 hover:text-red-700" title="Remover">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Software</label>
                    <SearchSelect options={softwareOptions} value={it.softwareId} onChange={(v) => updateItem(it.key, { softwareId: v })} placeholder="Vincular a software..." />
                  </div>
                  {!it.softwareId && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Nome (avulsa) *</label>
                        <input type="text" value={it.nome} onChange={(e) => updateItem(it.key, { nome: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Ex.: Certificado A1" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Categoria</label>
                        <select value={it.categoriaId} onChange={(e) => updateItem(it.key, { categoriaId: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                          <option value="">—</option>
                          {categorias.filter((c) => c.status === 'ATIVO').map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                      </div>
                    </>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Modelo</label>
                    <select value={it.modeloLicenca} onChange={(e) => updateItem(it.key, { modeloLicenca: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                      <option value="">—</option>
                      {Object.entries(modeloLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Qtd</label>
                    <input type="number" min={1} value={it.quantidade} onChange={(e) => updateItem(it.key, { quantidade: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Valor Unit.</label>
                    <input type="number" min={0} step="0.01" value={it.valorUnitario} onChange={(e) => updateItem(it.key, { valorUnitario: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Total</label>
                    <div className="w-full border border-slate-200 bg-slate-100 rounded-lg px-3 py-2 text-sm text-slate-700 font-medium">
                      R$ {itemTotal(it).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Chave Serial</label>
                    <input type="text" value={it.chaveSerial} onChange={(e) => updateItem(it.key, { chaveSerial: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="md:col-span-2">
                    <DepartamentoField value={it.departamentoId} onChange={(v) => updateItem(it.key, { departamentoId: v })} escopoLivre label="Depto Licença Alocada *" help="Onde ESTA licença é usada (livre — qualquer depto)." />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Observação do item</label>
                  <input type="text" value={it.observacoes} onChange={(e) => updateItem(it.key, { observacoes: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <div className="bg-capul-50 border border-capul-200 rounded-lg px-6 py-3 text-right">
              <span className="text-sm text-slate-600">Total da Nota: </span>
              <span className="text-lg font-bold text-capul-700">R$ {totalNota.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {erro && <p className="text-sm text-red-600 mb-3">{erro}</p>}

        <div className="flex gap-3">
          <button onClick={handleSalvar} disabled={saving} className="bg-capul-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-capul-700 disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
          <button onClick={() => { const o = searchParams.get('software'); navigate(o ? `/gestao-ti/softwares/${o}` : '/gestao-ti/licencas'); }} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2.5">Cancelar</button>
        </div>
      </div>
    </>
  );
}
