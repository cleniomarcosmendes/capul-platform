import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, Loader2, MapPin, Plus, Sparkles, Truck, X } from 'lucide-react';
import { logisticaApi } from '../services/api';
import { useToast } from '../components/toast-context';
import { useAuth } from '../contexts/AuthContext';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { MapaRota } from '../components/MapaRota';

// Montagem de viagem (página dedicada — redesenho 12/06 a pedido do Clenio):
// modelo "carrinho": fila de pendentes à esquerda → rota em construção à
// direita como LISTA VERTICAL numerada (mover ↑↓, remover, sugerir ordem) →
// veículo/motorista → montar. Sem disputa de espaço com a gestão de viagens
// (que agora vive em /viagens, padrão List→Detalhe).

interface CoreItem { id: string; nome?: string; codigo?: string; nomeFantasia?: string }
interface Veiculo { id: string; placa: string; modelo?: string | null }
interface Entrega {
  id: string; numero: number; destinatarioNome: string;
  endLogradouro: string; endNumero?: string | null; endBairro?: string | null;
  quantidadeVolumes: number; criadoEm: string; horario?: string | null;
  tentativas?: number; geocodificavel?: boolean | null;
}

// Até onde o endereço foi localizado. CEP/LOGRADOURO = ponto na porta;
// BAIRRO/CIDADE = âncora aproximada (o centroide do município chega a ficar mais
// de 1 km do endereço real) — é a causa de uma parada vizinha da filial ser
// tratada como distante e cair no fim da rota sugerida.
type Precisao = 'CEP' | 'LOGRADOURO' | 'BAIRRO' | 'CIDADE' | 'MANUAL';
type OrigemRota = 'FILIAL' | 'PRIMEIRA_ENTREGA' | null;

const PRECISAO_INFO: Record<Precisao, { label: string; aproximada: boolean }> = {
  CEP: { label: 'na porta', aproximada: false },
  LOGRADOURO: { label: 'na porta', aproximada: false },
  BAIRRO: { label: 'só o bairro', aproximada: true },
  CIDADE: { label: 'centro da cidade', aproximada: true },
  MANUAL: { label: 'corrigida à mão', aproximada: false },
};

const labelCore = (i: CoreItem) => i.nomeFantasia || i.nome || i.codigo || i.id.slice(0, 8);
const SEM_BAIRRO = '__SEM__';
const keyBairro = (b?: string | null) => (b ?? '').trim().toUpperCase() || SEM_BAIRRO;

export function MontarViagemPage() {
  const { usuario, temRole } = useAuth();
  const navigate = useNavigate();
  const filialId = usuario?.filialAtual?.id ?? usuario?.filiais?.[0]?.id ?? '';

  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [motoristas, setMotoristas] = useState<CoreItem[]>([]);
  const [pendentes, setPendentes] = useState<Entrega[]>([]);
  const [loading, setLoading] = useState(true);

  const [veiculoId, setVeiculoId] = useState('');
  const [motoristaId, setMotoristaId] = useState('');
  const [rota, setRota] = useState<string[]>([]); // ids na ordem da rota
  // Última ordem sugerida — o botão "Sugerir melhor rota" desabilita enquanto a
  // rota atual for IGUAL a ela; qualquer mudança (add/remover/mover) reabilita.
  const [ultimaSugestao, setUltimaSugestao] = useState<string[] | null>(null);
  // Diagnóstico da última sugestão: até onde cada endereço foi localizado e de
  // onde a rota partiu. Sem isso o operador não tem como saber que uma parada
  // entrou na conta ancorada no centro da cidade — e por que ela "saiu fora de
  // ordem" mesmo sendo vizinha da filial.
  const [precisao, setPrecisao] = useState<Record<string, Precisao>>({});
  const [diag, setDiag] = useState<{ origemRota: OrigemRota; origemPrecisao: Precisao | null; aproximadas: number } | null>(null);
  // Coordenadas devolvidas pela sugestão — alimentam o mapa e continuam válidas
  // enquanto o operador reordena na mão (não precisa recalcular pra ver o efeito).
  const [coordenadas, setCoordenadas] = useState<Record<string, { lat: number; lng: number }>>({});
  const [origemCoord, setOrigemCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [bairrosSel, setBairrosSel] = useState<string[]>([]);
  const [busca, setBusca] = useState('');
  const [sugerindo, setSugerindo] = useState(false);
  const [montando, setMontando] = useState(false);
  const [salvou, setSalvou] = useState(false);
  // Rota em construcao nao salva = trabalho a perder (padrao workspace).
  const { ConfirmDialog: DirtyDialog, guardedNavigate } = useUnsavedChanges(rota.length > 0 && !salvou);
  const { toast, confirm } = useToast();
  const [regeo, setRegeo] = useState(false);
  // Recalcular localização é manutenção de gestor (não do operador que só monta).
  const ehGestor = temRole('GESTOR_ENTREGA', 'GESTOR_FROTA', 'ADMIN');

  const recalcularLocalizacoes = async () => {
    const ok = await confirm(
      'Recalcular localizações',
      'Recalcula no mapa a posição das entregas da filial a partir do endereço (rua → bairro → município). Útil quando uma entrega cai fora do lugar. Depois, use “Sugerir ordem” para ver a rota atualizada.',
      { confirmLabel: 'Recalcular' },
    );
    if (!ok) return;
    setRegeo(true);
    try {
      const { data } = await logisticaApi.post<{ total: number; atualizadas: number; semCoordenada: number }>('/entregas/regeocodificar', {});
      toast('success', `${data.atualizadas} de ${data.total} entregas relocalizadas${data.semCoordenada ? ` · ${data.semCoordenada} sem endereço resolvível` : ''}. Use “Sugerir ordem” para atualizar a rota.`);
    } catch {
      toast('error', 'Não foi possível recalcular agora. Tente novamente em instantes.');
    } finally {
      setRegeo(false);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [v, u, e] = await Promise.all([
          logisticaApi.get<Veiculo[]>('/veiculos', { params: filialId ? { filialId, situacao: 'DISPONIVEL' } : { situacao: 'DISPONIVEL' } }),
          logisticaApi.get<CoreItem[]>('/motoristas', { params: filialId ? { filialId } : undefined }).catch(() => ({ data: [] })),
          logisticaApi.get<Entrega[]>('/entregas', { params: filialId ? { filialId } : undefined }),
        ]);
        setVeiculos(v.data); setMotoristas(u.data); setPendentes(e.data);
      } finally { setLoading(false); }
    })();
  }, [filialId]);

  const porId = useMemo(() => new Map(pendentes.map((e) => [e.id, e])), [pendentes]);

  // Fila = pendentes que ainda NÃO estão na rota, filtradas por bairro/busca.
  const bairros = useMemo(() => {
    const m = new Map<string, { label: string; count: number }>();
    for (const e of pendentes) {
      if (rota.includes(e.id)) continue;
      const k = keyBairro(e.endBairro);
      const label = (e.endBairro ?? '').trim() || 'Sem bairro';
      const cur = m.get(k);
      if (cur) cur.count++; else m.set(k, { label, count: 1 });
    }
    return [...m.entries()].map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [pendentes, rota]);

  const fila = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return pendentes.filter((e) => {
      if (rota.includes(e.id)) return false;
      if (bairrosSel.length > 0 && !bairrosSel.includes(keyBairro(e.endBairro))) return false;
      if (q && !(`#${e.numero} ${e.destinatarioNome} ${e.endLogradouro} ${e.endBairro ?? ''}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [pendentes, rota, bairrosSel, busca]);

  // Rota já está na ordem sugerida? (mesma sequência) → botão "otimizado".
  const rotaOtimizada = useMemo(
    () => !!ultimaSugestao && ultimaSugestao.length === rota.length && ultimaSugestao.every((x, i) => x === rota[i]),
    [ultimaSugestao, rota],
  );

  // Paradas do mapa, na ordem atual da rota. Entrega adicionada DEPOIS da última
  // sugestão ainda não tem coordenada — fica fora do mapa e é contada no rodapé.
  const paradasMapa = useMemo(
    () =>
      rota.flatMap((id) => {
        const c = coordenadas[id];
        const e = porId.get(id);
        if (!c || !e) return [];
        return [{ id, rotulo: `#${e.numero} · ${e.destinatarioNome}`, lat: c.lat, lng: c.lng, precisao: precisao[id] }];
      }),
    [rota, coordenadas, porId, precisao],
  );
  const semPosicaoNoMapa = rota.length - paradasMapa.length;

  const volumesRota = useMemo(
    () => rota.reduce((s, id) => s + (porId.get(id)?.quantidadeVolumes ?? 0), 0),
    [rota, porId],
  );

  function adicionar(id: string) { setRota((p) => (p.includes(id) ? p : [...p, id])); }
  function adicionarTodasVisiveis() { setRota((p) => [...p, ...fila.map((e) => e.id)]); }
  function remover(id: string) { setRota((p) => p.filter((x) => x !== id)); }
  function mover(id: string, dir: -1 | 1) {
    setRota((p) => {
      const i = p.indexOf(id); const j = i + dir;
      if (i < 0 || j < 0 || j >= p.length) return p;
      const n = [...p]; [n[i], n[j]] = [n[j], n[i]]; return n;
    });
  }

  async function sugerirOrdem() {
    setSugerindo(true);
    try {
      const { data } = await logisticaApi.post<{
        ordem: string[]; semCoordenada: string[]; geocodificadas: number; distanciaKm: number | null; fonteDistancia?: 'OSRM' | 'HAVERSINE';
        precisao?: Record<string, Precisao>; origemRota?: OrigemRota; origemPrecisao?: Precisao | null; aproximadas?: number;
        coordenadas?: Record<string, { lat: number; lng: number }>; origem?: { lat: number; lng: number } | null;
      }>('/viagens/sugerir-ordem', { filialId, entregaIds: rota });
      setRota(data.ordem);
      setUltimaSugestao(data.ordem);
      setPrecisao(data.precisao ?? {});
      setCoordenadas(data.coordenadas ?? {});
      setOrigemCoord(data.origem ?? null);
      setDiag({
        origemRota: data.origemRota ?? null,
        origemPrecisao: data.origemPrecisao ?? null,
        aproximadas: data.aproximadas ?? 0,
      });
      const aviso = data.semCoordenada.length
        ? ` ${data.semCoordenada.length} sem localização foram pro fim — posicione com as setas.`
        : '';
      const via = data.fonteDistancia === 'OSRM' ? ' por rua' : data.distanciaKm != null ? ' em linha reta' : '';
      toast('success', `Ordem sugerida pela distância (${data.geocodificadas} localizadas${data.distanciaKm != null ? `, ~${data.distanciaKm} km${via}` : ''}).${aviso}`);
    } catch (err) {
      const m = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      toast('error', Array.isArray(m) ? m.join(', ') : m || 'Falha ao sugerir a ordem.');
    } finally { setSugerindo(false); }
  }

  /** Operador arrastou o pin: grava a coordenada certa e reflete na hora. */
  async function corrigirLocal(id: string, lat: number, lng: number) {
    try {
      const { data } = await logisticaApi.post<{ lat: number; lng: number; precisao: Precisao; herdam: number }>(
        '/viagens/corrigir-local', { filialId, entregaId: id, lat, lng },
      );
      setCoordenadas((c) => ({ ...c, [id]: { lat: data.lat, lng: data.lng } }));
      setPrecisao((p) => ({ ...p, [id]: data.precisao }));
      // A ordem sugerida foi calculada com o ponto ANTIGO — deixa de valer.
      setUltimaSugestao(null);
      const e = porId.get(id);
      toast('success',
        `Local de ${e?.destinatarioNome ?? 'entrega'} corrigido.` +
        (data.herdam > 0 ? ` ${data.herdam} outra(s) entrega(s) no mesmo endereço herdam a correção.` : '') +
        ' Use "Sugerir melhor rota" para recalcular a ordem.');
    } catch (err) {
      const m = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      toast('error', Array.isArray(m) ? m.join(', ') : m || 'Falha ao corrigir o local.');
    }
  }

  /** Desfaz a correção manual — arraste errado não pode ficar grudado. */
  async function reverterLocal(id: string) {
    try {
      const { data } = await logisticaApi.post<{ lat: number; lng: number; precisao: Precisao } | null>(
        '/viagens/reverter-local', { filialId, entregaId: id },
      );
      if (data) {
        setCoordenadas((c) => ({ ...c, [id]: { lat: data.lat, lng: data.lng } }));
        setPrecisao((p) => ({ ...p, [id]: data.precisao }));
      } else {
        setCoordenadas((c) => { const n = { ...c }; delete n[id]; return n; });
        setPrecisao((p) => { const n = { ...p }; delete n[id]; return n; });
      }
      setUltimaSugestao(null);
      toast('success', 'Correção desfeita — o endereço voltou à localização automática.');
    } catch (err) {
      const m = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      toast('error', Array.isArray(m) ? m.join(', ') : m || 'Falha ao desfazer a correção.');
    }
  }

  async function montar() {
    if (rota.length === 0) { toast('warning', 'Adicione ao menos uma entrega à rota.'); return; }
    setMontando(true);
    try {
      const { data } = await logisticaApi.post<{ id: string; numero: number }>('/viagens', {
        filialId,
        veiculoId: veiculoId || undefined,
        motoristaId: motoristaId || undefined,
        entregaIds: rota,
      });
      setSalvou(true);
      // Leva o estado "otimizada" pro detalhe — se salvou com a rota já sugerida,
      // lá o botão "Sugerir melhor rota" já nasce desabilitado.
      navigate(`/viagens/${data.id}`, { state: { otimizada: rotaOtimizada } });
    } catch (err) {
      const m = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      toast('error', Array.isArray(m) ? m.join(', ') : m || 'Falha ao montar rota.');
      setMontando(false);
    }
  }

  const sel = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-capul-500 focus:outline-none';
  const lbl = 'block text-xs font-medium text-slate-500';

  return (
    <div className="space-y-4">
      {DirtyDialog}
      <Link to="/viagens" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Voltar para Rotas de Entrega
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Montar rota</h2>
          <p className="text-sm text-slate-500">Adicione as entregas à rota, ordene (sugestão ou manual) e escolha quem leva.</p>
        </div>
        {ehGestor && (
          <button
            onClick={() => void recalcularLocalizacoes()}
            disabled={regeo}
            title="Recalcula a posição das entregas no mapa a partir do endereço (rua → bairro → município)"
            className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            {regeo ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
            {regeo ? 'Recalculando…' : 'Recalcular localizações'}
          </button>
        )}
      </div>

      {/* Veículo e motorista no TOPO (pedido 12/06 — com rota longa o card de
          baixo afundava; aqui fica sempre visível, igual ao detalhe). */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
        <p className="mb-3 text-xs text-slate-500">Veículo e motorista são <strong>opcionais agora</strong> — a rota salva em preparação e você define depois; o <strong>despacho</strong> exige os dois.</p>
        <div className="grid grid-cols-2 items-end gap-3 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <label className={lbl}>Veículo (disponível)</label>
            <select value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)} className={sel}>
              <option value="">—</option>
              {veiculos.map((v) => <option key={v.id} value={v.id}>{v.placa} {v.modelo ? `· ${v.modelo}` : ''}</option>)}
            </select>
          </div>
          <div className="lg:col-span-4">
            <label className={lbl}>Motorista</label>
            <select value={motoristaId} onChange={(e) => setMotoristaId(e.target.value)} className={sel}>
              <option value="">—</option>
              {motoristas.map((u) => <option key={u.id} value={u.id}>{labelCore(u)}</option>)}
            </select>
          </div>
          <div className="flex gap-2 lg:col-span-4">
            <button onClick={() => guardedNavigate('/viagens')} type="button"
              title="Desistir da montagem — nada é salvo"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
              Cancelar
            </button>
            <button onClick={() => void montar()} disabled={montando || rota.length === 0}
              title={rota.length === 0 ? 'Monte a rota primeiro' : undefined}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-capul-600 px-4 py-2 text-sm font-medium text-white hover:bg-capul-700 disabled:opacity-50">
              {montando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
              Salvar montagem ({rota.length} {rota.length === 1 ? 'entrega' : 'entregas'} · {volumesRota} vol)
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Fila de pendentes */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
            <span>Fila de pendentes ({fila.length})</span>
            {fila.length > 0 && (
              <button onClick={adicionarTodasVisiveis} className="text-xs font-medium text-capul-700 hover:underline">
                + Adicionar {bairrosSel.length > 0 || busca ? 'as filtradas' : 'todas'} ({fila.length})
              </button>
            )}
          </div>
          <div className="space-y-2 border-b border-slate-100 px-4 py-2.5">
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, rua, bairro ou nº…"
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-capul-500 focus:outline-none" />
            {bairros.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setBairrosSel([])}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${bairrosSel.length === 0 ? 'bg-capul-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  Todos
                </button>
                {bairros.map((b) => (
                  <button key={b.key} onClick={() => setBairrosSel((p) => (p.includes(b.key) ? p.filter((x) => x !== b.key) : [...p, b.key]))}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${bairrosSel.includes(b.key) ? 'bg-capul-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    {b.label} ({b.count})
                  </button>
                ))}
              </div>
            )}
          </div>
          {loading ? (
            <div className="p-6 text-sm text-slate-500"><Loader2 className="inline h-4 w-4 animate-spin" /> Carregando…</div>
          ) : fila.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">{pendentes.length === 0 ? 'Nenhuma entrega pendente.' : 'Tudo que casa com o filtro já está na rota.'}</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {fila.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-50">
                  <button onClick={() => adicionar(e.id)} title="Adicionar à rota"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-capul-500 text-capul-600 hover:bg-capul-50">
                    <Plus className="h-4 w-4" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-700">
                      #{e.numero} · {e.destinatarioNome}
                      {(e.tentativas ?? 1) > 1 && <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">♻ {e.tentativas}ª</span>}
                      {e.geocodificavel === false && (
                        <span className="ml-1.5 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700"
                          title="Endereço não localizado no mapa — não entra no cálculo automático; posicione manualmente na rota">⚠</span>
                      )}
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {e.endLogradouro}{e.endNumero ? `, ${e.endNumero}` : ''} — {(e.endBairro ?? '').trim() || 'sem bairro'} · {e.quantidadeVolumes} vol
                      {e.horario ? ` · prefere ${e.horario}` : ''}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Rota em construção */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
              <span>Sequência de paradas ({rota.length} {rota.length === 1 ? 'entrega' : 'entregas'} · {volumesRota} vol)</span>
              <button onClick={() => void sugerirOrdem()} disabled={sugerindo || rota.length < 2 || rotaOtimizada}
                title={rota.length < 2 ? 'Adicione ao menos 2 entregas' : rotaOtimizada ? 'Rota já otimizada — mude a composição/ordem para recalcular' : 'Calcula o melhor percurso a partir da filial'}
                className="inline-flex items-center gap-1.5 rounded-lg bg-capul-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-capul-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                {sugerindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {sugerindo ? 'Calculando…' : rotaOtimizada ? '✓ Rota otimizada' : 'Sugerir melhor rota'}
              </button>
            </div>
            {diag && (
              <div className="space-y-1.5 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5 text-xs">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  {diag.origemRota === 'FILIAL' ? (
                    <span>
                      Partida: <strong className="text-slate-700">endereço da filial</strong>
                      {diag.origemPrecisao && PRECISAO_INFO[diag.origemPrecisao].aproximada && (
                        <span className="text-amber-700"> — localizada só pelo {PRECISAO_INFO[diag.origemPrecisao].label}, o que distorce a rota inteira</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-amber-700">
                      Partida: <strong>primeira entrega</strong> — o endereço da filial não foi localizado no mapa, então a rota não saiu da empresa
                    </span>
                  )}
                </div>
                {diag.aproximadas > 0 && (
                  <div className="flex items-start gap-1.5 text-amber-700">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      {diag.aproximadas} {diag.aproximadas === 1 ? 'parada tem localização aproximada' : 'paradas têm localização aproximada'} e
                      {diag.aproximadas === 1 ? ' pode' : ' podem'} sair fora de ordem — confira as marcadas abaixo e ajuste com as setas.
                    </span>
                  </div>
                )}
              </div>
            )}
            {rota.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">Adicione entregas da fila ao lado — a ordem daqui vira a sequência das paradas.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {rota.map((id, i) => {
                  const e = porId.get(id);
                  if (!e) return null;
                  const p = precisao[id];
                  const info = p ? PRECISAO_INFO[p] : null;
                  return (
                    <li key={id}
                      className={`flex items-center gap-2 px-4 py-2 text-sm ${selecionada === id ? 'bg-capul-50 ring-1 ring-inset ring-capul-300' : info?.aproximada ? 'bg-amber-50/60' : ''}`}>
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-capul-600 text-xs font-semibold text-white">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-slate-700">
                          #{e.numero} · {e.destinatarioNome}
                          {e.geocodificavel === false && (
                            <span className="ml-1.5 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700"
                              title="Sem localização no mapa — posicione manualmente">⚠</span>
                          )}
                          {info?.aproximada && (
                            <span className="ml-1.5 inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700"
                              title="O endereço exato não foi encontrado no mapa. A rota usou uma posição aproximada, então esta parada pode estar fora de ordem. Arraste o pin no mapa para corrigir.">
                              <AlertTriangle className="h-2.5 w-2.5" /> {info.label}
                            </span>
                          )}
                          {p === 'MANUAL' && (
                            <span className="ml-1.5 inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700"
                              title="Alguém arrastou o pin para o lugar certo. Vale também para as próximas entregas neste endereço.">
                              <MapPin className="h-2.5 w-2.5" /> corrigida
                              <button onClick={() => void reverterLocal(id)} title="Desfazer a correção manual"
                                className="ml-0.5 rounded px-0.5 text-emerald-600 hover:bg-emerald-200 hover:text-emerald-900">desfazer</button>
                            </span>
                          )}
                        </div>
                        <div className="truncate text-xs text-slate-500">
                          {e.endLogradouro}{e.endNumero ? `, ${e.endNumero}` : ''} — {(e.endBairro ?? '').trim() || 'sem bairro'} · {e.quantidadeVolumes} vol
                          {info && !info.aproximada && <span className="ml-1.5 text-slate-400">· localizada {info.label}</span>}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button onClick={() => mover(id, -1)} disabled={i === 0} title="Subir"
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-capul-700 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                        <button onClick={() => mover(id, 1)} disabled={i === rota.length - 1} title="Descer"
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-capul-700 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                        <button onClick={() => remover(id)} title="Tirar da rota"
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-600"><X className="h-4 w-4" /></button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {paradasMapa.length > 0 && (
            <MapaRota
              paradas={paradasMapa}
              origem={origemCoord}
              semPosicao={semPosicaoNoMapa}
              onSelecionar={setSelecionada}
              onCorrigir={(id, lat, lng) => void corrigirLocal(id, lat, lng)}
            />
          )}

        </div>
      </div>
    </div>
  );
}
