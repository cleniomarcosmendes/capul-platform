import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Truck, Wrench } from 'lucide-react';
import { coreApi, logisticaApi } from '../services/api';
import { maskPlaca } from '../utils/format';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { useToast } from '../components/toast-context';
import { useAuth } from '../contexts/AuthContext';

// Form de veículo (padrão FormPage do workspace): /veiculos/novo e
// /veiculos/:id/editar no MESMO componente.

interface CoreItem { id: string; nome?: string; codigo?: string; nomeFantasia?: string }
interface Manutencao {
  id: string; tipo: 'PREVENTIVA' | 'CORRETIVA'; km: number; dataManutencao: string;
  motivo?: string | null; custo?: string | number | null; reiniciouCiclo: boolean; kmProximaGerada?: number | null;
}
const labelCore = (i: CoreItem) => i.nomeFantasia || i.nome || i.codigo || i.id.slice(0, 8);

const TIPOS = ['CARRO', 'UTILITARIO', 'CAMINHAO', 'OUTRO'];
const PROPRIEDADES: [string, string][] = [['PROPRIO', 'Próprio'], ['ALUGADO', 'Alugado']];
const PORTES: [string, string][] = [['', '—'], ['PESADO', 'Pesado'], ['LEVE', 'Leve']];
const FINALIDADES: [string, string][] = [['', '—'], ['ENTREGA', 'Entrega'], ['PASSEIO', 'Passeio'], ['SERVICO', 'Serviço']];
const SITUACOES = ['DISPONIVEL', 'EM_USO', 'EM_MANUTENCAO', 'BAIXADO'];

export function VeiculoFormPage() {
  const { id } = useParams<{ id: string }>();
  const modoEdicao = !!id;
  const navigate = useNavigate();

  const [filiais, setFiliais] = useState<CoreItem[]>([]);
  const [departamentos, setDepartamentos] = useState<CoreItem[]>([]);
  const [usuarios, setUsuarios] = useState<CoreItem[]>([]);

  const [placa, setPlaca] = useState('');
  const [modelo, setModelo] = useState('');
  const [marca, setMarca] = useState('');
  const [ano, setAno] = useState('');
  const [tipo, setTipo] = useState('CARRO');
  const [propriedade, setPropriedade] = useState('PROPRIO');
  const [porte, setPorte] = useState('');
  const [finalidade, setFinalidade] = useState('');
  const [kmAtual, setKmAtual] = useState('0');
  const [intervaloManutencaoKm, setIntervalo] = useState('');
  const [kmUltimaManutencao, setKmUltima] = useState<number | null>(null);
  const [kmProximaManutencao, setKmProxima] = useState<number | null>(null);
  // Painel de manutenção (registrar + histórico) — só em edição.
  const [manutencoes, setManutencoes] = useState<Manutencao[]>([]);
  const [showManut, setShowManut] = useState(false);
  const [mTipo, setMTipo] = useState<'PREVENTIVA' | 'CORRETIVA'>('PREVENTIVA');
  const [mKm, setMKm] = useState('');
  const [mData, setMData] = useState('');
  const [mCusto, setMCusto] = useState('');
  const [mMotivo, setMMotivo] = useState('');
  const [mReiniciar, setMReiniciar] = useState(true);
  const [salvandoManut, setSalvandoManut] = useState(false);
  const [filialId, setFilialId] = useState('');
  const [departamentoLotacaoId, setDepartamentoId] = useState('');
  const [supervisorId, setSupervisorId] = useState('');
  // Supervisor de ÁREA (atendente técnico, por matrícula Protheus) — distinto do
  // "Supervisor responsável" (encarregado). O nome é resolvido no Protheus.
  const [supervisorAreaMatricula, setSupAreaMat] = useState('');
  const [supervisorAreaNome, setSupAreaNome] = useState('');
  const [buscandoArea, setBuscandoArea] = useState(false);
  const [situacao, setSituacao] = useState('DISPONIVEL');
  const [carregando, setCarregando] = useState(modoEdicao);
  const [salvando, setSalvando] = useState(false);
  const [dirty, setDirty] = useState(false);
  const { ConfirmDialog: DirtyDialog } = useUnsavedChanges(dirty);
  const { toast } = useToast();
  const { usuario, logisticaRole } = useAuth();
  // Gestor de frota/entrega e admin gerem a frota da empresa toda → escolhem a
  // filial. Operador fica travado na própria (o backend recusa escrita fora dela).
  // Só no cadastro: em edição o filialId não entra no PATCH (não se troca a filial do veículo).
  const podeEscolherFilial = !modoEdicao && ['ADMIN', 'GESTOR_ENTREGA', 'GESTOR_FROTA'].includes(logisticaRole ?? '');

  // Filial é SEMPRE a do usuário: a escrita é escopada à filial do token para
  // TODOS os perfis (assertMesmaFilial no backend). No cadastro ela nasce travada
  // na filial ativa (só o nome é exibido); em edição vem do próprio veículo.
  useEffect(() => {
    coreApi.get<CoreItem[]>('/filiais').then((r) => setFiliais(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (modoEdicao) return;
    const fa = usuario?.filialAtual?.id ?? usuario?.filiais?.[0]?.id ?? '';
    if (fa) setFilialId(fa);
  }, [modoEdicao, usuario]);

  // Departamento de lotação e supervisor são escopados à filial efetiva — o
  // seletor não pode oferecer opções de outra filial (gerava lotação cruzada e a
  // mensagem "Operação fora da sua filial"). Refaz a busca quando a filial muda.
  useEffect(() => {
    if (!filialId) { setDepartamentos([]); setUsuarios([]); return; }
    void (async () => {
      const [d, u] = await Promise.all([
        coreApi.get<CoreItem[]>('/departamentos', { params: { filialId } }).catch(() => ({ data: [] })),
        coreApi.get<CoreItem[]>('/usuarios', { params: { filialId } }).catch(() => ({ data: [] })),
      ]);
      setDepartamentos(d.data); setUsuarios(u.data);
    })();
  }, [filialId]);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const { data: v } = await logisticaApi.get<{
          placa: string; modelo?: string | null; marca?: string | null; ano?: number | null;
          tipo: string; propriedade?: string; porte?: string | null; finalidade?: string | null; kmAtual: number; filialId: string; departamentoLotacaoId: string;
          supervisorId: string; situacao: string;
          supervisorAreaMatricula?: string | null; supervisorAreaNome?: string | null;
          intervaloManutencaoKm?: number | null; kmUltimaManutencao?: number | null; kmProximaManutencao?: number | null;
        }>(`/veiculos/${id}`);
        setPlaca(v.placa); setModelo(v.modelo ?? ''); setMarca(v.marca ?? '');
        setAno(v.ano ? String(v.ano) : ''); setTipo(v.tipo); setPropriedade(v.propriedade ?? 'PROPRIO');
        setPorte(v.porte ?? ''); setFinalidade(v.finalidade ?? ''); setKmAtual(String(v.kmAtual ?? 0));
        setIntervalo(v.intervaloManutencaoKm != null ? String(v.intervaloManutencaoKm) : '');
        setKmUltima(v.kmUltimaManutencao ?? null); setKmProxima(v.kmProximaManutencao ?? null);
        setFilialId(v.filialId); setDepartamentoId(v.departamentoLotacaoId);
        setSupervisorId(v.supervisorId); setSituacao(v.situacao);
        setSupAreaMat(v.supervisorAreaMatricula ?? ''); setSupAreaNome(v.supervisorAreaNome ?? '');
      } catch {
        toast('error', 'Veículo não encontrado.');
      } finally { setCarregando(false); }
    })();
  }, [id, toast]);

  // Histórico de manutenções (só em edição).
  const carregarManutencoes = async () => {
    if (!id) return;
    try { const { data } = await logisticaApi.get<Manutencao[]>(`/frota/veiculos/${id}/manutencoes`); setManutencoes(data); }
    catch { /* silencioso — histórico é complementar */ }
  };
  useEffect(() => {
    void carregarManutencoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Registra manutenção: usa a resposta (veículo atualizado) p/ refletir km última/
  // próxima na hora, e recarrega o histórico.
  async function registrarManutencao() {
    if (!id) return;
    setSalvandoManut(true);
    try {
      const { data: v } = await logisticaApi.post<{ kmUltimaManutencao?: number | null; kmProximaManutencao?: number | null }>(
        `/frota/veiculos/${id}/manutencao`,
        {
          tipo: mTipo,
          km: mKm ? parseInt(mKm) : undefined,
          custo: mCusto ? Number(mCusto) : undefined,
          observacao: mMotivo.trim() || undefined,
          data: mData || undefined,
          reiniciarCiclo: mReiniciar,
        },
      );
      setKmUltima(v.kmUltimaManutencao ?? kmUltimaManutencao);
      setKmProxima(v.kmProximaManutencao ?? kmProximaManutencao);
      toast('success', 'Manutenção registrada.');
      setShowManut(false); setMKm(''); setMData(''); setMCusto(''); setMMotivo('');
      await carregarManutencoes();
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast('error', msg || 'Falha ao registrar manutenção.');
    } finally { setSalvandoManut(false); }
  }

  // Resolve o nome do supervisor de área pela matrícula (Protheus, mesmo endpoint
  // do condutor). Só GESTOR_FROTA etc. chegam aqui (têm acesso a /frota/condutor).
  async function buscarSupervisorArea() {
    const m = supervisorAreaMatricula.trim();
    if (!m) { setSupAreaNome(''); return; }
    setBuscandoArea(true);
    try {
      const { data } = await logisticaApi.post<{ matricula: string; nome: string }>('/frota/condutor', { matricula: m });
      setSupAreaNome(data.nome);
    } catch {
      setSupAreaNome('');
      toast('warning', 'Matrícula do supervisor de área não encontrada no Protheus.');
    } finally { setBuscandoArea(false); }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!filialId || !departamentoLotacaoId || !supervisorId) {
      toast('warning', 'Filial, departamento e supervisor são obrigatórios.');
      return;
    }
    setSalvando(true);
    const payload = {
      filialId,
      placa,
      modelo: modelo || undefined,
      marca: marca || undefined,
      ano: ano ? parseInt(ano) : undefined,
      tipo,
      propriedade,
      porte: porte || undefined,
      finalidade: finalidade || undefined,
      kmAtual: kmAtual ? parseInt(kmAtual) : 0,
      intervaloManutencaoKm: intervaloManutencaoKm ? parseInt(intervaloManutencaoKm) : undefined,
      departamentoLotacaoId,
      supervisorId,
      // Supervisor de área: em edição '' remove o vínculo; no cadastro vazio = não envia.
      supervisorAreaMatricula: supervisorAreaMatricula.trim() || (modoEdicao ? '' : undefined),
      supervisorAreaNome: supervisorAreaNome.trim() || undefined,
      ...(modoEdicao ? { situacao } : {}),
    };
    try {
      if (modoEdicao) {
        // filialId não entra no PATCH (não se muda a filial do veículo; o
        // UpdateVeiculoDto não tem o campo e o ValidationPipe rejeitaria).
        const { filialId: _filial, ...edit } = payload;
        await logisticaApi.patch(`/veiculos/${id}`, edit);
      } else {
        await logisticaApi.post('/veiculos', payload);
      }
      setDirty(false);
      toast('success', modoEdicao ? 'Veículo atualizado.' : 'Veículo cadastrado.');
      navigate('/veiculos');
    } catch (err) {
      const m = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      toast('error', Array.isArray(m) ? m.join(', ') : m || 'Falha ao salvar veículo.');
      setSalvando(false);
    }
  }

  const inp = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-capul-500 focus:outline-none';
  const lbl = 'block text-xs font-medium text-slate-500';

  if (carregando) return <div className="p-6 text-sm text-slate-500"><Loader2 className="inline h-4 w-4 animate-spin" /> Carregando…</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-4" onChange={() => setDirty(true)}>
      {DirtyDialog}
      <Link to="/veiculos" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Voltar para Frota
      </Link>

      <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-white shadow-sm p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
          <Truck className="h-5 w-5 text-capul-600" /> {modoEdicao ? `Editar veículo ${placa}` : 'Novo veículo'}
        </h2>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div><label className={lbl}>Placa *</label>
            <input value={placa} onChange={(e) => setPlaca(maskPlaca(e.target.value))} required placeholder="ABC1D23" maxLength={7} className={`${inp} font-mono uppercase`} /></div>
          <div><label className={lbl}>Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inp}>{TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
          <div><label className={lbl}>Propriedade</label>
            <select value={propriedade} onChange={(e) => setPropriedade(e.target.value)} className={inp}>{PROPRIEDADES.map(([v, rotulo]) => <option key={v} value={v}>{rotulo}</option>)}</select></div>
          <div><label className={lbl}>Porte</label>
            <select value={porte} onChange={(e) => setPorte(e.target.value)} className={inp}>{PORTES.map(([v, rotulo]) => <option key={v} value={v}>{rotulo}</option>)}</select></div>
          <div><label className={lbl}>Finalidade</label>
            <select value={finalidade} onChange={(e) => setFinalidade(e.target.value)} className={inp}>{FINALIDADES.map(([v, rotulo]) => <option key={v} value={v}>{rotulo}</option>)}</select></div>
          <div><label className={lbl}>Marca</label><input value={marca} onChange={(e) => setMarca(e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Modelo</label><input value={modelo} onChange={(e) => setModelo(e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Ano</label><input type="number" value={ano} onChange={(e) => setAno(e.target.value)} className={inp} /></div>
          <div><label className={lbl}>KM atual</label><input type="number" value={kmAtual} onChange={(e) => setKmAtual(e.target.value)} className={inp} /></div>
          {modoEdicao && (
            <div className="col-span-2"><label className={lbl}>Situação</label>
              <select value={situacao} onChange={(e) => setSituacao(e.target.value)} className={inp}>{SITUACOES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div><label className={lbl}>Filial{podeEscolherFilial ? ' *' : ''}</label>
            {podeEscolherFilial ? (
              <select value={filialId} onChange={(e) => setFilialId(e.target.value)} className={inp}>
                <option value="">—</option>
                {filiais.map((f) => <option key={f.id} value={f.id}>{labelCore(f)}</option>)}
              </select>
            ) : (
              <input
                value={(() => { const f = filiais.find((x) => x.id === filialId); return f ? labelCore(f) : (usuario?.filialAtual?.nome ?? '—'); })()}
                disabled className={`${inp} bg-slate-100 text-slate-500`} title="O veículo é cadastrado na sua filial ativa" />
            )}</div>
          <div><label className={lbl}>Departamento de lotação *</label>
            <select value={departamentoLotacaoId} onChange={(e) => setDepartamentoId(e.target.value)} className={inp}><option value="">—</option>{departamentos.map((d) => <option key={d.id} value={d.id}>{labelCore(d)}</option>)}</select></div>
          <div><label className={lbl}>Supervisor responsável * <span className="font-normal normal-case text-slate-400">(encarregado)</span></label>
            <select value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)} className={inp}><option value="">—</option>{usuarios.map((u) => <option key={u.id} value={u.id}>{labelCore(u)}</option>)}</select></div>
        </div>

        <div>
          <label className={lbl}>Supervisor de Área — atendente técnico (opcional)</label>
          <div className="mt-1 flex items-start gap-2">
            <input
              value={supervisorAreaMatricula}
              onChange={(e) => { setSupAreaMat(e.target.value.toUpperCase()); setSupAreaNome(''); }}
              onBlur={() => void buscarSupervisorArea()}
              placeholder="Matrícula Protheus (ex.: E05222)"
              maxLength={20}
              className="w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono uppercase focus:border-capul-500 focus:outline-none"
            />
            <button type="button" onClick={() => void buscarSupervisorArea()} disabled={buscandoArea || !supervisorAreaMatricula.trim()}
              className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              {buscandoArea ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar'}
            </button>
            {supervisorAreaNome && <span className="self-center text-sm font-medium text-emerald-700">👤 {supervisorAreaNome}</span>}
          </div>
          <p className="mt-1 text-xs text-slate-400">Colaborador que fica com <b>este veículo</b> para as visitas (funcionário Protheus, por matrícula). Diferente do "Supervisor responsável" (encarregado que gerencia). A troca fica registrada no histórico.</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Wrench className="h-3.5 w-3.5" /> Manutenção preventiva (por KM)
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div><label className={lbl}>Intervalo de revisão (km)</label>
              <input type="number" min={0} value={intervaloManutencaoKm} onChange={(e) => setIntervalo(e.target.value)} placeholder="ex.: 10000" className={inp} /></div>
            <div><label className={lbl}>Última manutenção (km)</label>
              <input value={kmUltimaManutencao != null ? kmUltimaManutencao.toLocaleString('pt-BR') : '—'} disabled className={`${inp} bg-slate-100 text-slate-500`} /></div>
            <div><label className={lbl}>Próxima revisão (km)</label>
              <input value={kmProximaManutencao != null ? kmProximaManutencao.toLocaleString('pt-BR') : '—'} disabled className={`${inp} bg-slate-100 text-slate-500`} /></div>
          </div>
          <p className="mt-2 text-xs text-slate-400">A próxima revisão nasce do intervalo (km atual + intervalo) e é recalculada a cada manutenção que reinicia o ciclo.</p>

          {modoEdicao ? (
            <div className="mt-3 border-t border-slate-200 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Manutenções ({manutencoes.length})</span>
                <button type="button" onClick={() => { setShowManut(!showManut); setMKm(kmAtual || ''); }}
                  className="inline-flex items-center gap-1 rounded-lg border border-orange-300 bg-white px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-50">
                  <Wrench className="h-3.5 w-3.5" /> Registrar manutenção
                </button>
              </div>

              {showManut && (
                <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50/60 p-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className={lbl}>Tipo</label>
                      <select value={mTipo} onChange={(e) => { const t = e.target.value as 'PREVENTIVA' | 'CORRETIVA'; setMTipo(t); setMReiniciar(t === 'PREVENTIVA'); }} className={inp}>
                        <option value="PREVENTIVA">Preventiva (do ciclo)</option>
                        <option value="CORRETIVA">Corretiva / excepcional</option>
                      </select>
                    </div>
                    <div><label className={lbl}>KM na manutenção</label><input type="number" min={0} value={mKm} onChange={(e) => setMKm(e.target.value)} placeholder={kmAtual || '0'} className={inp} /></div>
                    <div><label className={lbl}>Data</label><input type="date" value={mData} onChange={(e) => setMData(e.target.value)} className={inp} /></div>
                    <div><label className={lbl}>Custo (R$)</label><input type="number" step="0.01" min={0} value={mCusto} onChange={(e) => setMCusto(e.target.value)} placeholder="opcional" className={inp} /></div>
                    <div className="sm:col-span-2"><label className={lbl}>Motivo / observação</label><input value={mMotivo} onChange={(e) => setMMotivo(e.target.value)} maxLength={255} className={inp} placeholder="ex.: revisão dos 10 mil / troca de correia" /></div>
                  </div>
                  <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" checked={mReiniciar} onChange={(e) => setMReiniciar(e.target.checked)} className="h-4 w-4 accent-capul-600" />
                    Reiniciar o ciclo preventivo (próxima = km + intervalo)
                    <span className="text-xs text-slate-400">— numa corretiva, marque só se já incluiu a revisão</span>
                  </label>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => void registrarManutencao()} disabled={salvandoManut}
                      className="rounded-lg bg-orange-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50">{salvandoManut ? 'Salvando…' : 'Salvar manutenção'}</button>
                    <button type="button" onClick={() => setShowManut(false)} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
                  </div>
                </div>
              )}

              {manutencoes.length > 0 && (
                <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-slate-50 text-left text-slate-500"><th className="px-3 py-2">Data</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">KM</th><th className="px-3 py-2">Custo</th><th className="px-3 py-2">Ciclo</th><th className="px-3 py-2">Motivo</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {manutencoes.map((m) => (
                        <tr key={m.id}>
                          <td className="px-3 py-2">{new Date(m.dataManutencao).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td>
                          <td className="px-3 py-2">{m.tipo === 'PREVENTIVA' ? 'Preventiva' : 'Corretiva'}</td>
                          <td className="px-3 py-2 tabular-nums">{m.km.toLocaleString('pt-BR')}</td>
                          <td className="px-3 py-2">{m.custo != null ? Number(m.custo).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}</td>
                          <td className="px-3 py-2">{m.reiniciouCiclo ? <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-emerald-700">reiniciou</span> : <span className="text-slate-400">—</span>}</td>
                          <td className="px-3 py-2 text-slate-500">{m.motivo ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-1 text-xs text-slate-400">Salve o veículo para registrar manutenções.</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2">
          <Link to="/veiculos" className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancelar</Link>
          <button type="submit" disabled={salvando}
            className="flex items-center gap-2 rounded-lg bg-capul-600 px-5 py-2 text-sm font-medium text-white hover:bg-capul-700 disabled:opacity-50">
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
            {modoEdicao ? 'Salvar alterações' : 'Cadastrar veículo'}
          </button>
        </div>
      </form>
    </div>
  );
}
