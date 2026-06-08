import { useState } from 'react';
import { FileSearch, Loader2, MapPin, X, ImageIcon } from 'lucide-react';
import { logisticaApi } from '../services/api';

interface Comprovante {
  id: string;
  entregaId: string;
  entregaNumero: number | null;
  filialId: string;
  matricula: string | null;
  cupom: string | null;
  tipo: string;
  hash: string;
  mimeType: string | null;
  geoLat: string | null;
  geoLng: string | null;
  capturadoEm: string;
  trilha?: { recebedorNome?: string | null } | null;
}

/**
 * Consulta de comprovante de entrega (Fase 1b — financeiro/cobrança). A prova
 * lastreia a venda a prazo: aqui o financeiro a localiza por matrícula, cupom
 * ou nº de entrega e abre a imagem. Read-only (o cofre é append-only).
 */
export function ComprovantesPage() {
  const [matricula, setMatricula] = useState('');
  const [cupom, setCupom] = useState('');
  const [entregaNumero, setEntregaNumero] = useState('');
  const [itens, setItens] = useState<Comprovante[]>([]);
  const [loading, setLoading] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [imagem, setImagem] = useState<{ url: string; comp: Comprovante } | null>(null);
  const [imgBusy, setImgBusy] = useState<string | null>(null);

  async function buscar() {
    setErro(null); setLoading(true); setBuscou(true);
    try {
      const params: Record<string, string> = {};
      if (matricula.trim()) params.matricula = matricula.trim();
      if (cupom.trim()) params.cupom = cupom.trim();
      if (entregaNumero.trim()) params.entregaNumero = entregaNumero.trim();
      const { data } = await logisticaApi.get<Comprovante[]>('/comprovantes', { params });
      setItens(data);
    } catch (err) {
      const m = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setErro(m || 'Falha na consulta.');
    } finally { setLoading(false); }
  }

  // Busca o binário autenticado (Bearer) como blob e abre num visualizador.
  async function verImagem(c: Comprovante) {
    setImgBusy(c.id);
    try {
      const { data } = await logisticaApi.get(`/comprovantes/${c.id}/arquivo`, { responseType: 'blob' });
      setImagem({ url: URL.createObjectURL(data as Blob), comp: c });
    } catch {
      setErro('Não foi possível abrir o arquivo da prova.');
    } finally { setImgBusy(null); }
  }

  const inp = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Comprovantes de entrega</h2>
        <p className="text-sm text-slate-500">Consulta da prova (lastro da cobrança a prazo) por matrícula, cupom ou nº de entrega.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div><label className="block text-xs font-medium text-slate-500">Matrícula</label>
          <input value={matricula} onChange={(e) => setMatricula(e.target.value)} placeholder="E01047" className={`${inp} w-36`} onKeyDown={(e) => e.key === 'Enter' && buscar()} /></div>
        <div><label className="block text-xs font-medium text-slate-500">Cupom</label>
          <input value={cupom} onChange={(e) => setCupom(e.target.value)} placeholder="nº do cupom" className={`${inp} w-36`} onKeyDown={(e) => e.key === 'Enter' && buscar()} /></div>
        <div><label className="block text-xs font-medium text-slate-500">Nº da entrega</label>
          <input value={entregaNumero} onChange={(e) => setEntregaNumero(e.target.value)} placeholder="ex: 41" className={`${inp} w-28`} onKeyDown={(e) => e.key === 'Enter' && buscar()} /></div>
        <button onClick={buscar} disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />} Buscar
        </button>
      </div>

      {erro && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{erro}</div>}

      <div className="rounded-xl border border-slate-200 bg-white">
        {loading ? <div className="p-6 text-sm text-slate-500"><Loader2 className="inline h-4 w-4 animate-spin" /> Buscando…</div>
          : !buscou ? <div className="p-6 text-sm text-slate-500">Informe um filtro e clique em Buscar.</div>
          : itens.length === 0 ? <div className="p-6 text-sm text-slate-500">Nenhum comprovante encontrado.</div>
          : <table className="w-full text-sm">
              <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr><th className="px-4 py-2">Entrega</th><th className="px-4 py-2">Matrícula</th><th className="px-4 py-2">Cupom</th><th className="px-4 py-2">Tipo</th><th className="px-4 py-2">Capturado</th><th className="px-4 py-2">GPS</th><th className="px-4 py-2"></th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {itens.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium text-slate-700">#{c.entregaNumero ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-600">{c.matricula ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-600">{c.cupom ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-600">{c.tipo}</td>
                    <td className="px-4 py-2 text-slate-600">{new Date(c.capturadoEm).toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-2 text-slate-500">
                      {c.geoLat && c.geoLng
                        ? <a className="inline-flex items-center gap-1 text-sky-700 hover:underline" target="_blank" rel="noopener"
                            href={`https://www.google.com/maps?q=${c.geoLat},${c.geoLng}`}><MapPin className="h-3.5 w-3.5" /> ver</a>
                        : '—'}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => verImagem(c)} disabled={imgBusy === c.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                        {imgBusy === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />} Ver prova
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>}
      </div>

      {imagem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={() => setImagem(null)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-700">
                Prova · Entrega #{imagem.comp.entregaNumero ?? '—'}
                {imagem.comp.trilha?.recebedorNome ? ` · Recebido por ${imagem.comp.trilha.recebedorNome}` : ''}
              </div>
              <button onClick={() => setImagem(null)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <img src={imagem.url} alt="comprovante" className="w-full rounded-lg" />
            <div className="mt-2 break-all text-[11px] text-slate-400">SHA-256: {imagem.comp.hash}</div>
          </div>
        </div>
      )}
    </div>
  );
}
