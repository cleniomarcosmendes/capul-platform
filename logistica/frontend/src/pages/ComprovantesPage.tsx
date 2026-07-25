import { useState } from 'react';
import { FileSearch, Loader2, MapPin, X, ImageIcon, PenLine, Phone } from 'lucide-react';
import { logisticaApi } from '../services/api';
import { maskTelefone } from '../utils/format';

interface EntregaBaixada {
  id: string;
  numero: number;
  destinatarioNome: string;
  telefone: string | null;
  matricula: string | null;
  status: 'ENTREGUE' | 'NAO_ENTREGUE';
  dataHoraEntrega: string | null;
  motivoNaoEntrega: string | null;
  temComprovante: boolean;
  comprovanteId: string | null;
  comprovanteTipo?: 'FOTO' | 'ASSINATURA' | null;
  // TODAS as provas da baixa. `comprovanteId` guarda só a primária (a foto,
  // quando há foto e assinatura) — sem esta lista a assinatura ficava sem como
  // ser aberta por esta tela.
  provas?: { id: string; tipo: 'FOTO' | 'ASSINATURA' }[];
  // Fonte primária de quem recebeu (a trilha do cofre é a reserva — nas provas
  // antigas/do app ela nem sempre traz o nome).
  recebedorNome?: string | null;
}

interface ProvaAberta {
  id: string;
  url: string;
  meta: ComprovanteMeta;
}

interface ComprovanteMeta {
  id: string;
  entregaNumero: number | null;
  tipo?: 'FOTO' | 'ASSINATURA';
  hash: string;
  geoLat: string | null;
  geoLng: string | null;
  trilha?: { recebedorNome?: string | null } | null;
}

const PROVA_LABEL: Record<string, string> = { FOTO: 'Foto', ASSINATURA: 'Assinatura' };

/**
 * Consulta de comprovante de entrega (Fase 1b — financeiro/cobrança). A prova
 * lastreia a venda a prazo. A busca espelha a da Nova Entrega: um termo livre
 * casa nome/telefone/matrícula e lista as entregas baixadas; cupom e nº de
 * entrega são filtros adicionais. Read-only (o cofre é append-only).
 */
export function ComprovantesPage() {
  const [termo, setTermo] = useState('');
  const [cupom, setCupom] = useState('');
  const [numero, setNumero] = useState('');
  const [itens, setItens] = useState<EntregaBaixada[]>([]);
  const [loading, setLoading] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [imagem, setImagem] = useState<{ provas: ProvaAberta[]; ativa: number; entrega: EntregaBaixada } | null>(null);
  const [imgBusy, setImgBusy] = useState<string | null>(null);
  const [reabrindo, setReabrindo] = useState<string | null>(null);

  // Re-entrega (cliente ausente etc.): volta a entrega pra fila de pendentes —
  // será montada numa nova viagem com rota recalculada.
  async function novaTentativa(e: EntregaBaixada) {
    setErro(null);
    setReabrindo(e.id);
    try {
      await logisticaApi.post(`/entregas/${e.id}/nova-tentativa`, {});
      setItens((p) => p.filter((x) => x.id !== e.id));
    } catch (err) {
      const m = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setErro(Array.isArray(m) ? m.join(', ') : m || 'Falha ao reabrir a entrega.');
    } finally { setReabrindo(null); }
  }

  async function buscar() {
    setErro(null); setLoading(true); setBuscou(true);
    try {
      const params: Record<string, string> = {};
      if (termo.trim()) params.termo = termo.trim();
      if (cupom.trim()) params.cupom = cupom.trim();
      if (numero.trim()) params.numero = numero.trim();
      const { data } = await logisticaApi.get<EntregaBaixada[]>('/entregas/baixadas', { params });
      setItens(data);
    } catch (err) {
      const m = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setErro(m || 'Falha na consulta.');
    } finally { setLoading(false); }
  }

  /** Fecha o modal soltando os blobs (senão cada abertura vaza memória). */
  function fecharImagem() {
    setImagem((atual) => {
      atual?.provas.forEach((p) => URL.revokeObjectURL(p.url));
      return null;
    });
  }

  // Abre TODAS as provas da baixa: metadados (GPS/hash/recebedor) + binário
  // (blob autenticado). Foto e assinatura convivem — o modal alterna entre elas.
  async function verProva(e: EntregaBaixada) {
    const ids = e.provas?.length ? e.provas.map((p) => p.id) : e.comprovanteId ? [e.comprovanteId] : [];
    if (!ids.length) return;
    setImgBusy(e.id);
    try {
      const provas = await Promise.all(
        ids.map(async (id) => {
          const [meta, bin] = await Promise.all([
            logisticaApi.get<ComprovanteMeta>(`/comprovantes/${id}`),
            logisticaApi.get(`/comprovantes/${id}/arquivo`, { responseType: 'blob' }),
          ]);
          return { id, url: URL.createObjectURL(bin.data as Blob), meta: meta.data };
        }),
      );
      // Abre na primária (a que a lista badgeia); as demais ficam nas abas.
      const inicial = Math.max(0, provas.findIndex((p) => p.id === e.comprovanteId));
      setImagem({ provas, ativa: inicial, entrega: e });
    } catch (err) {
      // Distinguir o motivo: um 403 genérico ("não foi possível") escondeu por
      // um bom tempo que o problema era permissão, não a prova.
      const st = (err as { response?: { status?: number } }).response?.status;
      setErro(
        st === 403 ? 'Sem permissão para abrir o comprovante — fale com o gestor.'
        : st === 404 ? 'A prova não foi encontrada no cofre.'
        : 'Não foi possível abrir a prova. Tente de novo em instantes.',
      );
    } finally { setImgBusy(null); }
  }

  const inp = 'mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-capul-500 focus:outline-none';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Comprovantes de entrega</h2>
        <p className="text-sm text-slate-500">Localize a prova (lastro da cobrança a prazo) por nome, telefone ou matrícula — ou por cupom e nº de entrega.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white shadow-sm p-4">
        <div className="flex-1 min-w-[220px]"><label className="block text-xs font-medium text-slate-500">Nome, telefone ou matrícula</label>
          <input value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="ex: Maria · 38999… · E01047" className={`${inp} w-full`} onKeyDown={(e) => e.key === 'Enter' && buscar()} /></div>
        <div><label className="block text-xs font-medium text-slate-500">Cupom</label>
          <input value={cupom} onChange={(e) => setCupom(e.target.value)} placeholder="nº do cupom" className={`${inp} w-36`} onKeyDown={(e) => e.key === 'Enter' && buscar()} /></div>
        <div><label className="block text-xs font-medium text-slate-500">Nº da entrega</label>
          <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="ex: 41" className={`${inp} w-28`} onKeyDown={(e) => e.key === 'Enter' && buscar()} /></div>
        <button onClick={buscar} disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-capul-600 px-4 py-2 text-sm font-medium text-white hover:bg-capul-700 disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />} Buscar
        </button>
      </div>

      {erro && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{erro}</div>}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? <div className="p-6 text-sm text-slate-500"><Loader2 className="inline h-4 w-4 animate-spin" /> Buscando…</div>
          : !buscou ? <div className="p-6 text-sm text-slate-500">Informe um filtro e clique em Buscar.</div>
          : itens.length === 0 ? <div className="p-6 text-sm text-slate-500">Nenhuma entrega baixada encontrada.</div>
          : <table className="w-full text-sm">
              <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr><th className="px-4 py-2">Entrega</th><th className="px-4 py-2">Destinatário</th><th className="px-4 py-2">Matrícula</th><th className="px-4 py-2">Situação</th><th className="px-4 py-2">Baixado</th><th className="px-4 py-2"></th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {itens.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium text-slate-700">#{e.numero}</td>
                    <td className="px-4 py-2 text-slate-600">
                      <div>{e.destinatarioNome}</div>
                      {e.telefone && <a href={`tel:${e.telefone}`} className="inline-flex items-center gap-1 text-xs text-capul-700 hover:underline"><Phone className="h-3 w-3" /> {maskTelefone(e.telefone)}</a>}
                    </td>
                    <td className="px-4 py-2 text-slate-600">{e.matricula ?? '—'}</td>
                    <td className="px-4 py-2">
                      {e.status === 'ENTREGUE'
                        ? <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700">✓ Entregue</span>
                        : <span className="rounded bg-rose-100 px-1.5 py-0.5 text-xs font-medium text-rose-700" title={e.motivoNaoEntrega ?? ''}>✗ Não entregue</span>}
                    </td>
                    <td className="px-4 py-2 text-slate-600">{e.dataHoraEntrega ? new Date(e.dataHoraEntrega).toLocaleString('pt-BR') : '—'}</td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {e.temComprovante && (e.provas?.length || e.comprovanteId)
                          ? <button onClick={() => verProva(e)} disabled={imgBusy === e.id}
                              title={(e.provas?.length ?? 0) > 1 ? e.provas!.map((p) => PROVA_LABEL[p.tipo]).join(' + ') : undefined}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                              {imgBusy === e.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : e.comprovanteTipo === 'ASSINATURA' ? <PenLine className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}
                              {(e.provas?.length ?? 0) > 1
                                ? `Ver provas (${e.provas!.length})`
                                : e.comprovanteTipo ? `Ver ${PROVA_LABEL[e.comprovanteTipo].toLowerCase()}` : 'Ver prova'}
                            </button>
                          : <span className="text-xs text-slate-400">sem prova</span>}
                        {e.status === 'NAO_ENTREGUE' && (
                          <button onClick={() => void novaTentativa(e)} disabled={reabrindo === e.id}
                            title="Volta a entrega pra fila de pendentes para montar nova rota"
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-400 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50">
                            {reabrindo === e.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '♻'} Nova tentativa
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>}
      </div>

      {imagem && (() => {
        const prova = imagem.provas[imagem.ativa];
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={fecharImagem}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                {prova.meta.tipo && imagem.provas.length === 1 && (
                  <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${prova.meta.tipo === 'ASSINATURA' ? 'bg-violet-100 text-violet-700' : 'bg-capul-100 text-capul-700'}`}>
                    {prova.meta.tipo === 'ASSINATURA' ? <PenLine className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                    {PROVA_LABEL[prova.meta.tipo]}
                  </span>
                )}
                <span>
                  Entrega #{imagem.entrega.numero} · {imagem.entrega.destinatarioNome}
                </span>
              </div>
              <button onClick={fecharImagem} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>

            {/* Abas: a baixa pode ter foto E assinatura. Sem isto só a primária
                (a foto) era alcançável e a assinatura ficava invisível. */}
            {imagem.provas.length > 1 && (
              <div className="mb-2 flex gap-1 border-b border-slate-100">
                {imagem.provas.map((p, i) => (
                  <button key={p.id} onClick={() => setImagem((a) => (a ? { ...a, ativa: i } : a))}
                    className={`inline-flex items-center gap-1 rounded-t-lg px-3 py-1.5 text-xs font-medium ${
                      i === imagem.ativa ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:bg-slate-50'}`}>
                    {p.meta.tipo === 'ASSINATURA' ? <PenLine className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                    {p.meta.tipo ? PROVA_LABEL[p.meta.tipo] : `Prova ${i + 1}`}
                  </button>
                ))}
              </div>
            )}

            <img
              src={prova.url}
              alt={prova.meta.tipo === 'ASSINATURA' ? 'assinatura' : 'foto da entrega'}
              className={`w-full rounded-lg ${prova.meta.tipo === 'ASSINATURA' ? 'border border-slate-200 bg-white' : ''}`}
            />
            {/* Quem recebeu: a entrega é a fonte primária, a trilha do cofre a
                reserva. O campo é opcional na baixa, então dizer "não informado"
                é melhor que sumir com a linha — o financeiro precisa saber que
                ninguém anotou, não ficar em dúvida se a tela escondeu. */}
            <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs">
              <span className="text-slate-500">Recebido por: </span>
              {imagem.entrega.recebedorNome || prova.meta.trilha?.recebedorNome
                ? <span className="font-medium text-slate-700">{imagem.entrega.recebedorNome || prova.meta.trilha?.recebedorNome}</span>
                : <span className="italic text-slate-400">não informado na baixa</span>}
              {imagem.entrega.dataHoraEntrega && (
                <span className="text-slate-400"> · {new Date(imagem.entrega.dataHoraEntrega).toLocaleString('pt-BR')}</span>
              )}
            </div>
            {/* Hash e GPS são POR PROVA — trocar de aba tem de trocar os dois,
                senão a assinatura apareceria com o hash da foto. */}
            <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-400">
              <span className="break-all">SHA-256: {prova.meta.hash}</span>
              {prova.meta.geoLat && prova.meta.geoLng && (
                <a className="inline-flex shrink-0 items-center gap-1 text-capul-700 hover:underline" target="_blank" rel="noopener"
                  href={`https://www.google.com/maps?q=${prova.meta.geoLat},${prova.meta.geoLng}`}><MapPin className="h-3.5 w-3.5" /> ver no mapa</a>
              )}
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
