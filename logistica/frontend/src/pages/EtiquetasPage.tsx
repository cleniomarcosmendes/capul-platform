import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Printer, Loader2, ArrowLeft } from 'lucide-react';
import { coreApi, logisticaApi } from '../services/api';
import { EtiquetaEntrega, type EntregaEtiqueta } from '../components/EtiquetaEntrega';

interface CoreItem { id: string; nome?: string; codigo?: string; nomeFantasia?: string }
type EntregaResp = EntregaEtiqueta & { filialId?: string };
interface ParadaResp { sequencia?: number; entrega?: EntregaResp }
interface ViagemResp { numero: number; veiculo?: { placa?: string } | null; paradas?: ParadaResp[] }
interface Item { entrega: EntregaResp; sequencia?: number }

// Layout para bobina TÉRMICA 80mm (Bematech MP-4200 TH — a mesma do cupom
// fiscal). Conteúdo ~72mm; tudo em preto e fontes grandes (o papel é colado na
// caixa e precisa ser lido de longe). O corte do papel é feito pelo DRIVER da
// impressora (já configurado para cortar o cupom): com @page 80mm auto + quebra
// por entrega, ela corta ao fim de cada uma e ao terminar o trabalho.
const CSS = `
.etq-root { background:#f1f5f9; min-height:100vh; }
.etq-toolbar { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 20px; background:#fff; border-bottom:1px solid #e2e8f0; position:sticky; top:0; z-index:10; }
.etq-folhas { padding:20px; display:flex; flex-direction:column; align-items:center; gap:16px; }
.etiqueta { width:72mm; background:#fff; border:1px solid #cbd5e1; border-radius:6px; padding:4mm; box-sizing:border-box; font-family: system-ui, -apple-system, sans-serif; color:#000; font-weight:700; }
.etq-topo { display:flex; justify-content:space-between; align-items:baseline; border-bottom:3px solid #000; padding-bottom:4px; }
.etq-marca { font-weight:800; font-size:14px; letter-spacing:.3px; }
.etq-numero { font-weight:900; font-size:26px; }
.etq-viagem { font-size:14px; font-weight:700; color:#000; margin-top:4px; }
.etq-dest { font-size:24px; font-weight:900; margin-top:8px; line-height:1.15; text-transform:uppercase; }
.etq-tel { font-size:19px; font-weight:800; margin-top:2px; }
.etq-end { font-size:20px; font-weight:800; margin-top:7px; line-height:1.3; }
.etq-ref { font-size:16px; font-weight:700; color:#000; margin-top:3px; }
.etq-rodape { display:flex; justify-content:space-between; align-items:center; margin-top:8px; font-size:17px; font-weight:800; }
.etq-obs { font-size:17px; font-weight:800; color:#000; margin-top:6px; border-top:2px dashed #000; padding-top:5px; }
@media print {
  .no-print { display:none !important; }
  .etq-root { background:#fff; min-height:0; }
  .etq-folhas { padding:0; gap:0; }
  .etiqueta { border:none; border-radius:0; width:80mm; padding:2mm 4mm; page-break-after: always; }
  .etiqueta:last-child { page-break-after: auto; }
  /* Bobina térmica 80mm contínua — sem margem; o driver corta a cada página. */
  @page { size: 80mm auto; margin: 0; }
}`;

export function EtiquetasPage({ modo }: { modo: 'viagem' | 'entrega' }) {
  const { id } = useParams();
  const [itens, setItens] = useState<Item[]>([]);
  const [cab, setCab] = useState<{ viagemNumero?: number; placa?: string; total?: number }>({});
  const [filiais, setFiliais] = useState<CoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Injeta o CSS no <head> (robusto — não depende do <style> do React 19).
  useEffect(() => {
    const s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);
    return () => { s.remove(); };
  }, []);

  useEffect(() => {
    coreApi.get<CoreItem[]>('/filiais').then((r) => setFiliais(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setErro(null);
    const carregar = async (): Promise<Item[]> => {
      if (modo === 'viagem') {
        const { data } = await logisticaApi.get<ViagemResp>(`/viagens/${id}`);
        setCab({ viagemNumero: data.numero, placa: data.veiculo?.placa ?? undefined, total: data.paradas?.length });
        return (data.paradas ?? [])
          .filter((p): p is ParadaResp & { entrega: EntregaResp } => !!p.entrega)
          .map((p) => ({ entrega: p.entrega, sequencia: p.sequencia }));
      }
      const { data } = await logisticaApi.get<EntregaResp>(`/entregas/${id}`);
      return [{ entrega: data }];
    };
    carregar()
      .then(setItens)
      .catch(() => setErro('Não foi possível carregar as etiquetas.'))
      .finally(() => setLoading(false));
  }, [modo, id]);

  const filialLabel = (fid?: string) => {
    const f = filiais.find((x) => x.id === fid);
    return f ? f.nomeFantasia || f.nome || f.codigo : undefined;
  };

  const btn = 'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium';

  return (
    <div className="etq-root">
      <div className="no-print etq-toolbar">
        <button onClick={() => history.back()} className={`${btn} text-slate-600 hover:bg-slate-100`}>
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <span className="text-sm text-slate-500">
          {cab.viagemNumero ? `Viagem #${cab.viagemNumero} · ` : ''}{itens.length} etiqueta(s)
        </span>
        <button onClick={() => window.print()} disabled={!itens.length}
          className={`${btn} bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50`}>
          <Printer className="h-4 w-4" /> Imprimir
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 p-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
      ) : erro ? (
        <div className="p-8 text-sm text-red-600">{erro}</div>
      ) : itens.length === 0 ? (
        <div className="p-8 text-sm text-slate-500">Nenhuma entrega para etiquetar.</div>
      ) : (
        <div className="etq-folhas">
          {itens.map((it, i) => (
            <EtiquetaEntrega
              key={i}
              entrega={it.entrega}
              sequencia={it.sequencia}
              totalParadas={cab.total}
              placa={cab.placa}
              viagemNumero={cab.viagemNumero}
              filialLabel={filialLabel(it.entrega.filialId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
