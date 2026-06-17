import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Banknote, Fuel, Loader2, LogIn, LogOut, Paperclip, Plus, Search, Settings2, Trash2, X } from 'lucide-react';
import { coreApi, logisticaApi } from '../services/api';
import { useToast } from '../components/Toast';
import PasswordInput from '../components/PasswordInput';
import { useAuth } from '../contexts/AuthContext';

// Controle de FROTA (terminal da portaria). O CONDUTOR se identifica por
// matrícula+senha (Protheus, só funcionário ativo) — diferente da ENTREGA, em
// que quem monta a viagem indica o motorista. Padrão workspace: grid + formulários
// inline (sem modal). Gestor de frota / supervisor ajustam quando o condutor erra.

export interface ViagemFrota {
  id: string; numero: number; situacao: string;
  placa: string; modelo?: string | null;
  condutorNome?: string | null; condutorMatricula?: string | null;
  kmInicial?: number | null; kmFinal?: number | null; kmRodado?: number | null;
  finalidade?: string | null; localSaida?: string | null;
  dataHoraSaida?: string | null; dataHoraChegada?: string | null;
  paradas?: number;
}
export interface ParadaFrota { id: string; sequencia: number; local: string; km?: number | null; dataHora?: string | null; observacao?: string | null }
interface VeiculoDisp { id: string; placa: string; modelo?: string | null; situacao: string; kmAtual: number }
export interface TipoDespesa { id: string; nome: string }
export interface FornecedorDespesa { id: string; nome: string; ativo: boolean }

export const SIT_META: Record<string, { label: string; cls: string }> = {
  EM_CURSO: { label: 'Em curso', cls: 'bg-sky-100 text-sky-700' },
  CONCLUIDA: { label: 'Concluída', cls: 'bg-emerald-100 text-emerald-700' },
  CANCELADA: { label: 'Cancelada', cls: 'bg-rose-100 text-rose-700' },
  RASCUNHO: { label: 'Rascunho', cls: 'bg-slate-100 text-slate-600' },
};

export const fmtDateTime = (s?: string | null) =>
  s ? new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
export const errMsg = (e: unknown, fb: string) => {
  const m = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return Array.isArray(m) ? m.join(', ') : (typeof m === 'string' ? m : fb);
};

export function FrotaPage() {
  const { toast } = useToast();

  const [viagens, setViagens] = useState<ViagemFrota[]>([]);
  const [veiculos, setVeiculos] = useState<VeiculoDisp[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');

  const carregar = async () => {
    setLoading(true);
    try {
      const [v, frota] = await Promise.all([
        logisticaApi.get<ViagemFrota[]>('/frota/viagens', { params: filtro ? { situacao: filtro } : {} }),
        logisticaApi.get<VeiculoDisp[]>('/veiculos'),
      ]);
      setViagens(v.data);
      setVeiculos(frota.data.filter((x) => x.situacao === 'DISPONIVEL'));
    } catch (e) {
      toast('error', errMsg(e, 'Falha ao carregar viagens de frota.'));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void carregar(); /* eslint-disable-next-line */ }, [filtro]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Fuel className="h-6 w-6 text-sky-600" />
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Controle de Frota</h2>
          <p className="text-sm text-slate-500">Saída e retorno de veículos — o condutor se identifica com matrícula e senha.</p>
        </div>
      </div>

      <SaidaForm veiculos={veiculos} onDone={carregar} />

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-700">Viagens de frota</h3>
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
          >
            <option value="">Todas</option>
            <option value="EM_CURSO">Em curso</option>
            <option value="CONCLUIDA">Concluídas</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" /> Carregando…
          </div>
        ) : viagens.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">Nenhuma viagem de frota.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Veículo</th>
                <th className="px-4 py-2">Condutor</th>
                <th className="px-4 py-2">Finalidade</th>
                <th className="px-4 py-2">Saída</th>
                <th className="px-4 py-2">Retorno</th>
                <th className="px-4 py-2 text-right">KM</th>
                <th className="px-4 py-2 text-center">Paradas</th>
                <th className="px-4 py-2">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {viagens.map((v) => (
                <LinhaViagem key={v.id} v={v} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ---- Formulário de SAÍDA (matrícula → nome → senha → veículo/km) ----
export interface CondutorBusca { matricula: string; nome: string; cc: string | null }
interface DeptoItem { id: string; nome: string }

/** Cabeçalho de passo numerado, grande e legível (usabilidade — Fase 6). */
function PassoHeader({ n, titulo, hint, ativo = true }: { n: number; titulo: string; hint?: string; ativo?: boolean }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${ativo ? 'bg-sky-600' : 'bg-slate-300'}`}>{n}</span>
      <div>
        <h4 className="text-base font-semibold text-slate-800">{titulo}</h4>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}

function SaidaForm({ veiculos, onDone }: { veiculos: VeiculoDisp[]; onDone: () => void }) {
  const { toast } = useToast();
  const { logisticaRole, usuario } = useAuth();
  // Exceção da PORTARIA (apontar por nome, sem senha) — só gestores autorizados.
  const ehGestorPortaria = ['GESTOR_FROTA', 'GESTOR_ENTREGA', 'ADMIN'].includes(logisticaRole ?? '');
  const [aberto, setAberto] = useState(false);
  const [modo, setModo] = useState<'CONDUTOR' | 'PORTARIA'>('CONDUTOR');
  const [matricula, setMatricula] = useState('');
  const [nome, setNome] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [senha, setSenha] = useState('');
  const [veiculoId, setVeiculoId] = useState('');
  const [kmInicial, setKmInicial] = useState('');
  const [finalidade, setFinalidade] = useState('');
  const [localSaida, setLocalSaida] = useState('');
  const [departamentoSolicitanteId, setDepartamentoSolicitanteId] = useState('');
  const [deptos, setDeptos] = useState<DeptoItem[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [credOk, setCredOk] = useState(false);
  const [validandoSenha, setValidandoSenha] = useState(false);
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  // Estado da busca por nome (modo portaria).
  const [nomeBusca, setNomeBusca] = useState('');
  const [resultados, setResultados] = useState<CondutorBusca[]>([]);
  const [buscandoNome, setBuscandoNome] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const [condutorSel, setCondutorSel] = useState<CondutorBusca | null>(null);
  const senhaRef = useRef<HTMLInputElement>(null);
  const veiculoRef = useRef<HTMLSelectElement>(null);

  // Avança o passo 2: no modo condutor exige senha validada; na portaria, exige
  // ter escolhido um condutor da busca por nome (sem senha).
  const podeAvancar = modo === 'PORTARIA' ? !!condutorSel : credOk;

  // Ao resolver o nome, posiciona o cursor na senha.
  useEffect(() => { if (nome) senhaRef.current?.focus(); }, [nome]);

  // Departamentos da filial p/ "departamento solicitante" (alimenta o ranking de
  // uso por departamento no Monitor). Carrega ao abrir o form.
  useEffect(() => {
    if (!aberto) return;
    const filialId = usuario?.filialAtual?.id;
    coreApi.get<DeptoItem[]>('/departamentos', { params: filialId ? { filialId } : undefined })
      .then((r) => setDeptos(r.data))
      .catch(() => setDeptos([]));
  }, [aberto, usuario?.filialAtual?.id]);

  const reset = () => {
    setMatricula(''); setNome(null); setSenha(''); setVeiculoId('');
    setKmInicial(''); setFinalidade(''); setLocalSaida(''); setErroSenha(null); setCredOk(false);
    setDepartamentoSolicitanteId('');
    setNomeBusca(''); setResultados([]); setBuscou(false); setCondutorSel(null);
  };

  // Busca condutor por NOME no Protheus (modo portaria — sem senha).
  const buscarNome = async () => {
    if (nomeBusca.trim().length < 3 || buscandoNome) return;
    setBuscandoNome(true); setBuscou(false); setCondutorSel(null); setResultados([]);
    try {
      const { data } = await logisticaApi.get<CondutorBusca[]>('/frota/condutores/busca', { params: { nome: nomeBusca.trim() } });
      setResultados(data); setBuscou(true);
    } catch (e) {
      toast('error', errMsg(e, 'Falha na busca por nome.'));
    } finally {
      setBuscandoNome(false);
    }
  };

  const buscarCondutor = async () => {
    if (!matricula.trim() || nome || buscando) return;
    setBuscando(true); setNome(null);
    try {
      const { data } = await logisticaApi.post<{ matricula: string; nome: string }>('/frota/condutor', { matricula: matricula.trim() });
      setNome(data.nome);
    } catch (e) {
      toast('error', errMsg(e, 'Matrícula não encontrada.'));
    } finally {
      setBuscando(false);
    }
  };

  // Valida matrícula+senha (passo): só libera o resto se confirmar. Sem deslogar.
  const validarSenha = async () => {
    if (!nome || !senha.trim() || credOk || validandoSenha) return;
    setValidandoSenha(true); setErroSenha(null);
    try {
      const { data } = await logisticaApi.post<{ valida: boolean; motivo?: string }>(
        '/frota/condutor/validar', { matricula: matricula.trim(), senha });
      if (data.valida) { setCredOk(true); setTimeout(() => veiculoRef.current?.focus(), 0); }
      else { setErroSenha(data.motivo === 'INDISPONIVEL' ? 'Portal do RH indisponível. Tente novamente.' : 'Matrícula ou senha inválidas.'); }
    } catch (e) {
      setErroSenha(errMsg(e, 'Falha ao validar a senha.'));
    } finally {
      setValidandoSenha(false);
    }
  };

  const registrar = async () => {
    if (!podeAvancar) {
      toast('warning', modo === 'PORTARIA' ? 'Busque e selecione o condutor.' : 'Valide a matrícula e a senha do condutor.');
      return;
    }
    if (!veiculoId) { toast('warning', 'Selecione o veículo.'); return; }
    if (kmInicial === '') { toast('warning', 'Informe o KM de saída.'); return; }
    setSalvando(true);
    try {
      if (modo === 'PORTARIA') {
        await logisticaApi.post('/frota/viagens/portaria', {
          condutorMatricula: condutorSel!.matricula, condutorNome: condutorSel!.nome, veiculoId,
          kmInicial: Number(kmInicial),
          finalidade: finalidade.trim() || undefined,
          localSaida: localSaida.trim() || undefined,
          departamentoSolicitanteId: departamentoSolicitanteId || undefined,
        });
        toast('success', 'Saída registrada pela portaria (sob sua responsabilidade).');
      } else {
        await logisticaApi.post('/frota/viagens', {
          matricula: matricula.trim(), senha, veiculoId,
          kmInicial: Number(kmInicial),
          finalidade: finalidade.trim() || undefined,
          localSaida: localSaida.trim() || undefined,
          departamentoSolicitanteId: departamentoSolicitanteId || undefined,
        });
        toast('success', 'Saída registrada.');
      }
      reset(); setAberto(false); onDone();
    } catch (e) {
      toast('error', errMsg(e, 'Falha ao registrar saída.'));
    } finally {
      setSalvando(false);
    }
  };

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-5 py-2.5 text-base font-semibold text-white hover:bg-sky-700"
      >
        <LogOut className="h-5 w-5" /> Registrar saída
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-800">Registrar saída de veículo</h3>
        <button onClick={() => { reset(); setAberto(false); }} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
      </div>

      <div className="space-y-6">
        {ehGestorPortaria && (
          <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 text-xs font-medium">
            <button onClick={() => { setModo('CONDUTOR'); reset(); }}
              className={`rounded-md px-3 py-1.5 ${modo === 'CONDUTOR' ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
              Condutor (matrícula + senha)
            </button>
            <button onClick={() => { setModo('PORTARIA'); reset(); }}
              className={`rounded-md px-3 py-1.5 ${modo === 'PORTARIA' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
              Pela portaria (por nome, sem senha)
            </button>
          </div>
        )}

        {/* Passo 1 — Condutor (matrícula + senha) */}
        {modo === 'CONDUTOR' && (
        <div>
          <PassoHeader n={1} titulo="Condutor" hint="Matrícula e senha do portal RH" />
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-12">
            <div className="sm:col-span-6">
              <label className="mb-1 block text-sm font-medium text-slate-600">Matrícula</label>
              <div className="flex gap-1">
                <input
                  value={matricula}
                  onChange={(e) => { setMatricula(e.target.value); setNome(null); setCredOk(false); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') void buscarCondutor(); }}
                  onBlur={() => void buscarCondutor()}
                  placeholder="ex.: E01047"
                  autoComplete="off"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base"
                />
                <button
                  onClick={() => void buscarCondutor()}
                  disabled={buscando || !matricula.trim() || !!nome}
                  title="Buscar condutor"
                  className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </button>
              </div>
              {nome && <p className="mt-1 text-xs font-medium text-emerald-700">{nome}</p>}
            </div>

            <div className="sm:col-span-6">
              <label className="mb-1 block text-sm font-medium text-slate-600">Senha do portal RH</label>
              <div className="flex items-center gap-1">
                <PasswordInput
                  ref={senhaRef}
                  wrapperClassName="flex-1"
                  value={senha}
                  onChange={(e) => { setSenha(e.target.value); setErroSenha(null); setCredOk(false); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') void validarSenha(); }}
                  onBlur={() => void validarSenha()}
                  disabled={!nome || credOk} autoComplete="new-password" name="frota-senha-saida"
                  placeholder={nome ? 'Senha e Enter' : ''}
                  className={`w-full rounded-lg border px-3.5 py-2.5 text-base disabled:bg-slate-100 ${erroSenha ? 'border-rose-400' : (credOk ? 'border-emerald-400' : 'border-slate-300')}`}
                />
                {validandoSenha && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" />}
              </div>
              {erroSenha && <p className="mt-1 text-xs font-medium text-rose-600">{erroSenha}</p>}
              {credOk && <p className="mt-1 text-xs font-medium text-emerald-700">✓ Senha confere</p>}
            </div>
          </div>
        </div>
        )}

        {/* Passo 1 — Portaria (busca por nome, sem senha) */}
        {modo === 'PORTARIA' && (
        <div>
          <PassoHeader n={1} titulo="Condutor (pela portaria)" />
          <p className="mb-2 text-xs text-amber-700">Exceção: a viagem é apontada ao condutor <b>sem a senha dele</b> — fica registrada sob a sua responsabilidade.</p>
          <div className="flex max-w-md gap-1">
            <input
              value={nomeBusca}
              onChange={(e) => { setNomeBusca(e.target.value); setBuscou(false); setCondutorSel(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') void buscarNome(); }}
              placeholder="Nome do condutor (mín. 3 letras)"
              autoComplete="off"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base"
            />
            <button onClick={() => void buscarNome()} disabled={buscandoNome || nomeBusca.trim().length < 3}
              title="Buscar por nome"
              className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm hover:bg-slate-50 disabled:opacity-50">
              {buscandoNome ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </button>
          </div>
          {buscou && resultados.length === 0 && (
            <p className="mt-2 text-xs text-slate-500">Nenhum funcionário encontrado (ou sem acesso ao portal RH).</p>
          )}
          {resultados.length > 0 && (
            <ul className="mt-2 max-w-md divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
              {resultados.map((c) => (
                <li key={c.matricula}>
                  <button onClick={() => setCondutorSel(c)}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 ${condutorSel?.matricula === c.matricula ? 'bg-sky-50' : ''}`}>
                    <span><span className="font-medium text-slate-800">{c.nome}</span><span className="text-slate-400"> · {c.matricula}{c.cc ? ` · CC ${c.cc}` : ''}</span></span>
                    {condutorSel?.matricula === c.matricula && <span className="shrink-0 text-xs font-medium text-sky-700">✓</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {condutorSel && <p className="mt-2 text-xs font-medium text-emerald-700">Selecionado: {condutorSel.nome} ({condutorSel.matricula})</p>}
        </div>
        )}

        {/* Passo 2 — Viagem (libera após validar a senha) */}
        <div className={podeAvancar ? '' : 'opacity-60'}>
          <PassoHeader n={2} titulo="Veículo e saída" hint={podeAvancar ? undefined : 'Valide o condutor primeiro'} ativo={podeAvancar} />
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-12">
            <div className="sm:col-span-5">
              <label className="mb-1 block text-sm font-medium text-slate-600">Veículo (disponível)</label>
              <select
                ref={veiculoRef}
                value={veiculoId}
                onChange={(e) => {
                  setVeiculoId(e.target.value);
                  // Sugere o KM do veículo escolhido — e ATUALIZA ao trocar de veículo.
                  const sel = veiculos.find((x) => x.id === e.target.value);
                  setKmInicial(sel ? String(sel.kmAtual) : '');
                }}
                disabled={!podeAvancar}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base disabled:bg-slate-100"
              >
                <option value="">Selecione…</option>
                {veiculos.map((x) => (
                  <option key={x.id} value={x.id}>{x.placa}{x.modelo ? ` — ${x.modelo}` : ''} (KM {x.kmAtual})</option>
                ))}
              </select>
              {podeAvancar && veiculos.length === 0 && (
                <p className="mt-1 text-xs font-medium text-amber-600">Nenhum veículo disponível na filial.</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-600">KM de saída</label>
              <input
                type="number" value={kmInicial} onChange={(e) => setKmInicial(e.target.value)}
                disabled={!podeAvancar}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base disabled:bg-slate-100"
              />
            </div>

            <div className="sm:col-span-5">
              <label className="mb-1 block text-sm font-medium text-slate-600">Finalidade / destino</label>
              <input
                value={finalidade} onChange={(e) => setFinalidade(e.target.value)} maxLength={255} disabled={!podeAvancar}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base disabled:bg-slate-100"
              />
            </div>

            <div className="sm:col-span-6">
              <label className="mb-1 block text-sm font-medium text-slate-600">Departamento solicitante</label>
              <select
                value={departamentoSolicitanteId} onChange={(e) => setDepartamentoSolicitanteId(e.target.value)} disabled={!podeAvancar}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base disabled:bg-slate-100"
              >
                <option value="">— Não informado —</option>
                {deptos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
              </select>
              <p className="mt-1 text-xs text-slate-400">Quem pediu o veículo — alimenta o "Uso por departamento" no Monitor.</p>
            </div>

            <div className="sm:col-span-6">
              <label className="mb-1 block text-sm font-medium text-slate-600">Local de saída (opcional)</label>
              <input
                value={localSaida} onChange={(e) => setLocalSaida(e.target.value)} maxLength={120} disabled={!podeAvancar}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base disabled:bg-slate-100"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={() => void registrar()}
          disabled={salvando || !podeAvancar || !veiculoId || kmInicial === ''}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-6 py-3 text-base font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {salvando ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />} Registrar saída
        </button>
      </div>
    </div>
  );
}

// ---- Linha da viagem + ações de retorno / ajuste ----
function LinhaViagem({ v }: { v: ViagemFrota }) {
  const navigate = useNavigate();
  const sit = SIT_META[v.situacao] ?? { label: v.situacao, cls: 'bg-slate-100 text-slate-600' };
  // Linha clicável → tela de detalhe da viagem (retorno/despesa/paradas/ajuste).
  return (
    <tr className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/frota/viagens/${v.id}`)}>
      <td className="px-4 py-2 font-mono text-slate-500">{v.numero}</td>
      <td className="px-4 py-2">{v.placa}{v.modelo ? <span className="text-slate-400"> · {v.modelo}</span> : null}</td>
      <td className="px-4 py-2">{v.condutorNome ?? '—'}</td>
      <td className="px-4 py-2 text-slate-600"><span className="block max-w-[14rem] truncate" title={v.finalidade ?? ''}>{v.finalidade ?? '—'}</span></td>
      <td className="px-4 py-2 text-slate-600">{fmtDateTime(v.dataHoraSaida)}</td>
      <td className="px-4 py-2 text-slate-600">{fmtDateTime(v.dataHoraChegada)}</td>
      <td className="px-4 py-2 text-right tabular-nums">
        {v.kmRodado != null ? `${v.kmRodado} km` : v.kmInicial != null ? `${v.kmInicial} →` : '—'}
      </td>
      <td className="px-4 py-2 text-center text-slate-500">{v.paradas ?? 0}</td>
      <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${sit.cls}`}>{sit.label}</span></td>
    </tr>
  );
}

// ---- Grid de paradas (pontos de rota / "caderno" da viagem) ----
export function ParadasPanel({ v, onChanged }: { v: ViagemFrota; onChanged: () => void }) {
  const { toast } = useToast();
  const [paradas, setParadas] = useState<ParadaFrota[]>([]);
  const [loading, setLoading] = useState(true);
  const [local, setLocal] = useState('');
  const [km, setKm] = useState('');
  const [obs, setObs] = useState('');
  const [salvando, setSalvando] = useState(false);
  const editavel = v.situacao !== 'CANCELADA';

  const carregar = async () => {
    setLoading(true);
    try {
      const { data } = await logisticaApi.get<ParadaFrota[]>(`/frota/viagens/${v.id}/paradas`);
      setParadas(data);
    } catch (e) {
      toast('error', errMsg(e, 'Falha ao carregar paradas.'));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void carregar(); /* eslint-disable-next-line */ }, [v.id]);

  const adicionar = async () => {
    if (!local.trim()) { toast('warning', 'Informe o local da parada.'); return; }
    setSalvando(true);
    try {
      await logisticaApi.post(`/frota/viagens/${v.id}/paradas`, {
        local: local.trim(), km: km === '' ? undefined : Number(km), observacao: obs.trim() || undefined,
      });
      setLocal(''); setKm(''); setObs('');
      await carregar(); onChanged();
    } catch (e) {
      toast('error', errMsg(e, 'Falha ao adicionar parada.'));
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (pid: string) => {
    try {
      await logisticaApi.delete(`/frota/viagens/${v.id}/paradas/${pid}`);
      await carregar(); onChanged();
    } catch (e) {
      toast('error', errMsg(e, 'Falha ao remover parada.'));
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">Paradas da viagem #{v.numero} — registro dos pontos de rota (o caderno digital da frota).</p>

      {loading ? (
        <div className="flex items-center gap-2 py-3 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
      ) : paradas.length === 0 ? (
        <p className="py-2 text-sm text-slate-400">Nenhuma parada registrada.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-400">
            <tr><th className="py-1 pr-3">#</th><th className="py-1 pr-3">Local</th><th className="py-1 pr-3">KM</th><th className="py-1 pr-3">Hora</th><th className="py-1 pr-3">Observação</th><th></th></tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {paradas.map((p) => (
              <tr key={p.id}>
                <td className="py-1 pr-3 font-mono text-slate-400">{p.sequencia}</td>
                <td className="py-1 pr-3">{p.local}</td>
                <td className="py-1 pr-3 tabular-nums">{p.km ?? '—'}</td>
                <td className="py-1 pr-3 text-slate-500">{fmtDateTime(p.dataHora)}</td>
                <td className="py-1 pr-3 text-slate-500">{p.observacao ?? '—'}</td>
                <td className="py-1 text-right">
                  {editavel && (
                    <button onClick={() => void remover(p.id)} className="text-slate-400 hover:text-rose-600" title="Remover">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editavel && (
        <div className="flex flex-wrap items-end gap-2 border-t border-slate-200 pt-3">
          <input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Local da parada" maxLength={120} className="min-w-[12rem] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
          <input type="number" value={km} onChange={(e) => setKm(e.target.value)} placeholder="KM" className="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
          <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observação" maxLength={255} className="min-w-[10rem] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
          <button onClick={() => void adicionar()} disabled={salvando} className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Adicionar
          </button>
        </div>
      )}
    </div>
  );
}

export function RetornoForm({ v, onClose, onDone }: { v: ViagemFrota; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [matricula, setMatricula] = useState(v.condutorMatricula ?? '');
  // O condutor já é conhecido pela viagem (da saída) — começa identificado.
  const [nome, setNome] = useState<string | null>(v.condutorNome ?? null);
  const [buscando, setBuscando] = useState(false);
  const [senha, setSenha] = useState('');
  const [kmFinal, setKmFinal] = useState('');
  const [obs, setObs] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [credOk, setCredOk] = useState(false);
  const [validandoSenha, setValidandoSenha] = useState(false);
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const senhaRef = useRef<HTMLInputElement>(null);
  const kmRef = useRef<HTMLInputElement>(null);

  // Só avança depois que matrícula+senha forem VALIDADAS.
  const podeAvancar = credOk;

  // Foca a senha assim que o condutor estiver identificado.
  useEffect(() => { if (nome) senhaRef.current?.focus(); }, [nome]);

  const buscarCondutor = async () => {
    if (!matricula.trim() || nome || buscando) return;
    setBuscando(true); setNome(null); setCredOk(false);
    try {
      const { data } = await logisticaApi.post<{ matricula: string; nome: string }>('/frota/condutor', { matricula: matricula.trim() });
      setNome(data.nome);
    } catch (e) {
      toast('error', errMsg(e, 'Matrícula não encontrada.'));
    } finally {
      setBuscando(false);
    }
  };

  const validarSenha = async () => {
    if (!nome || !senha.trim() || credOk || validandoSenha) return;
    setValidandoSenha(true); setErroSenha(null);
    try {
      const { data } = await logisticaApi.post<{ valida: boolean; motivo?: string }>(
        '/frota/condutor/validar', { matricula: matricula.trim(), senha });
      if (data.valida) { setCredOk(true); setTimeout(() => kmRef.current?.focus(), 0); }
      else { setErroSenha(data.motivo === 'INDISPONIVEL' ? 'Portal do RH indisponível. Tente novamente.' : 'Matrícula ou senha inválidas.'); }
    } catch (e) {
      setErroSenha(errMsg(e, 'Falha ao validar a senha.'));
    } finally {
      setValidandoSenha(false);
    }
  };

  const registrar = async () => {
    if (!credOk) { toast('warning', 'Valide a matrícula e a senha do condutor.'); return; }
    if (kmFinal === '') { toast('warning', 'Informe o KM de retorno.'); return; }
    setSalvando(true);
    try {
      await logisticaApi.post(`/frota/viagens/${v.id}/retorno`, {
        matricula: matricula.trim(), senha, kmFinal: Number(kmFinal), observacoes: obs.trim() || undefined,
      });
      toast('success', 'Retorno registrado.');
      onDone();
    } catch (e) {
      toast('error', errMsg(e, 'Falha ao registrar retorno.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-700"><LogIn className="h-4 w-4 text-emerald-600" /> Registrar retorno — viagem #{v.numero}</p>
      <p className="text-xs text-slate-500">Só o condutor que iniciou pode fechar (matrícula + senha).</p>
      <div className="flex flex-wrap items-start gap-4">
        <div className="w-56">
          <label className="mb-1 block text-sm font-medium text-slate-600">Matrícula</label>
          <div className="flex gap-1">
            <input
              value={matricula}
              onChange={(e) => { setMatricula(e.target.value); setNome(null); setCredOk(false); }}
              onKeyDown={(e) => { if (e.key === 'Enter') void buscarCondutor(); }}
              onBlur={() => void buscarCondutor()}
              placeholder="ex.: E01047"
              autoComplete="off"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              onClick={() => void buscarCondutor()}
              disabled={buscando || !matricula.trim() || !!nome}
              className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </button>
          </div>
          {nome && <p className="mt-1 text-xs font-medium text-emerald-700">{nome}</p>}
        </div>
        <div className="w-52">
          <label className="mb-1 block text-sm font-medium text-slate-600">Senha do portal RH</label>
          <div className="flex items-center gap-1">
            <PasswordInput
              ref={senhaRef}
              wrapperClassName="flex-1"
              value={senha}
              onChange={(e) => { setSenha(e.target.value); setErroSenha(null); setCredOk(false); }}
              onKeyDown={(e) => { if (e.key === 'Enter') void validarSenha(); }}
              onBlur={() => void validarSenha()}
              disabled={!nome || credOk}
              placeholder={nome ? 'Senha e Enter' : 'Senha'} autoComplete="new-password" name="frota-senha-retorno"
              className={`w-full rounded-lg border px-3.5 py-2.5 text-base disabled:bg-slate-100 ${erroSenha ? 'border-rose-400' : (credOk ? 'border-emerald-400' : 'border-slate-300')}`}
            />
            {validandoSenha && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" />}
          </div>
          {erroSenha && <p className="mt-1 text-xs font-medium text-rose-600">{erroSenha}</p>}
          {credOk && <p className="mt-1 text-xs font-medium text-emerald-700">✓ Senha confere</p>}
        </div>
        <div className={`w-40 ${podeAvancar ? '' : 'opacity-60'}`}>
          <label className="mb-1 block text-sm font-medium text-slate-600">KM de retorno</label>
          <input
            ref={kmRef}
            type="number" value={kmFinal} onChange={(e) => setKmFinal(e.target.value)} disabled={!podeAvancar}
            placeholder={`saída ${v.kmInicial ?? '—'}`}
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base disabled:bg-slate-100"
          />
        </div>
        <div className={`min-w-[20rem] flex-1 ${podeAvancar ? '' : 'opacity-60'}`}>
          <label className="mb-1 block text-sm font-medium text-slate-600">Observações (opcional)</label>
          <input
            value={obs} onChange={(e) => setObs(e.target.value)} disabled={!podeAvancar}
            maxLength={255}
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base disabled:bg-slate-100"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-white">Cancelar</button>
        <button onClick={() => void registrar()} disabled={salvando || !podeAvancar || kmFinal === ''} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />} Registrar retorno
        </button>
      </div>
    </div>
  );
}

// Lançamento de despesa NA viagem em curso → PENDENTE. A viagem já foi aberta
// pelo condutor autenticado na saída — herda o condutor, NÃO pede senha de novo.
export function DespesaCondutorForm({ v, tipos, onClose, onDone }: { v: ViagemFrota; tipos: TipoDespesa[]; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [tipoDespesaId, setTipoDespesaId] = useState('');
  const [valor, setValor] = useState('');
  const [fornecedorId, setFornecedorId] = useState('');
  const [fornecedores, setFornecedores] = useState<FornecedorDespesa[]>([]);
  const [fornecedor, setFornecedor] = useState('');
  const [obs, setObs] = useState('');
  const [recibo, setRecibo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    logisticaApi.get<FornecedorDespesa[]>('/despesas/fornecedores', { params: { ativos: 'true' } })
      .then((r) => setFornecedores(r.data)).catch(() => {});
  }, []);

  const lancar = async () => {
    if (!tipoDespesaId) { toast('warning', 'Selecione o tipo de despesa.'); return; }
    if (valor === '' || Number(valor) <= 0) { toast('warning', 'Informe um valor válido.'); return; }
    setSalvando(true);
    try {
      // Com recibo → multipart; sem → JSON. Backend aceita os dois.
      if (recibo) {
        const fd = new FormData();
        fd.append('viagemId', v.id);
        fd.append('tipoDespesaId', tipoDespesaId);
        fd.append('valor', String(Number(valor)));
        if (fornecedorId) fd.append('fornecedorId', fornecedorId);
        if (fornecedor.trim()) fd.append('fornecedor', fornecedor.trim());
        if (obs.trim()) fd.append('observacao', obs.trim());
        fd.append('comprovante', recibo);
        await logisticaApi.post('/despesas/viagem', fd);
      } else {
        await logisticaApi.post('/despesas/viagem', {
          viagemId: v.id, tipoDespesaId, valor: Number(valor),
          fornecedorId: fornecedorId || undefined,
          fornecedor: fornecedor.trim() || undefined, observacao: obs.trim() || undefined,
        });
      }
      toast('success', 'Despesa lançada — pode lançar outra.');
      // Limpa pra lançar a PRÓXIMA despesa da mesma viagem sem recarregar a tela.
      setTipoDespesaId(''); setValor(''); setFornecedorId(''); setFornecedor(''); setObs(''); setRecibo(null);
      onDone();
    } catch (e) {
      toast('error', errMsg(e, 'Falha ao lançar despesa.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Banknote className="h-4 w-4 text-sky-600" /> Lançar despesa — viagem #{v.numero}</p>
      <p className="text-xs text-slate-500">Condutor <b>{v.condutorNome ?? '—'}</b> (da saída); entra como <b>pendente</b> até o supervisor validar.</p>
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-52">
          <label className="mb-1 block text-sm font-medium text-slate-600">Tipo de despesa</label>
          <select value={tipoDespesaId} onChange={(e) => setTipoDespesaId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Selecione…</option>
            {tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </div>
        <div className="w-32">
          <label className="mb-1 block text-sm font-medium text-slate-600">Valor (R$)</label>
          <input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div className="w-72">
          <label className="mb-1 block text-sm font-medium text-slate-600">Fornecedor (cadastrado)</label>
          <select value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">— Não definido —</option>
            {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
          <input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} maxLength={120} placeholder="ou digite (não cadastrado)" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div className="min-w-[16rem] flex-1">
          <label className="mb-1 block text-sm font-medium text-slate-600">Observação (opcional)</label>
          <input value={obs} onChange={(e) => setObs(e.target.value)} maxLength={255} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div className="min-w-[14rem]">
          <label className="mb-1 block text-sm font-medium text-slate-600">Recibo / cupom (opcional)</label>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
            <Paperclip className="h-4 w-4 text-slate-400" />
            <span className="max-w-[10rem] truncate">{recibo ? recibo.name : 'Anexar foto/PDF'}</span>
            <input type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={(e) => setRecibo(e.target.files?.[0] ?? null)} />
          </label>
          {recibo && <button type="button" onClick={() => setRecibo(null)} className="ml-2 text-xs text-slate-400 hover:text-rose-500">remover</button>}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-white">Cancelar</button>
        <button onClick={() => void lancar()} disabled={salvando} className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />} Lançar despesa
        </button>
      </div>
    </div>
  );
}

export function AjusteForm({ v, onClose, onDone }: { v: ViagemFrota; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [kmInicial, setKmInicial] = useState(v.kmInicial != null ? String(v.kmInicial) : '');
  const [kmFinal, setKmFinal] = useState(v.kmFinal != null ? String(v.kmFinal) : '');
  const [obsChegada, setObsChegada] = useState('');
  const [concluir, setConcluir] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    setSalvando(true);
    try {
      await logisticaApi.patch(`/frota/viagens/${v.id}`, {
        kmInicial: kmInicial === '' ? undefined : Number(kmInicial),
        kmFinal: kmFinal === '' ? undefined : Number(kmFinal),
        observacoesChegada: obsChegada.trim() || undefined,
        concluir,
      });
      toast('success', concluir ? 'Viagem ajustada e fechada.' : 'Viagem ajustada.');
      onDone();
    } catch (e) {
      toast('error', errMsg(e, 'Falha ao ajustar viagem.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-amber-700">Ajuste de gestor — use quando o condutor não fechou a viagem corretamente.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-xs text-slate-600">KM saída
          <input type="number" value={kmInicial} onChange={(e) => setKmInicial(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-xs text-slate-600">KM retorno
          <input type="number" value={kmFinal} onChange={(e) => setKmFinal(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-xs text-slate-600">Observações
          <input value={obsChegada} onChange={(e) => setObsChegada(e.target.value)} maxLength={255} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={concluir} onChange={(e) => setConcluir(e.target.checked)} />
        Fechar a viagem (concluir) com o KM de retorno informado
      </label>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-white">Cancelar</button>
        <button onClick={() => void salvar()} disabled={salvando} className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50">
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings2 className="h-4 w-4" />} Salvar
        </button>
      </div>
    </div>
  );
}
