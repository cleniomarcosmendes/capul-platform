import { useEffect, useMemo, useState } from 'react';
import { Banknote, Check, Image as ImageIcon, Loader2, Paperclip, Plus, Tag, X } from 'lucide-react';
import { logisticaApi } from '../services/api';
import { useToast } from '../components/Toast';
import { useAuth } from '../contexts/AuthContext';

// Despesas da frota (Fase 2) com governança em 3 níveis. Padrão workspace:
// grid + formulários inline (sem modal). Lançamento direto (supervisor/gestor)
// já entra APROVADA; lançamento do motorista (matrícula+senha, na tela de Frota)
// entra PENDENTE e exige validação aqui.

interface TipoDespesa { id: string; nome: string; descricao?: string | null; ativo: boolean }
interface FornecedorDespesa { id: string; nome: string; ativo: boolean }
interface VeiculoItem { id: string; placa: string; modelo?: string | null }
interface Despesa {
  id: string; situacao: string; placa: string; modelo?: string | null; veiculoId: string;
  tipo: string; valor: number; dataDespesa: string; fornecedor?: string | null;
  observacao?: string | null; autorNome?: string | null; aprovadoEm?: string | null;
  motivoContestacao?: string | null; temComprovante?: boolean;
}
interface Indicadores { total: number; porVeiculo: { nome: string; valor: number }[]; porTipo: { nome: string; valor: number }[] }

const SIT_META: Record<string, { label: string; cls: string }> = {
  PENDENTE: { label: 'Pendente', cls: 'bg-amber-100 text-amber-700' },
  APROVADA: { label: 'Aprovada', cls: 'bg-emerald-100 text-emerald-700' },
  CONTESTADA: { label: 'Contestada', cls: 'bg-rose-100 text-rose-700' },
};
const BRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR') : '—');
const errMsg = (e: unknown, fb: string) => {
  const m = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return Array.isArray(m) ? m.join(', ') : (typeof m === 'string' ? m : fb);
};
const hoje = new Date();

export function DespesasPage() {
  const { logisticaRole } = useAuth();
  const ehGestor = logisticaRole === 'GESTOR_FROTA' || logisticaRole === 'ADMIN';
  const [tab, setTab] = useState<'despesas' | 'tipos' | 'fornecedores'>('despesas');

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Banknote className="h-6 w-6 text-sky-600" />
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Despesas da Frota</h2>
          <p className="text-sm text-slate-500">Custos por veículo, com validação do supervisor / gestor de frota.</p>
        </div>
      </div>

      {ehGestor && (
        <div className="flex gap-1 border-b border-slate-200">
          {(['despesas', 'tipos', 'fornecedores'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium ${tab === t ? 'border-b-2 border-sky-600 text-sky-700' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {t === 'despesas' ? 'Despesas' : t === 'tipos' ? 'Tipos de despesa' : 'Fornecedores'}
            </button>
          ))}
        </div>
      )}

      {tab === 'despesas' ? <DespesasTab /> : tab === 'tipos' ? <TiposTab /> : <FornecedoresTab />}
    </div>
  );
}

// ---- Aba Despesas ----
function DespesasTab() {
  const { toast } = useToast();
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [veiculos, setVeiculos] = useState<VeiculoItem[]>([]);
  const [tipos, setTipos] = useState<TipoDespesa[]>([]);
  const [ind, setInd] = useState<Indicadores | null>(null);
  const [loading, setLoading] = useState(true);
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [situacao, setSituacao] = useState('');
  const [veiculoFiltro, setVeiculoFiltro] = useState('');
  const [novo, setNovo] = useState(false);

  const carregar = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { mes, ano };
      if (situacao) params.situacao = situacao;
      if (veiculoFiltro) params.veiculoId = veiculoFiltro;
      const [d, v, t, i] = await Promise.all([
        logisticaApi.get<Despesa[]>('/despesas', { params }),
        logisticaApi.get<VeiculoItem[]>('/veiculos'),
        logisticaApi.get<TipoDespesa[]>('/despesas/tipos', { params: { ativos: 'true' } }),
        logisticaApi.get<Indicadores>('/despesas/indicadores', { params: { mes, ano } }),
      ]);
      setDespesas(d.data); setVeiculos(v.data); setTipos(t.data); setInd(i.data);
    } catch (e) {
      toast('error', errMsg(e, 'Falha ao carregar despesas.'));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void carregar(); /* eslint-disable-next-line */ }, [mes, ano, situacao, veiculoFiltro]);

  return (
    <div className="space-y-4">
      {ind && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <ResumoCard titulo="Total aprovado no mês" destaque={BRL(ind.total)} />
          <ResumoCard titulo="Por veículo" itens={ind.porVeiculo} />
          <ResumoCard titulo="Por tipo" itens={ind.porTipo} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
          {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2000, i, 1).toLocaleString('pt-BR', { month: 'long' })}</option>)}
        </select>
        <input type="number" value={ano} onChange={(e) => setAno(Number(e.target.value))} className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
        <select value={situacao} onChange={(e) => setSituacao(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">Todas situações</option>
          <option value="PENDENTE">Pendentes</option>
          <option value="APROVADA">Aprovadas</option>
          <option value="CONTESTADA">Contestadas</option>
        </select>
        <select value={veiculoFiltro} onChange={(e) => setVeiculoFiltro(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">Todos veículos</option>
          {veiculos.map((v) => <option key={v.id} value={v.id}>{v.placa}</option>)}
        </select>
        <div className="ml-auto">
          <button onClick={() => setNovo((s) => !s)} className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700">
            <Plus className="h-4 w-4" /> Lançar despesa
          </button>
        </div>
      </div>

      {novo && <LancarDespesaForm veiculos={veiculos} tipos={tipos} onClose={() => setNovo(false)} onDone={() => { setNovo(false); void carregar(); }} />}

      <div className="rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /> Carregando…</div>
        ) : despesas.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">Nenhuma despesa no período.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Data</th>
                <th className="px-4 py-2">Veículo</th>
                <th className="px-4 py-2">Tipo</th>
                <th className="px-4 py-2 text-right">Valor</th>
                <th className="px-4 py-2">Fornecedor</th>
                <th className="px-4 py-2">Autor</th>
                <th className="px-4 py-2">Situação</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {despesas.map((d) => (
                <LinhaDespesa key={d.id} d={d} onChanged={carregar} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ResumoCard({ titulo, destaque, itens }: { titulo: string; destaque?: string; itens?: { nome: string; valor: number }[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{titulo}</p>
      {destaque ? (
        <p className="mt-1 text-2xl font-semibold text-slate-800">{destaque}</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {(itens ?? []).slice(0, 4).map((i) => (
            <li key={i.nome} className="flex justify-between"><span className="text-slate-600">{i.nome}</span><span className="tabular-nums text-slate-800">{BRL(i.valor)}</span></li>
          ))}
          {(!itens || itens.length === 0) && <li className="text-slate-400">—</li>}
        </ul>
      )}
    </div>
  );
}

function LinhaDespesa({ d, onChanged }: { d: Despesa; onChanged: () => void }) {
  const { toast } = useToast();
  const sit = SIT_META[d.situacao] ?? { label: d.situacao, cls: 'bg-slate-100 text-slate-600' };
  const [contestando, setContestando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [busy, setBusy] = useState(false);

  const aprovar = async () => {
    setBusy(true);
    try { await logisticaApi.patch(`/despesas/${d.id}/aprovar`); toast('success', 'Despesa aprovada.'); onChanged(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao aprovar.')); } finally { setBusy(false); }
  };
  const contestar = async () => {
    if (!motivo.trim()) { toast('warning', 'Informe o motivo da contestação.'); return; }
    setBusy(true);
    try { await logisticaApi.patch(`/despesas/${d.id}/contestar`, { motivo: motivo.trim() }); toast('success', 'Despesa contestada.'); onChanged(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao contestar.')); } finally { setBusy(false); }
  };
  const verRecibo = async () => {
    setBusy(true);
    try {
      const { data } = await logisticaApi.get(`/despesas/${d.id}/comprovante`, { responseType: 'blob' });
      window.open(URL.createObjectURL(data as Blob), '_blank', 'noopener');
    } catch (e) { toast('error', errMsg(e, 'Falha ao abrir o recibo.')); } finally { setBusy(false); }
  };

  return (
    <>
      <tr className="hover:bg-slate-50">
        <td className="px-4 py-2 text-slate-600">{fmtDate(d.dataDespesa)}</td>
        <td className="px-4 py-2">{d.placa}{d.modelo ? <span className="text-slate-400"> · {d.modelo}</span> : null}</td>
        <td className="px-4 py-2">{d.tipo}</td>
        <td className="px-4 py-2 text-right tabular-nums">{BRL(d.valor)}</td>
        <td className="px-4 py-2 text-slate-600">
          <div className="flex items-center gap-2">
            <span>{d.fornecedor ?? '—'}</span>
            {d.temComprovante && (
              <button onClick={() => void verRecibo()} disabled={busy} title="Ver recibo" className="inline-flex items-center gap-1 rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-xs text-sky-700 hover:bg-sky-100 disabled:opacity-50">
                <Paperclip className="h-3 w-3" /> Recibo
              </button>
            )}
          </div>
        </td>
        <td className="px-4 py-2 text-slate-600">{d.autorNome ?? '—'}</td>
        <td className="px-4 py-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${sit.cls}`}>{sit.label}</span>
          {d.situacao === 'CONTESTADA' && d.motivoContestacao && <span className="ml-1 text-xs text-rose-500" title={d.motivoContestacao}>ⓘ</span>}
        </td>
        <td className="px-4 py-2 text-right">
          {d.situacao === 'PENDENTE' && (
            <div className="flex justify-end gap-2">
              <button onClick={() => void aprovar()} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
                <Check className="h-3.5 w-3.5" /> Aprovar
              </button>
              <button onClick={() => setContestando((s) => !s)} className="inline-flex items-center gap-1 rounded-lg border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50">
                <X className="h-3.5 w-3.5" /> Contestar
              </button>
            </div>
          )}
        </td>
      </tr>
      {contestando && d.situacao === 'PENDENTE' && (
        <tr>
          <td colSpan={8} className="bg-slate-50 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo da contestação" maxLength={255} className="min-w-[16rem] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
              <button onClick={() => void contestar()} disabled={busy} className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50">Confirmar contestação</button>
              <button onClick={() => setContestando(false)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-white">Cancelar</button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function LancarDespesaForm({ veiculos, tipos, onClose, onDone }: { veiculos: VeiculoItem[]; tipos: TipoDespesa[]; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [veiculoId, setVeiculoId] = useState('');
  const [tipoDespesaId, setTipoDespesaId] = useState('');
  const [valor, setValor] = useState('');
  const [dataDespesa, setDataDespesa] = useState(hoje.toISOString().slice(0, 10));
  const [fornecedorId, setFornecedorId] = useState('');
  const [fornecedores, setFornecedores] = useState<FornecedorDespesa[]>([]);
  const [fornecedor, setFornecedor] = useState('');
  const [observacao, setObservacao] = useState('');
  const [recibo, setRecibo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    logisticaApi.get<FornecedorDespesa[]>('/despesas/fornecedores', { params: { ativos: 'true' } })
      .then((r) => setFornecedores(r.data)).catch(() => {});
  }, []);

  const escolherRecibo = (f: File | null) => {
    setRecibo(f);
    setPreview(f && f.type.startsWith('image/') ? URL.createObjectURL(f) : null);
  };

  const salvar = async () => {
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
      onDone();
    } catch (e) {
      toast('error', errMsg(e, 'Falha ao lançar despesa.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Lançar despesa (entra como aprovada)</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-xs text-slate-600">Veículo
          <select value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Selecione…</option>
            {veiculos.map((v) => <option key={v.id} value={v.id}>{v.placa}{v.modelo ? ` — ${v.modelo}` : ''}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-600">Tipo
          <select value={tipoDespesaId} onChange={(e) => setTipoDespesaId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Selecione…</option>
            {tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-600">Valor (R$)
          <input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-xs text-slate-600">Data
          <input type="date" value={dataDespesa} onChange={(e) => setDataDespesa(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-xs text-slate-600">Fornecedor (cadastrado)
          <select value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">— Não definido —</option>
            {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-600">Fornecedor (livre, se não cadastrado)
          <input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} maxLength={120} placeholder="ex.: posto não listado" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-xs text-slate-600">Observação (opcional)
          <input value={observacao} onChange={(e) => setObservacao(e.target.value)} maxLength={255} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <div className="text-xs text-slate-600 md:col-span-3">Recibo / cupom (opcional)
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
      </div>
      <div className="mt-4 flex justify-end">
        <button onClick={() => void salvar()} disabled={salvando} className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Lançar
        </button>
      </div>
    </div>
  );
}

// ---- Aba Tipos de despesa (gestor de frota) ----
function FornecedoresTab() {
  const { toast } = useToast();
  const [fornecedores, setFornecedores] = useState<FornecedorDespesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    setLoading(true);
    try { const { data } = await logisticaApi.get<FornecedorDespesa[]>('/despesas/fornecedores'); setFornecedores(data); }
    catch (e) { toast('error', errMsg(e, 'Falha ao carregar fornecedores.')); } finally { setLoading(false); }
  };
  useEffect(() => { void carregar(); /* eslint-disable-next-line */ }, []);

  const criar = async () => {
    if (!nome.trim()) { toast('warning', 'Informe o nome.'); return; }
    setSalvando(true);
    try { await logisticaApi.post('/despesas/fornecedores', { nome: nome.trim() }); setNome(''); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao criar fornecedor.')); } finally { setSalvando(false); }
  };
  const toggle = async (f: FornecedorDespesa) => {
    try { await logisticaApi.patch(`/despesas/fornecedores/${f.id}`, { ativo: !f.ativo }); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao atualizar.')); }
  };

  const ativos = useMemo(() => fornecedores.filter((f) => f.ativo).length, [fornecedores]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-4">
        <label className="flex-1 text-xs text-slate-600">Novo fornecedor
          <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} placeholder="ex.: Posto Ipiranga Centro" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <button onClick={() => void criar()} disabled={salvando} className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Adicionar
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
          <Tag className="h-4 w-4 text-slate-400" /> Fornecedores ({ativos} ativos)
        </div>
        {loading ? (
          <div className="flex items-center gap-2 py-8 px-4 text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
        ) : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {fornecedores.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-700">{f.nome}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${f.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {f.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => void toggle(f)} className="text-xs text-sky-600 hover:underline">{f.ativo ? 'Inativar' : 'Ativar'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function TiposTab() {
  const { toast } = useToast();
  const [tipos, setTipos] = useState<TipoDespesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    setLoading(true);
    try { const { data } = await logisticaApi.get<TipoDespesa[]>('/despesas/tipos'); setTipos(data); }
    catch (e) { toast('error', errMsg(e, 'Falha ao carregar tipos.')); } finally { setLoading(false); }
  };
  useEffect(() => { void carregar(); /* eslint-disable-next-line */ }, []);

  const criar = async () => {
    if (!nome.trim()) { toast('warning', 'Informe o nome.'); return; }
    setSalvando(true);
    try { await logisticaApi.post('/despesas/tipos', { nome: nome.trim(), descricao: descricao.trim() || undefined }); setNome(''); setDescricao(''); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao criar tipo.')); } finally { setSalvando(false); }
  };
  const toggle = async (t: TipoDespesa) => {
    try { await logisticaApi.patch(`/despesas/tipos/${t.id}`, { ativo: !t.ativo }); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao atualizar.')); }
  };

  const ativos = useMemo(() => tipos.filter((t) => t.ativo).length, [tipos]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-4">
        <label className="flex-1 text-xs text-slate-600">Novo tipo de despesa
          <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} placeholder="ex.: Lavagem" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="flex-1 text-xs text-slate-600">Descrição (opcional)
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={255} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <button onClick={() => void criar()} disabled={salvando} className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Adicionar
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
          <Tag className="h-4 w-4 text-slate-400" /> Tipos ({ativos} ativos)
        </div>
        {loading ? (
          <div className="flex items-center gap-2 py-8 px-4 text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
        ) : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {tipos.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-700">{t.nome}</td>
                  <td className="px-4 py-2 text-slate-500">{t.descricao ?? '—'}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${t.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {t.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => void toggle(t)} className="text-xs text-sky-600 hover:underline">{t.ativo ? 'Inativar' : 'Ativar'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
