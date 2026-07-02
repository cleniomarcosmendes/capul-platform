import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, MapPin, Plus, Printer, Search, Trash2, User } from 'lucide-react';
import { logisticaApi } from '../services/api';
import { useToast } from '../components/toast-context';
import { errMsg } from './frota-utils';

interface Atividade { id: string; nome: string; ativo: boolean }
interface Regiao { id: string; nome: string; ativo: boolean }
interface Visita {
  id: string; sequencia: number; clienteMatricula?: string | null; clienteNome?: string | null;
  municipio?: string | null; propriedade?: string | null; observacao?: string | null; dataHora?: string | null;
  atividade?: { nome: string } | null; regiao?: { nome: string } | null;
}
interface DespesaV { id: string; valor: number | string; situacao: string; tipoDespesa?: { nome: string; categoria: string } | null; dataDespesa?: string | null }
interface ViagemDetalhe {
  id: string; numero: number; situacao: string; mesReferencia?: number | null; adiantamento?: string | number | null;
  condutorNome?: string | null; condutorMatricula?: string | null;
  regiao?: { id: string; nome: string } | null; paradas: Visita[]; despesas: DespesaV[];
}

const fmtMes = (m?: number | null) => (m ? `${String(m % 100).padStart(2, '0')}/${Math.floor(m / 100)}` : '—');
const brl = (v: unknown) => (v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const fmtData = (s?: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—');
const th = 'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500';
const inp = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500';

// Busca de cliente (Protheus SA1 + local) devolvendo dados ESTRUTURADOS p/ a visita.
interface EndP { logradouro?: string; bairro?: string | null; cidade?: string | null; uf?: string | null }
interface ClienteP { matricula: string; nome: string; enderecos: EndP[] }
interface ClienteL { id: string; nome: string; enderecos: EndP[] }
interface BuscaResp { clientesLocais: ClienteL[]; protheus?: { clientes: ClienteP[] } }
const fmtEnd = (e?: EndP | null) => (!e ? '' : [e.logradouro, e.bairro, e.cidade && e.uf ? `${e.cidade}/${e.uf}` : e.cidade].filter(Boolean).join(', '));

function BuscaCliente({ onPick }: { onPick: (c: { matricula?: string; nome: string; municipio?: string; local?: string }) => void }) {
  const [termo, setTermo] = useState('');
  const [resp, setResp] = useState<BuscaResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [aberto, setAberto] = useState(false);
  useEffect(() => {
    const t = termo.trim();
    if (t.length < 3) { setResp(null); setAberto(false); return; }
    setLoading(true);
    const h = setTimeout(async () => {
      try { const { data } = await logisticaApi.get<BuscaResp>('/cadastro/busca', { params: { termo: t } }); setResp(data); setAberto(true); }
      catch { setResp(null); } finally { setLoading(false); }
    }, 400);
    return () => clearTimeout(h);
  }, [termo]);
  const escolher = (c: { matricula?: string; nome: string; municipio?: string; local?: string }) => { onPick(c); setTermo(''); setResp(null); setAberto(false); };
  const linhasP = (resp?.protheus?.clientes ?? []).flatMap((c) => (c.enderecos.length ? c.enderecos : [null]).map((end) => ({ matricula: c.matricula, nome: c.nome, end })));
  const linhasL = (resp?.clientesLocais ?? []).flatMap((c) => (c.enderecos.length ? c.enderecos : [null]).map((end, ei) => ({ key: `${c.id}-${ei}`, nome: c.nome, end })));
  const temAlgo = linhasP.length > 0 || linhasL.length > 0;
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input value={termo} onChange={(e) => setTermo(e.target.value)} onFocus={() => { if (temAlgo) setAberto(true); }} onBlur={() => setTimeout(() => setAberto(false), 150)}
        placeholder="Buscar cliente (matrícula, nome ou telefone)…" className={`${inp} pl-8`} />
      {loading && <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}
      {aberto && termo.trim().length >= 3 && (
        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {!temAlgo ? (
            <div className="px-3 py-2.5 text-xs text-slate-400">{loading ? 'Buscando…' : 'Nenhum cliente. Para prospect, preencha o nome no campo abaixo.'}</div>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {linhasP.map((r, i) => (
                <li key={`p${i}`}>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => escolher({ matricula: r.matricula, nome: r.nome, municipio: r.end?.cidade ?? undefined, local: fmtEnd(r.end) || undefined })}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-capul-50">
                    <User className="mt-0.5 h-4 w-4 shrink-0 text-capul-600" />
                    <span className="min-w-0"><span className="font-medium text-slate-700">{r.nome}</span><span className="ml-1 rounded bg-slate-100 px-1 text-[10px] text-slate-500">{r.matricula}</span>{fmtEnd(r.end) && <span className="block text-xs text-slate-500">{fmtEnd(r.end)}</span>}</span>
                  </button>
                </li>
              ))}
              {linhasL.map((r) => (
                <li key={`l${r.key}`}>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => escolher({ nome: r.nome, municipio: r.end?.cidade ?? undefined, local: fmtEnd(r.end) || undefined })}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-capul-50">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <span className="min-w-0"><span className="font-medium text-slate-700">{r.nome}</span><span className="ml-1 text-[10px] text-slate-400">cadastro local</span>{fmtEnd(r.end) && <span className="block text-xs text-slate-500">{fmtEnd(r.end)}</span>}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function SupervisorViagemPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [v, setV] = useState<ViagemDetalhe | null>(null);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [regioes, setRegioes] = useState<Regiao[]>([]);
  const [loading, setLoading] = useState(true);
  // form da visita
  const [clienteMatricula, setCliMat] = useState('');
  const [clienteNome, setCliNome] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [atividadeId, setAtividadeId] = useState('');
  const [regiaoId, setRegiaoId] = useState('');
  const [propriedade, setPropriedade] = useState('');
  const [observacao, setObs] = useState('');
  const [dataVisita, setDataVisita] = useState('');
  const [salvando, setSalvando] = useState(false);
  // form da despesa
  const [tipos, setTipos] = useState<{ id: string; nome: string; categoria: string; ativo?: boolean }[]>([]);
  const [showDesp, setShowDesp] = useState(false);
  const [dTipo, setDTipo] = useState('');
  const [dValor, setDValor] = useState('');
  const [dData, setDData] = useState('');
  const [dFornecedor, setDForn] = useState('');
  const [dObs, setDObs] = useState('');
  const [salvandoDesp, setSalvandoDesp] = useState(false);

  const carregar = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [d, a, r, t] = await Promise.all([
        logisticaApi.get<ViagemDetalhe>(`/supervisor/viagens/${id}`),
        logisticaApi.get<Atividade[]>('/supervisor/atividades', { params: { ativos: true } }),
        logisticaApi.get<Regiao[]>('/supervisor/regioes', { params: { ativos: true } }),
        logisticaApi.get<{ id: string; nome: string; categoria: string; ativo?: boolean }[]>('/despesas/tipos'),
      ]);
      setV(d.data); setAtividades(a.data); setRegioes(r.data); setTipos(t.data.filter((x) => x.ativo !== false));
      if (d.data.regiao?.id && !regiaoId) setRegiaoId(d.data.regiao.id);
    } catch (e) { toast('error', errMsg(e, 'Falha ao carregar a viagem.')); } finally { setLoading(false); }
  };
  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const concluida = v?.situacao === 'CONCLUIDA';

  const limparForm = () => { setCliMat(''); setCliNome(''); setMunicipio(''); setAtividadeId(''); setPropriedade(''); setObs(''); setDataVisita(''); };

  const adicionar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteNome.trim()) { toast('warning', 'Informe o cliente (busque ou digite o nome para prospect).'); return; }
    setSalvando(true);
    try {
      await logisticaApi.post(`/supervisor/viagens/${id}/visitas`, {
        atividadeId: atividadeId || undefined,
        regiaoId: regiaoId || undefined,
        clienteMatricula: clienteMatricula.trim() || undefined,
        clienteNome: clienteNome.trim(),
        municipio: municipio.trim() || undefined,
        propriedade: propriedade.trim() || undefined,
        observacao: observacao.trim() || undefined,
        dataVisita: dataVisita || undefined,
      });
      toast('success', 'Visita registrada.');
      limparForm(); await carregar();
    } catch (e) { toast('error', errMsg(e, 'Falha ao registrar visita.')); } finally { setSalvando(false); }
  };

  const remover = async (visita: Visita) => {
    try { await logisticaApi.delete(`/supervisor/viagens/${id}/visitas/${visita.id}`); toast('success', 'Visita removida.'); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao remover.')); }
  };
  const concluir = async () => {
    try { await logisticaApi.patch(`/supervisor/viagens/${id}/concluir`); toast('success', 'Viagem concluída.'); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao concluir.')); }
  };

  const lancarDespesa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dTipo || !dValor) { toast('warning', 'Escolha o tipo e informe o valor.'); return; }
    setSalvandoDesp(true);
    try {
      await logisticaApi.post(`/supervisor/viagens/${id}/despesas`, {
        tipoDespesaId: dTipo, valor: Number(dValor), data: dData || undefined,
        fornecedor: dFornecedor.trim() || undefined, observacao: dObs.trim() || undefined,
      });
      toast('success', 'Despesa lançada.');
      setShowDesp(false); setDTipo(''); setDValor(''); setDData(''); setDForn(''); setDObs('');
      await carregar();
    } catch (e) { toast('error', errMsg(e, 'Falha ao lançar despesa.')); } finally { setSalvandoDesp(false); }
  };
  const removerDespesa = async (dId: string) => {
    try { await logisticaApi.delete(`/supervisor/viagens/${id}/despesas/${dId}`); toast('success', 'Despesa removida.'); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao remover.')); }
  };

  if (loading) return <div className="p-6 text-slate-500">Carregando…</div>;
  if (!v) return <div className="p-6 text-slate-500">Viagem não encontrada.</div>;

  const totalDespesas = v.despesas.reduce((s, d) => s + Number(d.valor), 0);

  return (
    <div className="p-6">
      <button onClick={() => navigate('/supervisores')} className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"><ArrowLeft className="h-4 w-4" /> Voltar</button>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Viagem #{v.numero} · {fmtMes(v.mesReferencia)}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {v.regiao?.nome ?? 'Sem região'} · Supervisor: {v.condutorNome ?? '—'} · Adiantamento: {brl(v.adiantamento)}
            <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${concluida ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>{concluida ? 'Concluída' : 'Em curso'}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(`/supervisores/viagens/${id}/rdv`)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"><Printer className="h-4 w-4" /> RDV</button>
          <button onClick={() => navigate(`/supervisores/viagens/${id}/visitas`)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"><Printer className="h-4 w-4" /> Visitas</button>
          {!concluida && <button onClick={() => void concluir()} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Concluir mês</button>}
        </div>
      </div>

      {!concluida && (
        <form onSubmit={adicionar} className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">Nova visita</h2>
          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-slate-500">Cliente</label>
            <BuscaCliente onPick={(c) => { setCliMat(c.matricula ?? ''); setCliNome(c.nome); if (c.municipio) setMunicipio(c.municipio); }} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div><label className="mb-1 block text-xs font-medium text-slate-500">Nome do cliente / prospect *</label><input value={clienteNome} onChange={(e) => setCliNome(e.target.value)} maxLength={120} className={inp} placeholder="Selecionado acima ou digite (prospect)" /></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-500">Município</label><input value={municipio} onChange={(e) => setMunicipio(e.target.value)} maxLength={120} className={inp} /></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-500">Propriedade / fazenda</label><input value={propriedade} onChange={(e) => setPropriedade(e.target.value)} maxLength={120} className={inp} /></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-500">Atividade</label><select value={atividadeId} onChange={(e) => setAtividadeId(e.target.value)} className={inp}><option value="">—</option>{atividades.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</select></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-500">Região</label><select value={regiaoId} onChange={(e) => setRegiaoId(e.target.value)} className={inp}><option value="">—</option>{regioes.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}</select></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-500">Data da visita</label><input type="date" value={dataVisita} onChange={(e) => setDataVisita(e.target.value)} className={inp} /></div>
          </div>
          <div className="mt-3"><label className="mb-1 block text-xs font-medium text-slate-500">Observação</label><input value={observacao} onChange={(e) => setObs(e.target.value)} maxLength={500} className={inp} /></div>
          <div className="mt-4 flex gap-3">
            <button type="submit" disabled={salvando} className="flex items-center gap-2 rounded-lg bg-capul-600 px-4 py-2 text-sm font-medium text-white hover:bg-capul-700 disabled:opacity-50"><Plus className="h-4 w-4" /> {salvando ? 'Salvando…' : 'Registrar visita'}</button>
            {clienteMatricula && <span className="self-center text-xs text-slate-400">Matrícula: <b className="font-mono">{clienteMatricula}</b></span>}
          </div>
        </form>
      )}

      <h2 className="mb-2 text-sm font-semibold text-slate-700">Visitas ({v.paradas.length})</h2>
      <div className="mb-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full">
          <thead><tr className="bg-slate-50"><th className={th}>#</th><th className={th}>Data</th><th className={th}>Cliente</th><th className={th}>Município</th><th className={th}>Propriedade</th><th className={th}>Atividade</th><th className={th}>Obs</th><th className={th}></th></tr></thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {v.paradas.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Nenhuma visita ainda.</td></tr>
            ) : v.paradas.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-500">{p.sequencia}</td>
                <td className="px-4 py-3">{fmtData(p.dataHora)}</td>
                <td className="px-4 py-3"><span className="font-medium text-slate-700">{p.clienteNome ?? '—'}</span>{p.clienteMatricula && <span className="ml-1 rounded bg-slate-100 px-1 text-[10px] text-slate-500">{p.clienteMatricula}</span>}</td>
                <td className="px-4 py-3 text-slate-500">{p.municipio ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500">{p.propriedade ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500">{p.atividade?.nome ?? '—'}</td>
                <td className="px-4 py-3 text-slate-400">{p.observacao ?? '—'}</td>
                <td className="px-4 py-3">{!concluida && <button onClick={() => void remover(p)} className="text-slate-400 hover:text-red-600" title="Remover"><Trash2 className="h-4 w-4" /></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">Despesas do mês ({v.despesas.length}) <span className="text-xs font-normal text-slate-400">— total {brl(totalDespesas)}</span></h2>
        {!concluida && <button onClick={() => setShowDesp(!showDesp)} className="inline-flex items-center gap-1 rounded-lg bg-capul-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-capul-700"><Plus className="h-3.5 w-3.5" /> Nova despesa</button>}
      </div>

      {showDesp && !concluida && (
        <form onSubmit={lancarDespesa} className="mb-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-500">Tipo *</label>
              <select value={dTipo} onChange={(e) => setDTipo(e.target.value)} className={inp}>
                <option value="">—</option>
                {tipos.map((t) => <option key={t.id} value={t.id}>{t.nome} ({t.categoria === 'INDIVIDUO' ? 'Indivíduo' : 'Veículo'})</option>)}
              </select>
            </div>
            <div><label className="mb-1 block text-xs font-medium text-slate-500">Valor (R$) *</label><input type="number" step="0.01" min="0" value={dValor} onChange={(e) => setDValor(e.target.value)} className={inp} /></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-500">Data</label><input type="date" value={dData} onChange={(e) => setDData(e.target.value)} className={inp} /></div>
            <div className="sm:col-span-2"><label className="mb-1 block text-xs font-medium text-slate-500">Fornecedor</label><input value={dFornecedor} onChange={(e) => setDForn(e.target.value)} maxLength={120} className={inp} /></div>
            <div className="sm:col-span-2"><label className="mb-1 block text-xs font-medium text-slate-500">Observação</label><input value={dObs} onChange={(e) => setDObs(e.target.value)} maxLength={500} className={inp} /></div>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="submit" disabled={salvandoDesp} className="rounded-lg bg-capul-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-capul-700 disabled:opacity-50">{salvandoDesp ? 'Salvando…' : 'Lançar despesa'}</button>
            <button type="button" onClick={() => setShowDesp(false)} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full">
          <thead><tr className="bg-slate-50"><th className={th}>Data</th><th className={th}>Tipo</th><th className={th}>Categoria</th><th className={th}>Valor</th><th className={th}>Situação</th><th className={th}></th></tr></thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {v.despesas.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Nenhuma despesa lançada nesta viagem.</td></tr>
            ) : v.despesas.map((d) => (
              <tr key={d.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">{fmtData(d.dataDespesa)}</td>
                <td className="px-4 py-3 font-medium text-slate-700">{d.tipoDespesa?.nome ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500">{d.tipoDespesa?.categoria === 'INDIVIDUO' ? 'Indivíduo' : 'Veículo'}</td>
                <td className="px-4 py-3">{brl(d.valor)}</td>
                <td className="px-4 py-3 text-slate-500">{d.situacao}</td>
                <td className="px-4 py-3">{!concluida && <button onClick={() => void removerDespesa(d.id)} className="text-slate-400 hover:text-red-600" title="Remover"><Trash2 className="h-4 w-4" /></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
