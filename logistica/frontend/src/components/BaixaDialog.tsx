import { useState } from 'react';
import { Camera, Loader2, MapPin, X } from 'lucide-react';
import { logisticaApi } from '../services/api';

interface EntregaAlvo {
  id: string;
  numero: number;
  destinatarioNome: string;
}

interface Props {
  entrega: EntregaAlvo;
  onClose: () => void;
  onBaixado: () => void;
}

/**
 * Baixa de entrega no campo (Fase 1b) pela web — espelha o que o app do
 * entregador fará. ENTREGUE captura a PROVA (foto) que vai pro cofre; o GPS é
 * por evento (opcional, via navegador). NAO_ENTREGUE exige motivo.
 */
export function BaixaDialog({ entrega, onClose, onBaixado }: Props) {
  const [resultado, setResultado] = useState<'ENTREGUE' | 'NAO_ENTREGUE'>('ENTREGUE');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [recebedor, setRecebedor] = useState('');
  const [motivo, setMotivo] = useState('');
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function escolherArquivo(f: File | null) {
    setArquivo(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  function capturarGps() {
    if (!navigator.geolocation) { setErro('GPS não disponível neste dispositivo.'); return; }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGeoBusy(false); },
      () => { setErro('Não foi possível obter a localização.'); setGeoBusy(false); },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function enviar() {
    setErro(null);
    if (resultado === 'NAO_ENTREGUE' && !motivo.trim()) { setErro('Informe o motivo da não-entrega.'); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('resultado', resultado);
      if (resultado === 'ENTREGUE') {
        if (arquivo) fd.append('prova', arquivo);
        if (recebedor.trim()) fd.append('recebedorNome', recebedor.trim());
        fd.append('tipoProva', 'FOTO');
      } else {
        fd.append('motivo', motivo.trim());
      }
      if (geo) { fd.append('geoLat', String(geo.lat)); fd.append('geoLng', String(geo.lng)); }
      await logisticaApi.post(`/entregas/${entrega.id}/baixar`, fd);
      onBaixado();
    } catch (err) {
      const m = (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
      setErro(Array.isArray(m) ? m.join(', ') : m || 'Falha ao dar baixa.');
    } finally { setBusy(false); }
  }

  const tabBtn = (ativo: boolean) =>
    `flex-1 rounded-lg px-3 py-2 text-sm font-medium ${ativo ? 'bg-capul-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">Baixa da entrega #{entrega.numero}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <p className="mt-0.5 text-sm text-slate-500">{entrega.destinatarioNome}</p>

        <div className="mt-4 flex gap-2">
          <button onClick={() => setResultado('ENTREGUE')} className={tabBtn(resultado === 'ENTREGUE')}>Entregue</button>
          <button onClick={() => setResultado('NAO_ENTREGUE')} className={tabBtn(resultado === 'NAO_ENTREGUE')}>Não entregue</button>
        </div>

        {resultado === 'ENTREGUE' ? (
          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-500">Prova de entrega (foto)</label>
              <label className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500 hover:border-capul-400 hover:text-capul-600">
                <Camera className="h-5 w-5" />
                {arquivo ? 'Trocar foto' : 'Tirar/escolher foto'}
                <input type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={(e) => escolherArquivo(e.target.files?.[0] ?? null)} />
              </label>
              {preview && <img src={preview} alt="prévia" className="mt-2 max-h-40 w-full rounded-lg object-cover" />}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500">Recebido por (opcional)</label>
              <input value={recebedor} onChange={(e) => setRecebedor(e.target.value)} placeholder="Nome de quem recebeu"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-capul-500 focus:outline-none" />
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <label className="block text-xs font-medium text-slate-500">Motivo da não-entrega *</label>
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} placeholder="Cliente ausente, endereço não localizado, recusa…"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-capul-500 focus:outline-none" />
          </div>
        )}

        <button onClick={capturarGps} disabled={geoBusy}
          className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-capul-600 disabled:opacity-50">
          {geoBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
          {geo ? `Local capturado (${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)})` : 'Capturar localização (GPS)'}
        </button>

        {erro && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancelar</button>
          <button onClick={enviar} disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar baixa
          </button>
        </div>
      </div>
    </div>
  );
}
