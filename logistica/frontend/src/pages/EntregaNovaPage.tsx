import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Loader2, Plus, Trash2, Package, X, Search, MapPin } from 'lucide-react';
import { logisticaApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { maskTelefone, maskCep, onlyDigits, UFS } from '../utils/format';

type TipoCliente = 'IDENTIFICADO' | 'RECORRENTE_LOCAL' | 'EVENTUAL';

interface Cupom { numeroCupom: string; valor: string }
interface EntregaItem {
  id: string;
  numero: number;
  destinatarioNome: string;
  endLogradouro: string;
  endNumero?: string | null;
  endBairro?: string | null;
  quantidadeVolumes: number;
  totalCupons: number;
}

// Busca unificada (GET /cadastro/busca) — fontes locais.
interface EnderecoBusca {
  id: string; apelido?: string | null; logradouro: string; numero?: string | null; complemento?: string | null;
  bairro?: string | null; cidade?: string | null; uf?: string | null; cep?: string | null;
  pontoReferencia?: string | null;
}
interface ClienteBusca { id: string; nome: string; telefone?: string | null; enderecos: EnderecoBusca[] }
interface HistoricoBusca {
  destinatarioNome: string; telefone?: string | null;
  endLogradouro?: string | null; endNumero?: string | null; endBairro?: string | null; endCidade?: string | null;
}
interface ClienteProtheus {
  matricula: string; nome: string; cpfCnpj: string | null; telefone: string | null;
  enderecos: { logradouro: string; bairro: string | null; cidade: string | null; uf: string | null; cep: string | null; rotulo: string }[];
}
/** Candidato de endereço apresentado no seletor (de qualquer fonte). */
interface EnderecoSug {
  rotulo: string;
  logradouro: string; numero?: string | null; complemento?: string | null;
  bairro?: string | null; cidade?: string | null; uf?: string | null; cep?: string | null; referencia?: string | null;
  enderecoEntregaId?: string; // quando vem de um EnderecoEntrega salvo (linka o snapshot)
}
interface BuscaResp {
  clientesLocais: ClienteBusca[];
  enderecosPorMatricula?: EnderecoBusca[]; // EnderecoEntrega salvos por matrícula
  historicoEntregas: HistoricoBusca[];
  protheus?: { cliente: ClienteProtheus | null };
}

const TIPOS: { v: TipoCliente; label: string }[] = [
  { v: 'IDENTIFICADO', label: 'Com matrícula' },
  { v: 'RECORRENTE_LOCAL', label: 'Recorrente (local)' },
  { v: 'EVENTUAL', label: 'Eventual' },
];

export function EntregaNovaPage() {
  const { usuario } = useAuth();
  const filialId = usuario?.filialAtual?.id ?? usuario?.filiais?.[0]?.id ?? '';

  const [tipoCliente, setTipoCliente] = useState<TipoCliente>('IDENTIFICADO');
  const [matricula, setMatricula] = useState('');
  const [destinatarioNome, setDestinatarioNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('Unaí');
  const [uf, setUf] = useState('MG');
  const [cep, setCep] = useState('');
  const [referencia, setReferencia] = useState('');
  const [volumes, setVolumes] = useState(1);
  const [observacoes, setObservacoes] = useState('');
  const [cupons, setCupons] = useState<Cupom[]>([{ numeroCupom: '', valor: '' }]);
  // Quando o endereço veio de um cadastro existente, guardamos a referência
  // (snapshot tirado dela no backend). Editar qualquer campo de endereço limpa.
  const [enderecoEntregaId, setEnderecoEntregaId] = useState('');
  const [clienteLocalId, setClienteLocalId] = useState('');
  // Seletor de endereços do cliente identificado (Protheus/local podem ter +1).
  // O operador escolhe um OU clica "Novo endereço" (idx -1 = digitação manual).
  const [enderecosSugeridos, setEnderecosSugeridos] = useState<EnderecoSug[]>([]);
  const [enderecoSelIdx, setEnderecoSelIdx] = useState(-1);

  // Busca por telefone (autofill)
  const [sugestoes, setSugestoes] = useState<BuscaResp | null>(null);
  const [mostrarSug, setMostrarSug] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [buscandoMat, setBuscandoMat] = useState(false);
  const [msgMat, setMsgMat] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [pendentes, setPendentes] = useState<EntregaItem[]>([]);
  const ultimoCupomRef = useRef<HTMLInputElement>(null);
  const matriculaRef = useRef<HTMLInputElement>(null);
  // Quando o telefone é preenchido por autofill, pula a próxima busca/dropdown.
  const pularBuscaTelRef = useRef(false);

  // Ao carregar a página, foca o primeiro campo (matrícula) — pronto pra digitar.
  useEffect(() => { matriculaRef.current?.focus(); }, []);

  const totalCupons = cupons.reduce((acc, c) => acc + (parseFloat(c.valor) || 0), 0);
  const identificado = tipoCliente === 'IDENTIFICADO';

  async function carregarPendentes() {
    try {
      const { data } = await logisticaApi.get<EntregaItem[]>('/entregas', {
        params: filialId ? { filialId } : undefined,
      });
      setPendentes(data);
    } catch { /* lista vazia em caso de erro */ }
  }
  useEffect(() => { void carregarPendentes(); }, [filialId]);

  // Busca por telefone (debounce 400ms; só com >= 4 dígitos). NÃO roda na aba
  // "Com matrícula" (lá o telefone vem do Protheus), nem quando o telefone foi
  // preenchido por autofill (evita reabrir o dropdown por cima do form).
  useEffect(() => {
    if (identificado) { setSugestoes(null); setMostrarSug(false); return; }
    if (pularBuscaTelRef.current) { pularBuscaTelRef.current = false; return; }
    const digits = onlyDigits(telefone);
    if (digits.length < 4) { setSugestoes(null); setMostrarSug(false); return; }
    setBuscando(true);
    const t = setTimeout(async () => {
      try {
        const { data } = await logisticaApi.get<BuscaResp>('/cadastro/busca', { params: { termo: digits } });
        const temAlgo = data.clientesLocais.length > 0 || data.historicoEntregas.length > 0;
        setSugestoes(data);
        setMostrarSug(temAlgo);
      } catch { setSugestoes(null); }
      finally { setBuscando(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [telefone, identificado]);

  // Setter de campo de endereço que desfaz o vínculo com cadastro (o operador
  // está editando à mão → snapshot passa a ser o que está na tela) e marca o
  // seletor como "novo/manual".
  function editEndereco<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setEnderecoEntregaId(''); setEnderecoSelIdx(-1); };
  }

  // Normaliza endereço pra dedupe (APTO/AP + sem pontuação/espaços).
  const normEnd = (l?: string | null, ci?: string | null) =>
    `${l ?? ''} ${ci ?? ''}`.toUpperCase().replace(/APARTAMENTO|APTO/g, 'AP').replace(/[^A-Z0-9]/g, '');

  // Agrega endereços de TODAS as fontes da busca (Protheus, salvos por matrícula,
  // endereços de clientes locais, histórico), deduplicado. Espinha dorsal do
  // seletor de cards — usado igual nas 3 abas.
  function coletarEnderecos(data: BuscaResp): EnderecoSug[] {
    const sug: EnderecoSug[] = [];
    const c = data.protheus?.cliente;
    if (c) sug.push(...c.enderecos.map((e) => ({ rotulo: e.rotulo, logradouro: e.logradouro, bairro: e.bairro, cidade: e.cidade, uf: e.uf, cep: e.cep })));
    for (const e of data.enderecosPorMatricula ?? [])
      sug.push({ rotulo: e.apelido || 'Salvo', logradouro: e.logradouro, numero: e.numero, complemento: e.complemento, bairro: e.bairro, cidade: e.cidade, uf: e.uf, cep: e.cep, referencia: e.pontoReferencia, enderecoEntregaId: e.id });
    for (const cl of data.clientesLocais)
      for (const e of cl.enderecos ?? [])
        sug.push({ rotulo: e.apelido || 'Cadastro', logradouro: e.logradouro, numero: e.numero, complemento: e.complemento, bairro: e.bairro, cidade: e.cidade, uf: e.uf, cep: e.cep, referencia: e.pontoReferencia, enderecoEntregaId: e.id });
    for (const h of data.historicoEntregas)
      sug.push({ rotulo: 'Histórico', logradouro: h.endLogradouro ?? '', numero: h.endNumero, bairro: h.endBairro, cidade: h.endCidade });
    const vistos = new Set<string>();
    return sug.filter((s) => { if (!s.logradouro) return false; const k = normEnd(s.logradouro, s.cidade); if (vistos.has(k)) return false; vistos.add(k); return true; });
  }

  // Escolheu uma sugestão no dropdown de telefone (recorrente/eventual) → mostra
  // os MESMOS cards de endereço da aba "Com matrícula" (padrão único nas 3 abas).
  function aplicarSugestaoTelefone(nome: string, telefone: string | null | undefined, clienteLocalId: string, alvo?: EnderecoSug) {
    pularBuscaTelRef.current = true;
    setDestinatarioNome(nome);
    if (telefone) setTelefone(maskTelefone(telefone));
    setClienteLocalId(clienteLocalId);
    const cards = sugestoes ? coletarEnderecos(sugestoes) : [];
    setEnderecosSugeridos(cards);
    let idx = 0;
    if (alvo) { const k = normEnd(alvo.logradouro, alvo.cidade); const f = cards.findIndex((s) => normEnd(s.logradouro, s.cidade) === k); if (f >= 0) idx = f; }
    if (cards.length > 0) aplicarEndereco(cards[idx], idx);
    else enderecoNovo();
    setMostrarSug(false);
  }

  function aplicarCliente(c: ClienteBusca, end?: EnderecoBusca) {
    setTipoCliente('RECORRENTE_LOCAL');
    aplicarSugestaoTelefone(c.nome, c.telefone, c.id, end ? { rotulo: '', logradouro: end.logradouro, cidade: end.cidade } : undefined);
  }

  function aplicarHistorico(h: HistoricoBusca) {
    aplicarSugestaoTelefone(h.destinatarioNome, h.telefone, '', { rotulo: 'Histórico', logradouro: h.endLogradouro ?? '', cidade: h.endCidade });
  }

  /** Preenche os campos de endereço a partir de um candidato escolhido no seletor. */
  function aplicarEndereco(e: EnderecoSug, idx: number) {
    setEnderecoSelIdx(idx);
    setEnderecoEntregaId(e.enderecoEntregaId ?? '');
    setLogradouro(e.logradouro ?? '');
    setNumero(e.numero ?? '');
    setComplemento(e.complemento ?? '');
    setBairro(e.bairro ?? '');
    setCidade(e.cidade ?? 'Unaí');
    setUf((e.uf ?? 'MG').toUpperCase());
    setCep(e.cep ? maskCep(e.cep) : '');
    setReferencia(e.referencia ?? '');
  }

  /** "Novo endereço": limpa os campos pra digitação manual (não desfaz o cliente). */
  function enderecoNovo() {
    setEnderecoSelIdx(-1);
    setEnderecoEntregaId('');
    setLogradouro(''); setNumero(''); setComplemento(''); setBairro('');
    setCidade('Unaí'); setUf('MG'); setCep(''); setReferencia('');
  }

  // Cliente identificado: matrícula (E#####). Monta o seletor agregando TODAS
  // as fontes do cliente: Protheus + endereços já salvos pra essa matrícula +
  // histórico de entregas (assim um "novo endereço" usado antes reaparece).
  function montarSeletorMatricula(data: BuscaResp, mat: string) {
    const c = data.protheus?.cliente;
    const cards = coletarEnderecos(data);
    const nome = c?.nome ?? data.historicoEntregas[0]?.destinatarioNome ?? '';
    const tel = c?.telefone ?? data.historicoEntregas.find((h) => h.telefone)?.telefone ?? null;
    if (nome) setDestinatarioNome(nome);
    if (tel) { pularBuscaTelRef.current = true; setTelefone(maskTelefone(tel)); }
    setClienteLocalId('');
    setMatricula(c?.matricula ?? mat);
    setEnderecosSugeridos(cards);
    if (cards.length > 0) aplicarEndereco(cards[0], 0);
    else enderecoNovo();
    return { achou: !!c || cards.length > 0 || !!nome, viaProtheus: !!c };
  }

  async function buscarPorMatricula() {
    const mat = matricula.trim().toUpperCase();
    setMsgMat(null);
    if (!/^E\d{1,14}$/.test(mat)) return; // formato do balcão: E#####
    setBuscandoMat(true);
    try {
      const { data } = await logisticaApi.get<BuscaResp>('/cadastro/busca', { params: { termo: mat } });
      const r = montarSeletorMatricula(data, mat);
      if (r.achou) {
        setMsgMat({ tipo: 'ok', texto: r.viaProtheus ? 'Cliente encontrado no Protheus — escolha o endereço ou adicione um novo.' : 'Cliente encontrado nos cadastros locais.' });
      } else {
        setMsgMat({ tipo: 'erro', texto: 'Matrícula não encontrada. Preencha manualmente.' });
      }
    } catch {
      setMsgMat({ tipo: 'erro', texto: 'Protheus indisponível. Preencha manualmente.' });
    } finally {
      setBuscandoMat(false);
    }
  }

  function resetForm() {
    setMatricula(''); setDestinatarioNome(''); setTelefone('');
    setLogradouro(''); setNumero(''); setComplemento(''); setBairro('');
    setCidade('Unaí'); setUf('MG'); setCep(''); setReferencia('');
    setVolumes(1); setObservacoes(''); setCupons([{ numeroCupom: '', valor: '' }]);
    setEnderecoEntregaId(''); setClienteLocalId(''); setSugestoes(null); setMostrarSug(false);
    setEnderecosSugeridos([]); setEnderecoSelIdx(-1); setMsgMat(null);
  }

  // Bloqueia Enter de submeter o form acidentalmente — só o botão Registrar grava.
  function bloquearEnterSubmit(e: KeyboardEvent<HTMLFormElement>) {
    const alvo = e.target as HTMLElement;
    if (e.key === 'Enter' && alvo.tagName !== 'TEXTAREA') e.preventDefault();
  }

  function addCupom() {
    setCupons((p) => [...p, { numeroCupom: '', valor: '' }]);
    // foca o nº do novo cupom no próximo tick
    setTimeout(() => ultimoCupomRef.current?.focus(), 0);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!filialId) { setMsg({ tipo: 'erro', texto: 'Sem filial no perfil — selecione uma filial no Hub.' }); return; }
    setSalvando(true);
    try {
      const { data } = await logisticaApi.post('/entregas', {
        filialId,
        tipoCliente,
        matricula: tipoCliente === 'IDENTIFICADO' ? matricula || undefined : undefined,
        clienteLocalId: clienteLocalId || undefined,
        destinatarioNome,
        telefone: telefone ? onlyDigits(telefone) : undefined,
        enderecoEntregaId: enderecoEntregaId || undefined,
        endLogradouro: logradouro,
        endNumero: numero || undefined,
        endComplemento: complemento || undefined,
        endBairro: bairro || undefined,
        endCidade: cidade || undefined,
        endUf: uf || undefined,
        endCep: cep ? onlyDigits(cep) : undefined,
        endReferencia: referencia || undefined,
        quantidadeVolumes: volumes,
        observacoes: observacoes || undefined,
        cupons: cupons
          .filter((c) => c.numeroCupom || c.valor)
          .map((c) => ({ numeroCupom: c.numeroCupom || undefined, valor: c.valor ? parseFloat(c.valor) : undefined })),
      });
      setMsg({ tipo: 'ok', texto: `Entrega nº ${data.numero} registrada.` });
      resetForm();
      void carregarPendentes();
    } catch {
      setMsg({ tipo: 'erro', texto: 'Falha ao registrar entrega.' });
    } finally {
      setSalvando(false);
    }
  }

  async function cancelar(id: string) {
    setMsg(null);
    try {
      await logisticaApi.post(`/entregas/${id}/cancelar`, { motivo: 'Cancelada no balcão' });
      void carregarPendentes();
    } catch (err) {
      const m = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setMsg({ tipo: 'erro', texto: Array.isArray(m) ? m.join(', ') : m || 'Falha ao cancelar entrega.' });
    }
  }

  const inp = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none';
  const lbl = 'block text-xs font-medium text-slate-500';

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Formulário */}
      <form onSubmit={submit} onKeyDown={bloquearEnterSubmit} className="lg:col-span-2 space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-800">Nova entrega</h2>

        <div className="flex gap-2">
          {TIPOS.map((t) => (
            <button type="button" key={t.v} onClick={() => { setTipoCliente(t.v); setMsgMat(null); }}
              className={`rounded-lg border px-3 py-1.5 text-sm ${tipoCliente === t.v ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-300 text-slate-600'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Sempre presente (mesma posição/tamanho nas 3 tabs); só ativo em
            "Com matrícula" — evita o layout pular ao trocar de tab. */}
        <div>
          <label className={lbl}>Matrícula do cliente</label>
          <div className="flex items-center gap-2">
            <div className="w-44">
              <input
                ref={matriculaRef}
                value={identificado ? matricula : ''}
                onChange={(e) => setMatricula(e.target.value.toUpperCase())}
                onBlur={buscarPorMatricula}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); buscarPorMatricula(); } }}
                disabled={!identificado}
                placeholder={identificado ? 'E01047' : '—'}
                title={identificado ? '' : "Disponível na opção 'Com matrícula'"}
                className={`${inp} uppercase disabled:bg-slate-100 disabled:text-slate-400`}
              />
            </div>
            {buscandoMat && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
          </div>
          {/* Linha de feedback com altura reservada — não desloca os campos abaixo. */}
          <p className={`mt-1 min-h-[1rem] text-xs ${msgMat?.tipo === 'erro' ? 'text-amber-700' : 'text-emerald-700'}`}>
            {identificado && msgMat ? msgMat.texto : ''}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Nome do cliente *</label>
            <input value={destinatarioNome} onChange={(e) => setDestinatarioNome(e.target.value)} required className={inp} placeholder="Nome de quem recebe" />
          </div>
          <div className="relative">
            <label className={lbl}>Telefone</label>
            <div className="relative">
              <input
                value={telefone}
                onChange={(e) => setTelefone(maskTelefone(e.target.value))}
                onFocus={() => { if (sugestoes) setMostrarSug(true); }}
                onBlur={() => setTimeout(() => setMostrarSug(false), 150)}
                placeholder="(38) 99999-9999"
                inputMode="numeric"
                className={inp}
              />
              <span className="pointer-events-none absolute right-2 top-3 text-slate-400">
                {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </span>
            </div>
            {mostrarSug && sugestoes && (
              <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                <div className="border-b border-slate-100 px-3 py-1.5 text-[11px] font-medium text-slate-400">
                  Clientes/endereços já cadastrados — clique para preencher
                </div>
                {sugestoes.clientesLocais.flatMap((c) =>
                  (c.enderecos.length ? c.enderecos : [undefined]).map((end, i) => (
                    <button type="button" key={`c-${c.id}-${i}`} onMouseDown={(e) => e.preventDefault()}
                      onClick={() => aplicarCliente(c, end)}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-sky-50">
                      <div className="font-medium text-slate-700">{c.nome} {c.telefone ? <span className="text-xs text-slate-400">· {maskTelefone(c.telefone)}</span> : null}</div>
                      {end && <div className="text-xs text-slate-500">{end.logradouro}{end.numero ? `, ${end.numero}` : ''}{end.bairro ? ` — ${end.bairro}` : ''}{end.cidade ? `, ${end.cidade}` : ''}{end.uf ? `/${end.uf}` : ''}</div>}
                    </button>
                  )),
                )}
                {sugestoes.historicoEntregas.map((h, i) => (
                  <button type="button" key={`h-${i}`} onMouseDown={(e) => e.preventDefault()}
                    onClick={() => aplicarHistorico(h)}
                    className="block w-full border-t border-slate-50 px-3 py-2 text-left text-sm hover:bg-sky-50">
                    <div className="font-medium text-slate-700">{h.destinatarioNome} <span className="text-[11px] text-slate-400">(do histórico)</span></div>
                    <div className="text-xs text-slate-500">{h.endLogradouro}{h.endNumero ? `, ${h.endNumero}` : ''}{h.endBairro ? ` — ${h.endBairro}` : ''}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {enderecosSugeridos.length > 0 && (
          <div>
            <label className={lbl}>Endereços do cliente — escolha um ou adicione um novo</label>
            <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {enderecosSugeridos.map((e, i) => (
                <button type="button" key={i} onClick={() => aplicarEndereco(e, i)}
                  className={`rounded-lg border p-3 text-left transition-colors ${enderecoSelIdx === i ? 'border-sky-500 bg-sky-50 ring-1 ring-sky-200' : 'border-slate-300 hover:bg-slate-50'}`}>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{e.rotulo}</span>
                  </div>
                  <div className="mt-0.5 text-sm font-medium text-slate-800">
                    {e.logradouro}{e.numero ? `, ${e.numero}` : ''}{e.complemento ? ` — ${e.complemento}` : ''}
                  </div>
                  <div className="text-xs text-slate-500">
                    {[e.bairro, [e.cidade, e.uf].filter(Boolean).join('/')].filter(Boolean).join(' · ')}{e.cep ? ` · CEP ${maskCep(e.cep)}` : ''}
                  </div>
                </button>
              ))}
              <button type="button" onClick={enderecoNovo}
                className={`flex items-center justify-center gap-1.5 rounded-lg border border-dashed p-3 text-sm font-medium ${enderecoSelIdx === -1 ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-300 text-slate-500 hover:bg-slate-50'}`}>
                <Plus className="h-4 w-4" /> Novo endereço
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-6 gap-3">
          <div className="col-span-4">
            <label className={lbl}>Endereço de Entrega *</label>
            <input value={logradouro} onChange={(e) => editEndereco(setLogradouro)(e.target.value)} required className={inp} placeholder="Rua / Avenida" />
          </div>
          <div className="col-span-2">
            <label className={lbl}>Número</label>
            <input value={numero} onChange={(e) => editEndereco(setNumero)(e.target.value)} className={inp} />
          </div>
          <div className="col-span-3">
            <label className={lbl}>Complemento</label>
            <input value={complemento} onChange={(e) => editEndereco(setComplemento)(e.target.value)} className={inp} placeholder="Apto, bloco, casa…" />
          </div>
          <div className="col-span-3">
            <label className={lbl}>Bairro</label>
            <input value={bairro} onChange={(e) => editEndereco(setBairro)(e.target.value)} className={inp} />
          </div>
          <div className="col-span-3">
            <label className={lbl}>Cidade</label>
            <input value={cidade} onChange={(e) => editEndereco(setCidade)(e.target.value)} className={inp} />
          </div>
          <div className="col-span-1">
            <label className={lbl}>UF</label>
            <select value={uf} onChange={(e) => editEndereco(setUf)(e.target.value)} className={inp}>
              {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className={lbl}>CEP</label>
            <input value={cep} onChange={(e) => editEndereco(setCep)(maskCep(e.target.value))} className={inp} placeholder="00000-000" inputMode="numeric" />
          </div>
        </div>

        <div>
          <label className={lbl}>Ponto de referência</label>
          <input value={referencia} onChange={(e) => setReferencia(e.target.value)} className={inp} placeholder="Perto de…" />
        </div>

        {/* Cupons / Notas */}
        <div>
          <label className={lbl}>Cupons / Notas</label>
          <div className="mt-1 space-y-2">
            {cupons.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-5 text-right text-xs text-slate-400">{i + 1}.</span>
                <input
                  ref={i === cupons.length - 1 ? ultimoCupomRef : undefined}
                  placeholder="Nº cupom / nota"
                  value={c.numeroCupom}
                  inputMode="numeric"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCupom(); } }}
                  onChange={(e) => setCupons((p) => p.map((x, j) => j === i ? { ...x, numeroCupom: e.target.value } : x))}
                  className="w-44 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none" />
                <input
                  placeholder="Valor"
                  type="number" step="0.01" value={c.valor}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCupom(); } }}
                  onChange={(e) => setCupons((p) => p.map((x, j) => j === i ? { ...x, valor: e.target.value } : x))}
                  className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none" />
                <button type="button" onClick={() => setCupons((p) => p.length > 1 ? p.filter((_, j) => j !== i) : [{ numeroCupom: '', valor: '' }])}
                  className="text-slate-400 hover:text-red-600" title="Remover"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <button type="button" onClick={addCupom}
              className="flex items-center gap-1 text-xs font-medium text-sky-700 hover:underline"><Plus className="h-3 w-3" /> Adicionar cupom</button>
            <div className="text-sm text-slate-600">Total: <strong>R$ {totalCupons.toFixed(2)}</strong></div>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Enter adiciona outro cupom; o cadastro só é gravado no botão “Salvar entrega”.</p>
        </div>

        <div className="flex gap-3">
          <div className="w-24">
            <label className={lbl}>Volumes</label>
            <input type="number" min={1} value={volumes} onChange={(e) => setVolumes(Math.max(1, parseInt(e.target.value) || 1))} className={inp} />
          </div>
          <div className="flex-1">
            <label className={lbl}>Observações</label>
            <input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} className={inp} />
          </div>
        </div>

        {msg && (
          <div className={`rounded-lg px-4 py-2 text-sm ${msg.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {msg.texto}
          </div>
        )}

        <button type="submit" disabled={salvando}
          className="flex items-center gap-2 rounded-lg bg-sky-600 px-5 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
          Salvar entrega
        </button>
      </form>

      {/* Pendentes */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Pendentes ({pendentes.length})</h3>
        {pendentes.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma entrega pendente.</p>
        ) : (
          <ul className="space-y-2">
            {pendentes.map((e) => (
              <li key={e.id} className="rounded-lg border border-slate-100 p-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">#{e.numero} · {e.destinatarioNome}</span>
                  <button onClick={() => cancelar(e.id)} className="text-slate-400 hover:text-red-600" title="Cancelar"><X className="h-3.5 w-3.5" /></button>
                </div>
                <div className="text-slate-500">{e.endLogradouro}{e.endNumero ? `, ${e.endNumero}` : ''} — {e.endBairro}</div>
                <div className="text-slate-400">{e.quantidadeVolumes} vol · R$ {e.totalCupons.toFixed(2)}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
