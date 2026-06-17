import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Banknote, Image as ImageIcon, Loader2, Paperclip, X } from 'lucide-react';
import { logisticaApi } from '../services/api';
import { useToast } from '../components/Toast';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';

// Lançamento de despesa em PÁGINA dedicada (modelo da Nova Entrega: Lista →
// Formulário). A tela /despesas é o painel; aqui é só o cadastro. Lançamento
// direto (supervisor/gestor) entra APROVADA.

interface TipoDespesa { id: string; nome: string; ativo: boolean }
interface FornecedorDespesa { id: string; nome: string; ativo: boolean }
interface VeiculoItem { id: string; placa: string; modelo?: string | null }

const errMsg = (e: unknown, fb: string) => {
  const m = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return Array.isArray(m) ? m.join(', ') : (typeof m === 'string' ? m : fb);
};

export function DespesaNovaPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [veiculos, setVeiculos] = useState<VeiculoItem[]>([]);
  const [tipos, setTipos] = useState<TipoDespesa[]>([]);
  const [fornecedores, setFornecedores] = useState<FornecedorDespesa[]>([]);

  const [veiculoId, setVeiculoId] = useState('');
  const [tipoDespesaId, setTipoDespesaId] = useState('');
  const [valor, setValor] = useState('');
  const [dataDespesa, setDataDespesa] = useState(new Date().toISOString().slice(0, 10));
  const [fornecedorId, setFornecedorId] = useState('');
  const [fornecedor, setFornecedor] = useState('');
  const [observacao, setObservacao] = useState('');
  const [recibo, setRecibo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [dirty, setDirty] = useState(false);
  const { ConfirmDialog: DirtyDialog, guardedNavigate } = useUnsavedChanges(dirty);
  const veiculoRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [v, t, f] = await Promise.all([
          logisticaApi.get<VeiculoItem[]>('/veiculos'),
          logisticaApi.get<TipoDespesa[]>('/despesas/tipos', { params: { ativos: 'true' } }),
          logisticaApi.get<FornecedorDespesa[]>('/despesas/fornecedores', { params: { ativos: 'true' } }),
        ]);
        setVeiculos(v.data); setTipos(t.data); setFornecedores(f.data);
      } catch (e) {
        toast('error', errMsg(e, 'Falha ao carregar os dados do lançamento.'));
      }
    })();
    veiculoRef.current?.focus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const escolherRecibo = (f: File | null) => {
    setRecibo(f);
    setPreview(f && f.type.startsWith('image/') ? URL.createObjectURL(f) : null);
    setDirty(true);
  };

  // Enter não submete (só o botão grava) — exceto em textarea.
  function bloquearEnterSubmit(e: KeyboardEvent<HTMLFormElement>) {
    const alvo = e.target as HTMLElement;
    if (e.key === 'Enter' && alvo.tagName !== 'TEXTAREA') e.preventDefault();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!veiculoId) { toast('warning', 'Selecione o veículo.'); return; }
    if (!tipoDespesaId) { toast('warning', 'Selecione o tipo de despesa.'); return; }
    if (valor === '' || Number(valor) <= 0) { toast('warning', 'Informe um valor válido.'); return; }
    setSalvando(true);
    try {
      // Com recibo → multipart (FormData); sem recibo → JSON. O backend aceita os dois.
      if (recibo) {
        const fd = new FormData();
        fd.append('veiculoId', veiculoId);
        fd.append('tipoDespesaId', tipoDespesaId);
        fd.append('valor', String(Number(valor)));
        if (dataDespesa) fd.append('dataDespesa', new Date(dataDespesa).toISOString());
        if (fornecedorId) fd.append('fornecedorId', fornecedorId);
        if (fornecedor.trim()) fd.append('fornecedor', fornecedor.trim());
        if (observacao.trim()) fd.append('observacao', observacao.trim());
        fd.append('comprovante', recibo);
        await logisticaApi.post('/despesas', fd);
      } else {
        await logisticaApi.post('/despesas', {
          veiculoId, tipoDespesaId, valor: Number(valor),
          dataDespesa: dataDespesa ? new Date(dataDespesa).toISOString() : undefined,
          fornecedorId: fornecedorId || undefined,
          fornecedor: fornecedor.trim() || undefined, observacao: observacao.trim() || undefined,
        });
      }
      toast('success', 'Despesa lançada (aprovada).');
      setDirty(false);
      navigate('/despesas');
    } catch (e) {
      toast('error', errMsg(e, 'Falha ao lançar despesa.'));
    } finally {
      setSalvando(false);
    }
  }

  const inp = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none';
  const lbl = 'block text-xs font-medium text-slate-500';

  return (
    <div className="mx-auto max-w-4xl" onChange={() => setDirty(true)}>
      {DirtyDialog}
      <button onClick={() => guardedNavigate('/despesas')}
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Voltar para Despesas
      </button>

      <form onSubmit={submit} onKeyDown={bloquearEnterSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Lançar despesa</h2>
          <p className="text-sm text-slate-500">Entra como <b>aprovada</b> (lançamento direto do supervisor / gestor de frota).</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={lbl}>Veículo *</label>
            <select ref={veiculoRef} value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)} className={inp}>
              <option value="">Selecione…</option>
              {veiculos.map((v) => <option key={v.id} value={v.id}>{v.placa}{v.modelo ? ` — ${v.modelo}` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Tipo de despesa *</label>
            <select value={tipoDespesaId} onChange={(e) => setTipoDespesaId(e.target.value)} className={inp}>
              <option value="">Selecione…</option>
              {tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Valor (R$) *</label>
            <input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} className={inp} />
          </div>
          <div>
            <label className={lbl}>Data</label>
            <input type="date" value={dataDespesa} onChange={(e) => setDataDespesa(e.target.value)} className={inp} />
          </div>
          <div>
            <label className={lbl}>Fornecedor (cadastrado)</label>
            <select value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)} className={inp}>
              <option value="">— Não definido —</option>
              {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Fornecedor (livre, se não cadastrado)</label>
            <input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} maxLength={120} placeholder="ex.: posto não listado" className={inp} />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className={lbl}>Observação (opcional)</label>
            <input value={observacao} onChange={(e) => setObservacao(e.target.value)} maxLength={255} className={inp} />
          </div>
        </div>

        <div>
          <label className={lbl}>Recibo / cupom (opcional)</label>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
              <Paperclip className="h-4 w-4 text-slate-400" />
              {recibo ? 'Trocar arquivo' : 'Anexar foto/PDF'}
              <input type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={(e) => escolherRecibo(e.target.files?.[0] ?? null)} />
            </label>
            {recibo && (
              <span className="inline-flex items-center gap-2 text-slate-500">
                {preview ? <img src={preview} alt="prévia" className="h-10 w-10 rounded border border-slate-200 object-cover" /> : <ImageIcon className="h-5 w-5 text-slate-400" />}
                <span className="max-w-[14rem] truncate">{recibo.name}</span>
                <button type="button" onClick={() => escolherRecibo(null)} className="text-slate-400 hover:text-rose-500"><X className="h-4 w-4" /></button>
              </span>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => guardedNavigate('/despesas')} className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">Cancelar</button>
          <button type="submit" disabled={salvando}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-5 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />} Lançar despesa
          </button>
        </div>
      </form>
    </div>
  );
}
