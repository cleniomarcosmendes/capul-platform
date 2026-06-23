import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Banknote, Image as ImageIcon, Loader2, Paperclip, X } from 'lucide-react';
import { logisticaApi } from '../services/api';
import { useToast } from '../components/Toast';
import { useAuth } from '../contexts/AuthContext';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { maskMoeda, parseMoeda, moedaParaInput } from '../utils/format';

// Lançamento de despesa em PÁGINA dedicada (modelo da Nova Entrega: Lista →
// Formulário). A tela /despesas é o painel; aqui é só o cadastro. Lançamento
// direto (supervisor/gestor) entra APROVADA.

interface TipoDespesa { id: string; nome: string; ativo: boolean }
interface FornecedorDespesa { id: string; nome: string; ativo: boolean }
interface VeiculoItem { id: string; placa: string; modelo?: string | null }
// Contexto read-only da despesa (mostrado na edição — "todas as informações").
interface DespesaInfo {
  situacao: string; placa: string; modelo?: string | null;
  autorNome?: string | null; autorMatricula?: string | null;
  criadoEm?: string | null; aprovadoEm?: string | null; motivoContestacao?: string | null;
  viagemId?: string | null; viagemNumero?: number | null; viagemFinalidade?: string | null; viagemCondutor?: string | null;
  anormalidade?: boolean; motivoAnormalidade?: string | null;
  numeroDocumento?: string | null; semNota?: boolean;
  temComprovante?: boolean;
}

const SIT_META: Record<string, { label: string; cls: string }> = {
  PENDENTE: { label: 'Pendente', cls: 'bg-amber-100 text-amber-700' },
  APROVADA: { label: 'Aprovada', cls: 'bg-emerald-100 text-emerald-700' },
  CONTESTADA: { label: 'Contestada', cls: 'bg-rose-100 text-rose-700' },
};
const fmtDateTime = (s?: string | null) => (s ? new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const errMsg = (e: unknown, fb: string) => {
  const m = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return Array.isArray(m) ? m.join(', ') : (typeof m === 'string' ? m : fb);
};

export function DespesaNovaPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  // Cria e edita na mesma página (padrão FormPage do workspace). Com :id → edição.
  const { id: edicaoId } = useParams<{ id: string }>();
  const modoEdicao = !!edicaoId;

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
  // Nota fiscal / documento (+ sem nota, padrão Licença do Workspace).
  const [numeroDocumento, setNumeroDocumento] = useState('');
  const [semNota, setSemNota] = useState(false);
  // Rateio (só na criação): 1 nota → várias linhas (tipo + valor).
  const [rateio, setRateio] = useState(false);
  const [linhas, setLinhas] = useState<{ tipoDespesaId: string; valor: string }[]>([{ tipoDespesaId: '', valor: '' }]);
  const [recibo, setRecibo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [info, setInfo] = useState<DespesaInfo | null>(null); // contexto read-only (edição)
  // Anormalidade (mau uso) — só gestor; salva à parte (endpoint próprio).
  const { logisticaRole } = useAuth();
  const ehGestor = logisticaRole === 'GESTOR_FROTA' || logisticaRole === 'ADMIN';
  const [anormal, setAnormal] = useState(false);
  const [motivoAnormal, setMotivoAnormal] = useState('');
  const [salvandoAnormal, setSalvandoAnormal] = useState(false);

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
    if (!modoEdicao) veiculoRef.current?.focus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Edição: carrega a despesa e pré-preenche.
  useEffect(() => {
    if (!edicaoId) return;
    void (async () => {
      try {
        const { data: d } = await logisticaApi.get<DespesaInfo & {
          veiculoId: string; tipoDespesaId: string; valor: number; dataDespesa: string;
          fornecedorId?: string | null; fornecedor?: string | null; observacao?: string | null;
        }>(`/despesas/${edicaoId}`);
        setVeiculoId(d.veiculoId);
        setTipoDespesaId(d.tipoDespesaId);
        setValor(moedaParaInput(d.valor));
        setDataDespesa(d.dataDespesa ? d.dataDespesa.slice(0, 10) : '');
        setFornecedorId(d.fornecedorId ?? '');
        setFornecedor(d.fornecedor ?? '');
        setObservacao(d.observacao ?? '');
        setNumeroDocumento(d.numeroDocumento ?? '');
        setSemNota(!!d.semNota);
        setAnormal(!!d.anormalidade);
        setMotivoAnormal(d.motivoAnormalidade ?? '');
        setInfo(d);
      } catch (e) {
        toast('error', errMsg(e, 'Despesa não encontrada.'));
        navigate('/despesas', { replace: true });
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edicaoId]);

  const verRecibo = async () => {
    if (!edicaoId) return;
    try {
      const { data } = await logisticaApi.get(`/despesas/${edicaoId}/comprovante`, { responseType: 'blob' });
      window.open(URL.createObjectURL(data as Blob), '_blank', 'noopener');
    } catch (e) { toast('error', errMsg(e, 'Falha ao abrir o recibo.')); }
  };

  const salvarAnormalidade = async () => {
    if (!edicaoId) return;
    setSalvandoAnormal(true);
    try {
      await logisticaApi.patch(`/despesas/${edicaoId}/anormalidade`, { anormalidade: anormal, motivo: anormal ? motivoAnormal.trim() || undefined : undefined });
      setInfo((prev) => (prev ? { ...prev, anormalidade: anormal, motivoAnormalidade: anormal ? motivoAnormal.trim() : null } : prev));
      toast('success', anormal ? 'Despesa sinalizada como anormalidade.' : 'Anormalidade removida.');
    } catch (e) { toast('error', errMsg(e, 'Falha ao salvar a anormalidade.')); }
    finally { setSalvandoAnormal(false); }
  };

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

  // Liga/desliga o rateio carregando o que já foi digitado, para não "sumir" o
  // valor: ao ligar, tipo+valor viram a 1ª linha; ao desligar, a 1ª linha volta
  // para os campos simples.
  function toggleRateio(on: boolean) {
    if (on) {
      setSemNota(false);
      if (tipoDespesaId || valor) setLinhas([{ tipoDespesaId, valor }]);
    } else {
      const primeira = linhas[0];
      if (primeira && (primeira.tipoDespesaId || primeira.valor)) {
        setTipoDespesaId(primeira.tipoDespesaId);
        setValor(primeira.valor);
      }
    }
    setRateio(on);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!veiculoId) { toast('warning', 'Selecione o veículo.'); return; }
    if (!semNota && !rateio && !numeroDocumento.trim()) { /* nota é opcional fora do rateio */ }
    if (rateio && !numeroDocumento.trim()) { toast('warning', 'Informe o número da nota para ratear.'); return; }

    // Edição (PATCH): só os campos editáveis; não troca veículo nem recibo.
    if (modoEdicao) {
      if (!tipoDespesaId) { toast('warning', 'Selecione o tipo de despesa.'); return; }
      if (valor === '' || parseMoeda(valor) <= 0) { toast('warning', 'Informe um valor válido.'); return; }
      setSalvando(true);
      try {
        await logisticaApi.patch(`/despesas/${edicaoId}`, {
          tipoDespesaId, valor: parseMoeda(valor),
          dataDespesa: dataDespesa ? new Date(dataDespesa).toISOString() : undefined,
          fornecedorId: fornecedorId || '',
          fornecedor: fornecedor.trim(),
          observacao: observacao.trim(),
          numeroDocumento: semNota ? '' : numeroDocumento.trim(),
          semNota,
        });
        toast('success', 'Despesa atualizada.');
        setDirty(false);
        navigate('/despesas');
      } catch (e) {
        toast('error', errMsg(e, 'Falha ao salvar as alterações.'));
      } finally {
        setSalvando(false);
      }
      return;
    }

    // ---- Criação ----
    // Rateio: 1 nota → várias linhas (tipo + valor) → /despesas/ratear.
    if (rateio) {
      const itens = linhas
        .filter((l) => l.tipoDespesaId && l.valor !== '' && parseMoeda(l.valor) > 0)
        .map((l) => ({ tipoDespesaId: l.tipoDespesaId, valor: parseMoeda(l.valor) }));
      if (itens.length === 0) { toast('warning', 'Adicione ao menos uma linha (tipo + valor) ao rateio.'); return; }
      if (new Set(itens.map((i) => i.tipoDespesaId)).size !== itens.length) { toast('warning', 'Cada tipo só pode aparecer uma vez no rateio.'); return; }
      setSalvando(true);
      try {
        const fd = new FormData();
        fd.append('veiculoId', veiculoId);
        fd.append('numeroDocumento', numeroDocumento.trim());
        if (dataDespesa) fd.append('dataDespesa', new Date(dataDespesa).toISOString());
        if (fornecedorId) fd.append('fornecedorId', fornecedorId);
        if (fornecedor.trim()) fd.append('fornecedor', fornecedor.trim());
        if (observacao.trim()) fd.append('observacao', observacao.trim());
        fd.append('itens', JSON.stringify(itens));
        if (recibo) fd.append('comprovante', recibo);
        await logisticaApi.post('/despesas/ratear', fd);
        toast('success', `Rateio lançado: ${itens.length} despesa(s) aprovada(s).`);
        setDirty(false);
        navigate('/despesas');
      } catch (e) {
        toast('error', errMsg(e, 'Falha ao lançar o rateio.'));
      } finally {
        setSalvando(false);
      }
      return;
    }

    // Despesa simples.
    if (!tipoDespesaId) { toast('warning', 'Selecione o tipo de despesa.'); return; }
    if (valor === '' || parseMoeda(valor) <= 0) { toast('warning', 'Informe um valor válido.'); return; }
    setSalvando(true);
    const docFields = { numeroDocumento: semNota ? undefined : (numeroDocumento.trim() || undefined), semNota: semNota || undefined };
    try {
      // Com recibo → multipart (FormData); sem recibo → JSON. O backend aceita os dois.
      if (recibo) {
        const fd = new FormData();
        fd.append('veiculoId', veiculoId);
        fd.append('tipoDespesaId', tipoDespesaId);
        fd.append('valor', String(parseMoeda(valor)));
        if (dataDespesa) fd.append('dataDespesa', new Date(dataDespesa).toISOString());
        if (fornecedorId) fd.append('fornecedorId', fornecedorId);
        if (fornecedor.trim()) fd.append('fornecedor', fornecedor.trim());
        if (observacao.trim()) fd.append('observacao', observacao.trim());
        if (docFields.numeroDocumento) fd.append('numeroDocumento', docFields.numeroDocumento);
        if (semNota) fd.append('semNota', 'true');
        fd.append('comprovante', recibo);
        await logisticaApi.post('/despesas', fd);
      } else {
        await logisticaApi.post('/despesas', {
          veiculoId, tipoDespesaId, valor: parseMoeda(valor),
          dataDespesa: dataDespesa ? new Date(dataDespesa).toISOString() : undefined,
          fornecedorId: fornecedorId || undefined,
          fornecedor: fornecedor.trim() || undefined, observacao: observacao.trim() || undefined,
          ...docFields,
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

  const inp = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-capul-500 focus:outline-none';
  const lbl = 'block text-xs font-medium text-slate-500';

  return (
    <div className="mx-auto max-w-4xl" onChange={() => setDirty(true)}>
      {DirtyDialog}
      <button onClick={() => guardedNavigate('/despesas')}
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Voltar para Despesas
      </button>

      <form onSubmit={submit} onKeyDown={bloquearEnterSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white shadow-sm p-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">{modoEdicao ? 'Editar despesa' : 'Lançar despesa'}</h2>
          <p className="text-sm text-slate-500">
            {modoEdicao
              ? 'Correção do lançamento (veículo e recibo não mudam aqui).'
              : <>Entra como <b>aprovada</b> (lançamento direto do supervisor / gestor de frota).</>}
          </p>
        </div>

        {modoEdicao && info && (
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Informações da despesa</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${(SIT_META[info.situacao] ?? { cls: 'bg-slate-100 text-slate-600' }).cls}`}>
                {(SIT_META[info.situacao] ?? { label: info.situacao }).label}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
              <InfoItem rotulo="Veículo" valor={`${info.placa}${info.modelo ? ` · ${info.modelo}` : ''}`} />
              <InfoItem rotulo="Autor" valor={info.autorNome ? `${info.autorNome}${info.autorMatricula ? ` · ${info.autorMatricula}` : ''}` : '—'} />
              <InfoItem rotulo="Lançada em" valor={fmtDateTime(info.criadoEm)} />
              <InfoItem rotulo="Nota / documento" valor={info.semNota ? 'Sem nota (S/N)' : (info.numeroDocumento || '—')} />
              {info.viagemNumero != null && (
                <InfoItem rotulo="Viagem vinculada" valor={`#${info.viagemNumero}${info.viagemFinalidade ? ` · ${info.viagemFinalidade}` : ''}${info.viagemCondutor ? ` · ${info.viagemCondutor}` : ''}`} />
              )}
              {info.situacao === 'APROVADA' && <InfoItem rotulo="Aprovada em" valor={fmtDateTime(info.aprovadoEm)} />}
              {info.situacao === 'CONTESTADA' && <InfoItem rotulo="Motivo da contestação" valor={info.motivoContestacao ?? '—'} />}
              <div>
                <p className="text-xs text-slate-400">Recibo</p>
                {info.temComprovante ? (
                  <button type="button" onClick={() => void verRecibo()} className="mt-0.5 inline-flex items-center gap-1 rounded border border-capul-200 bg-capul-50 px-1.5 py-0.5 text-xs font-medium text-capul-700 hover:bg-capul-100">
                    <Paperclip className="h-3 w-3" /> Ver recibo
                  </button>
                ) : <p className="font-medium text-slate-500">Sem recibo</p>}
              </div>
            </div>
          </div>
        )}

        {modoEdicao && ehGestor && (
          <div className={`rounded-lg border p-4 ${anormal ? 'border-orange-300 bg-orange-50/70' : 'border-slate-200 bg-slate-50/70'}`}>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={anormal} onChange={(e) => setAnormal(e.target.checked)} className="h-4 w-4 accent-orange-600" />
              <AlertTriangle className={`h-4 w-4 ${anormal ? 'text-orange-600' : 'text-slate-400'}`} />
              Anormalidade (mau uso do veículo)
            </label>
            <p className="mt-1 text-xs text-slate-400">Marque quando a despesa decorre de uso indevido — fica destacada e segregada na Análise da Frota, sem distorcer o custo normal do veículo.</p>
            {anormal && (
              <input value={motivoAnormal} onChange={(e) => setMotivoAnormal(e.target.value)} maxLength={255} placeholder="Motivo (opcional) — ex.: avaria por imprudência"
                className="mt-2 w-full rounded-lg border border-orange-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none" />
            )}
            <div className="mt-2">
              <button type="button" onClick={() => void salvarAnormalidade()} disabled={salvandoAnormal}
                className="inline-flex items-center gap-2 rounded-lg border border-orange-300 bg-white px-3 py-1.5 text-sm font-medium text-orange-700 hover:bg-orange-100 disabled:opacity-50">
                {salvandoAnormal ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />} Salvar anormalidade
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={lbl}>Veículo *</label>
            <select ref={veiculoRef} value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)} disabled={modoEdicao}
              className={`${inp} disabled:bg-slate-100 disabled:text-slate-500`}>
              <option value="">Selecione…</option>
              {veiculos.map((v) => <option key={v.id} value={v.id}>{v.placa}{v.modelo ? ` — ${v.modelo}` : ''}</option>)}
            </select>
          </div>
          {!rateio && (
            <>
              <div>
                <label className={lbl}>Tipo de despesa *</label>
                <select value={tipoDespesaId} onChange={(e) => setTipoDespesaId(e.target.value)} className={inp}>
                  <option value="">Selecione…</option>
                  {tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Valor (R$) *</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={valor}
                  onChange={(e) => setValor(maskMoeda(e.target.value))}
                  placeholder="0,00"
                  className={inp}
                />
              </div>
            </>
          )}
          <div>
            <label className={lbl}>Data</label>
            <input type="date" value={dataDespesa} onChange={(e) => setDataDespesa(e.target.value)} className={inp} />
          </div>
          <div>
            <label className={lbl}>Nº nota / documento {rateio && '*'}</label>
            <input value={semNota ? 'S/N' : numeroDocumento} disabled={semNota} maxLength={60}
              onChange={(e) => setNumeroDocumento(e.target.value)} placeholder="ex.: 12345 ou nota de débito"
              className={`${inp} disabled:bg-slate-100 disabled:text-slate-500`} />
            {!rateio && (
              <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={semNota} onChange={(e) => { setSemNota(e.target.checked); if (e.target.checked) setNumeroDocumento(''); }} className="h-4 w-4 accent-capul-600" />
                Sem nota fiscal <span className="text-xs text-slate-400">(ex.: nota de débito, sem documento)</span>
              </label>
            )}
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

        {!modoEdicao && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={rateio} onChange={(e) => toggleRateio(e.target.checked)} className="h-4 w-4 accent-capul-600" />
            Ratear esta nota em vários tipos de despesa
            <span className="text-xs text-slate-400">— ex.: uma nota com pneu + alinhamento no mesmo veículo</span>
          </label>
        )}

        {!modoEdicao && rateio && (
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Linhas do rateio (mesma nota, tipos distintos)</p>
            <div className="space-y-2">
              {linhas.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select value={l.tipoDespesaId} onChange={(e) => setLinhas((ls) => ls.map((x, j) => (j === i ? { ...x, tipoDespesaId: e.target.value } : x)))}
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="">Tipo de despesa…</option>
                    {tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                  <input value={l.valor} inputMode="decimal" placeholder="0,00"
                    onChange={(e) => setLinhas((ls) => ls.map((x, j) => (j === i ? { ...x, valor: maskMoeda(e.target.value) } : x)))}
                    className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-right text-sm" />
                  <button type="button" onClick={() => setLinhas((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : ls))}
                    disabled={linhas.length <= 1} className="text-slate-400 hover:text-rose-500 disabled:opacity-30"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <button type="button" onClick={() => setLinhas((ls) => [...ls, { tipoDespesaId: '', valor: '' }])}
                className="text-sm font-medium text-capul-600 hover:underline">+ Adicionar linha</button>
              <span className="text-sm text-slate-600">Total: <b>{linhas.reduce((s, l) => s + (l.valor ? parseMoeda(l.valor) : 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b></span>
            </div>
          </div>
        )}

        {!modoEdicao && (
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
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => guardedNavigate('/despesas')} className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">Cancelar</button>
          <button type="submit" disabled={salvando}
            className="inline-flex items-center gap-2 rounded-lg bg-capul-600 px-5 py-2 text-sm font-medium text-white hover:bg-capul-700 disabled:opacity-50">
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />} {modoEdicao ? 'Salvar alterações' : 'Lançar despesa'}
          </button>
        </div>
      </form>
    </div>
  );
}

function InfoItem({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{rotulo}</p>
      <p className="font-medium text-slate-700">{valor}</p>
    </div>
  );
}
