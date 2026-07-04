import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, MapPin, Pencil, Plus, Printer, Search, Trash2, User } from 'lucide-react';
import { logisticaApi } from '../services/api';
import { useToast } from '../components/toast-context';
import { useAuth } from '../contexts/AuthContext';
import { errMsg } from './frota-utils';

interface Atividade { id: string; nome: string; ativo: boolean }
interface Visita {
  id: string; sequencia: number; status?: string | null; clienteMatricula?: string | null; clienteNome?: string | null;
  municipio?: string | null; propriedade?: string | null; observacao?: string | null; dataHora?: string | null;
  atividadeId?: string | null;
  atividade?: { nome: string } | null;
}
const STATUS_VISITA: Record<string, { label: string; cls: string }> = {
  PLANEJADA: { label: 'Planejada', cls: 'bg-amber-100 text-amber-700' },
  REALIZADA: { label: 'Realizada', cls: 'bg-emerald-100 text-emerald-700' },
  PULADA: { label: 'Pulada', cls: 'bg-slate-100 text-slate-500' },
};
const statusVisita = (s?: string | null) => STATUS_VISITA[s ?? 'REALIZADA'] ?? { label: s ?? '—', cls: 'bg-slate-100 text-slate-600' };
interface DespesaV { id: string; valor: number | string; situacao: string; motivoContestacao?: string | null; tipoDespesaId?: string; fornecedor?: string | null; observacao?: string | null; tipoDespesa?: { nome: string; categoria: string } | null; dataDespesa?: string | null }
interface ViagemDetalhe {
  id: string; numero: number; situacao: string; statusPlanejamento?: string | null; comentarioCoordenador?: string | null;
  mesReferencia?: number | null;
  condutorNome?: string | null; condutorMatricula?: string | null;
  supervisorRegistro?: { id: string; nome: string; coordenadorId?: string | null } | null;
  paradas: Visita[]; despesas: DespesaV[];
}
const STATUS_DESPESA: Record<string, { label: string; cls: string }> = {
  PENDENTE: { label: 'Pendente', cls: 'bg-amber-100 text-amber-700' },
  APROVADA: { label: 'Aprovada', cls: 'bg-emerald-100 text-emerald-700' },
  CONTESTADA: { label: 'Rejeitada', cls: 'bg-rose-100 text-rose-700' },
};
const statusDespesa = (s?: string | null) => STATUS_DESPESA[s ?? ''] ?? { label: s ?? '—', cls: 'bg-slate-100 text-slate-600' };

const fmtMes = (m?: number | null) => (m ? `${String(m % 100).padStart(2, '0')}/${Math.floor(m / 100)}` : '—');
// Aviso (não bloqueante) quando a data digitada (YYYY-MM-DD) sai do mês do planejamento (AAAAMM).
const foraDoMes = (d?: string, mes?: number | null) => {
  if (!d || !mes) return false;
  const [y, m] = d.split('-');
  return Number(y) * 100 + Number(m) !== mes;
};
const brl = (v: unknown) => (v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const fmtData = (s?: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—');
const STATUS_PLAN: Record<string, { label: string; cls: string }> = {
  RASCUNHO: { label: 'Rascunho', cls: 'bg-slate-100 text-slate-600' },
  ENVIADO: { label: 'Enviado (aguarda coordenador)', cls: 'bg-amber-100 text-amber-700' },
  APROVADO: { label: 'Aprovado', cls: 'bg-emerald-100 text-emerald-700' },
  AJUSTADO: { label: 'Ajustado (revisar)', cls: 'bg-sky-100 text-sky-700' },
  REJEITADO: { label: 'Rejeitado', cls: 'bg-rose-100 text-rose-700' },
  EM_EXECUCAO: { label: 'Em execução', cls: 'bg-indigo-100 text-indigo-700' },
  CONCLUIDO: { label: 'Concluído', cls: 'bg-slate-100 text-slate-600' },
};
const statusPlan = (s?: string | null) => STATUS_PLAN[s ?? ''] ?? { label: s ?? '—', cls: 'bg-slate-100 text-slate-600' };
const th = 'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500';
const inp = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500';

// Busca de cliente (Protheus SA1 + local) devolvendo dados ESTRUTURADOS p/ a visita.
interface EndP { logradouro?: string; bairro?: string | null; cidade?: string | null; uf?: string | null }
interface ClienteP { matricula: string; nome: string; enderecos: EndP[] }
interface ClienteL { id: string; nome: string; enderecos: EndP[] }
interface BuscaResp { clientesLocais: ClienteL[]; protheus?: { clientes: ClienteP[] } }
const fmtEnd = (e?: EndP | null) => (!e ? '' : [e.logradouro, e.bairro, e.cidade && e.uf ? `${e.cidade}/${e.uf}` : e.cidade].filter(Boolean).join(', '));

function BuscaCliente({ onPick }: { onPick: (c: { matricula?: string; nome: string; municipio?: string; propriedade?: string; local?: string }) => void }) {
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
  const escolher = (c: { matricula?: string; nome: string; municipio?: string; propriedade?: string; local?: string }) => { onPick(c); setTermo(''); setResp(null); setAberto(false); };
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
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => escolher({ matricula: r.matricula, nome: r.nome, municipio: r.end?.cidade ?? undefined, propriedade: r.end?.logradouro ?? undefined, local: fmtEnd(r.end) || undefined })}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-capul-50">
                    <User className="mt-0.5 h-4 w-4 shrink-0 text-capul-600" />
                    <span className="min-w-0"><span className="font-medium text-slate-700">{r.nome}</span><span className="ml-1 rounded bg-slate-100 px-1 text-[10px] text-slate-500">{r.matricula}</span>{fmtEnd(r.end) && <span className="block text-xs text-slate-500">{fmtEnd(r.end)}</span>}</span>
                  </button>
                </li>
              ))}
              {linhasL.map((r) => (
                <li key={`l${r.key}`}>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => escolher({ nome: r.nome, municipio: r.end?.cidade ?? undefined, propriedade: r.end?.logradouro ?? undefined, local: fmtEnd(r.end) || undefined })}
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
  const { usuario, logisticaRole } = useAuth();
  const [v, setV] = useState<ViagemDetalhe | null>(null);
  const [rejDesp, setRejDesp] = useState<string | null>(null); // id da despesa em rejeição
  const [motivoRej, setMotivoRej] = useState('');
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [loading, setLoading] = useState(true);
  // form da visita
  const [clienteMatricula, setCliMat] = useState('');
  const [clienteNome, setCliNome] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [atividadeId, setAtividadeId] = useState('');
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
  // administração (Fase 5)
  const [editVisitaId, setEditVisitaId] = useState<string | null>(null);
  const [editDespId, setEditDespId] = useState<string | null>(null);

  const carregar = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [d, a, t] = await Promise.all([
        logisticaApi.get<ViagemDetalhe>(`/supervisor/viagens/${id}`),
        logisticaApi.get<Atividade[]>('/supervisor/atividades', { params: { ativos: true } }),
        logisticaApi.get<{ id: string; nome: string; categoria: string; ativo?: boolean }[]>('/despesas/tipos'),
      ]);
      setV(d.data); setAtividades(a.data); setTipos(t.data.filter((x) => x.ativo !== false));
    } catch (e) { toast('error', errMsg(e, 'Falha ao carregar a viagem.')); } finally { setLoading(false); }
  };
  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const concluida = v?.situacao === 'CONCLUIDA';
  // Quem aprova/rejeita despesa: gestor/admin OU o coordenador deste supervisor.
  const ehGestor = logisticaRole === 'GESTOR_FROTA' || logisticaRole === 'GESTOR_ENTREGA' || logisticaRole === 'ADMIN';
  const podeAprovarDespesa = ehGestor || (!!v?.supervisorRegistro?.coordenadorId && v.supervisorRegistro.coordenadorId === usuario?.id);

  const limparForm = () => { setCliMat(''); setCliNome(''); setMunicipio(''); setAtividadeId(''); setPropriedade(''); setObs(''); setDataVisita(''); setEditVisitaId(null); };
  const abrirEdicaoVisita = (p: Visita) => {
    setEditVisitaId(p.id);
    setCliMat(p.clienteMatricula ?? ''); setCliNome(p.clienteNome ?? ''); setMunicipio(p.municipio ?? '');
    setAtividadeId(p.atividadeId ?? ''); setPropriedade(p.propriedade ?? ''); setObs(p.observacao ?? '');
    setDataVisita(p.dataHora ? new Date(p.dataHora).toISOString().slice(0, 10) : '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const adicionar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteNome.trim()) { toast('warning', 'Informe o cliente (busque ou digite o nome para prospect).'); return; }
    setSalvando(true);
    const body = {
      atividadeId: atividadeId || undefined,
      clienteMatricula: clienteMatricula.trim() || undefined,
      clienteNome: clienteNome.trim(),
      municipio: municipio.trim() || undefined,
      propriedade: propriedade.trim() || undefined,
      observacao: observacao.trim() || undefined,
      dataVisita: dataVisita || undefined,
    };
    try {
      if (editVisitaId) await logisticaApi.patch(`/supervisor/viagens/${id}/visitas/${editVisitaId}`, body);
      else await logisticaApi.post(`/supervisor/viagens/${id}/visitas`, body);
      toast('success', editVisitaId ? 'Visita atualizada.' : 'Visita registrada.');
      limparForm(); await carregar();
    } catch (e) { toast('error', errMsg(e, 'Falha ao salvar visita.')); } finally { setSalvando(false); }
  };

  const remover = async (visita: Visita) => {
    try { await logisticaApi.delete(`/supervisor/viagens/${id}/visitas/${visita.id}`); toast('success', 'Visita removida.'); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao remover.')); }
  };
  const apontar = async (visita: Visita, status: 'REALIZADA' | 'PULADA') => {
    try { await logisticaApi.patch(`/supervisor/viagens/${id}/visitas/${visita.id}/apontar`, { status }); toast('success', status === 'REALIZADA' ? 'Visita realizada.' : 'Visita pulada.'); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao apontar a visita.')); }
  };
  const concluir = async () => {
    try { await logisticaApi.patch(`/supervisor/viagens/${id}/concluir`); toast('success', 'Viagem concluída.'); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao concluir.')); }
  };
  const reabrir = async () => {
    try { await logisticaApi.patch(`/supervisor/viagens/${id}/reabrir`); toast('success', 'Viagem reaberta para correção.'); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao reabrir.')); }
  };
  const enviar = async () => {
    try { await logisticaApi.patch(`/supervisor/viagens/${id}/enviar`); toast('success', 'Enviado ao coordenador.'); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao enviar.')); }
  };
  const iniciar = async () => {
    try { await logisticaApi.patch(`/supervisor/viagens/${id}/iniciar`); toast('success', 'Execução iniciada.'); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao iniciar.')); }
  };

  const limparDesp = () => { setShowDesp(false); setEditDespId(null); setDTipo(''); setDValor(''); setDData(''); setDForn(''); setDObs(''); };
  const abrirEdicaoDesp = (d: DespesaV) => {
    setEditDespId(d.id); setShowDesp(true);
    setDTipo(d.tipoDespesaId ?? ''); setDValor(String(d.valor)); setDForn(d.fornecedor ?? ''); setDObs(d.observacao ?? '');
    setDData(d.dataDespesa ? new Date(d.dataDespesa).toISOString().slice(0, 10) : '');
  };
  const lancarDespesa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dTipo || !dValor) { toast('warning', 'Escolha o tipo e informe o valor.'); return; }
    setSalvandoDesp(true);
    const body = { tipoDespesaId: dTipo, valor: Number(dValor), data: dData || undefined, fornecedor: dFornecedor.trim() || undefined, observacao: dObs.trim() || undefined };
    try {
      if (editDespId) await logisticaApi.patch(`/supervisor/viagens/${id}/despesas/${editDespId}`, body);
      else await logisticaApi.post(`/supervisor/viagens/${id}/despesas`, body);
      toast('success', editDespId ? 'Despesa atualizada.' : 'Despesa lançada.');
      limparDesp(); await carregar();
    } catch (e) { toast('error', errMsg(e, 'Falha ao salvar despesa.')); } finally { setSalvandoDesp(false); }
  };
  const removerDespesa = async (dId: string) => {
    try { await logisticaApi.delete(`/supervisor/viagens/${id}/despesas/${dId}`); toast('success', 'Despesa removida.'); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao remover.')); }
  };
  const decidirDespesa = async (dId: string, decisao: 'APROVADA' | 'CONTESTADA', motivo?: string) => {
    try {
      await logisticaApi.patch(`/supervisor/viagens/${id}/despesas/${dId}/decidir`, { decisao, motivo });
      toast('success', decisao === 'APROVADA' ? 'Despesa aprovada.' : 'Despesa rejeitada.');
      setRejDesp(null); setMotivoRej(''); await carregar();
    } catch (e) { toast('error', errMsg(e, 'Falha ao decidir a despesa.')); }
  };

  if (loading) return <div className="p-6 text-slate-500">Carregando…</div>;
  if (!v) return <div className="p-6 text-slate-500">Viagem não encontrada.</div>;

  const totalDespesas = v.despesas.reduce((s, d) => s + Number(d.valor), 0);

  return (
    <div className="p-6">
      <button onClick={() => navigate('/supervisores')} className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"><ArrowLeft className="h-4 w-4" /> Voltar</button>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Planejamento #{v.numero} · {fmtMes(v.mesReferencia)}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Supervisor: {v.condutorNome ?? '—'}
            <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${statusPlan(v.statusPlanejamento).cls}`}>{statusPlan(v.statusPlanejamento).label}</span>
          </p>
          {v.comentarioCoordenador && (v.statusPlanejamento === 'AJUSTADO' || v.statusPlanejamento === 'REJEITADO') && (
            <p className="mt-1 rounded-lg bg-sky-50 px-3 py-1.5 text-xs text-sky-800"><b>Coordenador:</b> {v.comentarioCoordenador}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(`/supervisores/viagens/${id}/rdv`)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"><Printer className="h-4 w-4" /> RDV</button>
          <button onClick={() => navigate(`/supervisores/viagens/${id}/visitas`)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"><Printer className="h-4 w-4" /> Visitas</button>
          {(v.statusPlanejamento === 'RASCUNHO' || v.statusPlanejamento === 'AJUSTADO' || v.statusPlanejamento === 'REJEITADO') &&
            <button onClick={() => void enviar()} className="rounded-lg bg-capul-600 px-4 py-2 text-sm font-medium text-white hover:bg-capul-700">Enviar ao coordenador</button>}
          {v.statusPlanejamento === 'APROVADO' &&
            <button onClick={() => void iniciar()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Iniciar execução</button>}
          {v.statusPlanejamento === 'EM_EXECUCAO' &&
            <button onClick={() => void concluir()} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Concluir</button>}
          {v.statusPlanejamento === 'CONCLUIDO' &&
            <button onClick={() => void reabrir()} className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100">Reabrir para corrigir</button>}
        </div>
      </div>

      {!concluida && (
        <form onSubmit={adicionar} className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">{editVisitaId ? 'Editar visita' : 'Nova visita'}</h2>
          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-slate-500">Cliente</label>
            <BuscaCliente onPick={(c) => { setCliMat(c.matricula ?? ''); setCliNome(c.nome); if (c.municipio) setMunicipio(c.municipio); if (c.propriedade) setPropriedade(c.propriedade); }} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div><label className="mb-1 block text-xs font-medium text-slate-500">Nome do cliente / prospect *</label><input value={clienteNome} onChange={(e) => setCliNome(e.target.value)} maxLength={120} className={inp} placeholder="Selecionado acima ou digite (prospect)" /></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-500">Município</label><input value={municipio} onChange={(e) => setMunicipio(e.target.value)} maxLength={120} className={inp} /></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-500">Propriedade / fazenda</label><input value={propriedade} onChange={(e) => setPropriedade(e.target.value)} maxLength={120} className={inp} /></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-500">Atividade</label><select value={atividadeId} onChange={(e) => setAtividadeId(e.target.value)} className={inp}><option value="">—</option>{atividades.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</select></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-500">Data da visita</label><input type="date" value={dataVisita} onChange={(e) => setDataVisita(e.target.value)} className={inp} />{foraDoMes(dataVisita, v.mesReferencia) && <p className="mt-1 text-xs text-amber-600">Fora do mês do planejamento ({fmtMes(v.mesReferencia)}).</p>}</div>
          </div>
          <div className="mt-3"><label className="mb-1 block text-xs font-medium text-slate-500">Observação</label><input value={observacao} onChange={(e) => setObs(e.target.value)} maxLength={500} className={inp} /></div>
          <div className="mt-4 flex gap-3">
            <button type="submit" disabled={salvando} className="flex items-center gap-2 rounded-lg bg-capul-600 px-4 py-2 text-sm font-medium text-white hover:bg-capul-700 disabled:opacity-50"><Plus className="h-4 w-4" /> {salvando ? 'Salvando…' : editVisitaId ? 'Salvar visita' : 'Registrar visita'}</button>
            {editVisitaId && <button type="button" onClick={limparForm} className="self-center text-sm text-slate-500 hover:text-slate-700">Cancelar edição</button>}
            {clienteMatricula && <span className="self-center text-xs text-slate-400">Matrícula: <b className="font-mono">{clienteMatricula}</b></span>}
          </div>
        </form>
      )}

      <h2 className="mb-2 text-sm font-semibold text-slate-700">Visitas ({v.paradas.length})</h2>
      <div className="mb-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full">
          <thead><tr className="bg-slate-50"><th className={th}>#</th><th className={th}>Data</th><th className={th}>Cliente</th><th className={th}>Município</th><th className={th}>Propriedade</th><th className={th}>Atividade</th><th className={th}>Status</th><th className={th}>Obs</th><th className={th}></th></tr></thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {v.paradas.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">Nenhuma visita ainda.</td></tr>
            ) : v.paradas.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-500">{p.sequencia}</td>
                <td className="px-4 py-3">{fmtData(p.dataHora)}</td>
                <td className="px-4 py-3"><span className="font-medium text-slate-700">{p.clienteNome ?? '—'}</span>{p.clienteMatricula && <span className="ml-1 rounded bg-slate-100 px-1 text-[10px] text-slate-500">{p.clienteMatricula}</span>}</td>
                <td className="px-4 py-3 text-slate-500">{p.municipio ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500">{p.propriedade ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500">{p.atividade?.nome ?? '—'}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-medium ${statusVisita(p.status).cls}`}>{statusVisita(p.status).label}</span></td>
                <td className="px-4 py-3 text-slate-400">{p.observacao ?? '—'}</td>
                <td className="px-4 py-3">{!concluida && (
                  <div className="flex items-center gap-2">
                    {v.statusPlanejamento === 'EM_EXECUCAO' && p.status === 'PLANEJADA' && (
                      <>
                        <button onClick={() => void apontar(p, 'REALIZADA')} className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100" title="Marcar como realizada">Realizar</button>
                        <button onClick={() => void apontar(p, 'PULADA')} className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-50" title="Não realizada">Pular</button>
                      </>
                    )}
                    <button onClick={() => abrirEdicaoVisita(p)} className="text-slate-400 hover:text-capul-600" title="Editar"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => void remover(p)} className="text-slate-400 hover:text-red-600" title="Remover"><Trash2 className="h-4 w-4" /></button>
                  </div>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">Despesas do mês ({v.despesas.length}) <span className="text-xs font-normal text-slate-400">— total {brl(totalDespesas)}</span></h2>
        {!concluida && <button onClick={() => { if (showDesp) { limparDesp(); } else { limparDesp(); setShowDesp(true); } }} className="inline-flex items-center gap-1 rounded-lg bg-capul-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-capul-700"><Plus className="h-3.5 w-3.5" /> Nova despesa</button>}
      </div>

      {showDesp && !concluida && (
        <form onSubmit={lancarDespesa} className="mb-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{editDespId ? 'Editar despesa' : 'Nova despesa'}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-500">Tipo *</label>
              <select value={dTipo} onChange={(e) => setDTipo(e.target.value)} className={inp}>
                <option value="">—</option>
                {tipos.map((t) => <option key={t.id} value={t.id}>{t.nome} ({t.categoria === 'INDIVIDUO' ? 'Indivíduo' : 'Veículo'})</option>)}
              </select>
            </div>
            <div><label className="mb-1 block text-xs font-medium text-slate-500">Valor (R$) *</label><input type="number" step="0.01" min="0" value={dValor} onChange={(e) => setDValor(e.target.value)} className={inp} /></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-500">Data</label><input type="date" value={dData} onChange={(e) => setDData(e.target.value)} className={inp} />{foraDoMes(dData, v.mesReferencia) && <p className="mt-1 text-xs text-amber-600">Fora do mês do planejamento ({fmtMes(v.mesReferencia)}).</p>}</div>
            <div className="sm:col-span-2"><label className="mb-1 block text-xs font-medium text-slate-500">Fornecedor</label><input value={dFornecedor} onChange={(e) => setDForn(e.target.value)} maxLength={120} className={inp} /></div>
            <div className="sm:col-span-2"><label className="mb-1 block text-xs font-medium text-slate-500">Observação</label><input value={dObs} onChange={(e) => setDObs(e.target.value)} maxLength={500} className={inp} /></div>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="submit" disabled={salvandoDesp} className="rounded-lg bg-capul-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-capul-700 disabled:opacity-50">{salvandoDesp ? 'Salvando…' : editDespId ? 'Salvar despesa' : 'Lançar despesa'}</button>
            <button type="button" onClick={limparDesp} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
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
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusDespesa(d.situacao).cls}`}>{statusDespesa(d.situacao).label}</span>
                  {d.situacao === 'CONTESTADA' && d.motivoContestacao && <span className="ml-1 text-xs text-rose-600" title={d.motivoContestacao}>ⓘ</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {podeAprovarDespesa && d.situacao === 'PENDENTE' && (
                      <>
                        <button onClick={() => void decidirDespesa(d.id, 'APROVADA')} className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100">Aprovar</button>
                        <button onClick={() => { setRejDesp(d.id); setMotivoRej(''); }} className="rounded border border-rose-300 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 hover:bg-rose-100">Rejeitar</button>
                      </>
                    )}
                    {!concluida && (
                      <>
                        <button onClick={() => abrirEdicaoDesp(d)} className="text-slate-400 hover:text-capul-600" title="Editar"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => void removerDespesa(d.id)} className="text-slate-400 hover:text-red-600" title="Remover"><Trash2 className="h-4 w-4" /></button>
                      </>
                    )}
                  </div>
                  {rejDesp === d.id && (
                    <div className="mt-2 flex items-center gap-2">
                      <input value={motivoRej} onChange={(e) => setMotivoRej(e.target.value)} maxLength={500} placeholder="Motivo da rejeição *" className="w-56 rounded-lg border border-slate-300 px-2 py-1 text-xs" />
                      <button onClick={() => { if (!motivoRej.trim()) { toast('warning', 'Informe o motivo.'); return; } void decidirDespesa(d.id, 'CONTESTADA', motivoRej.trim()); }} className="rounded bg-rose-600 px-2 py-1 text-xs font-medium text-white hover:bg-rose-700">Confirmar</button>
                      <button onClick={() => { setRejDesp(null); setMotivoRej(''); }} className="text-xs text-slate-500 hover:text-slate-700">Cancelar</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
