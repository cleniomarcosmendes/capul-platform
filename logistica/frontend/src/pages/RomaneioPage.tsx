import { useEffect, useState, type CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import { Printer, Loader2, ArrowLeft } from 'lucide-react';
import { coreApi, logisticaApi } from '../services/api';
import { maskTelefone, maskCep } from '../utils/format';

interface CoreItem { id: string; nome?: string; codigo?: string; nomeFantasia?: string }
interface EntregaR {
  numero: number; destinatarioNome: string; telefone?: string | null;
  endLogradouro: string; endNumero?: string | null; endComplemento?: string | null;
  endBairro?: string | null; endCidade?: string | null; endUf?: string | null; endCep?: string | null;
  endReferencia?: string | null; quantidadeVolumes: number;
}
interface ParadaR { sequencia: number; entrega?: EntregaR | null }
interface ViagemR { numero: number; situacao: string; motoristaId: string; filialId: string; veiculo?: { placa?: string; modelo?: string } | null; paradas?: ParadaR[] }

const BADGE: Record<string, CSSProperties> = {
  RASCUNHO: { background: '#e0f2fe', color: '#0369a1' },
  EM_CURSO: { background: '#fef3c7', color: '#b45309' },
  CONCLUIDA: { background: '#dcfce7', color: '#15803d' },
  CANCELADA: { background: '#fee2e2', color: '#b91c1c' },
};

const CSS = `
.rom-root { background:#f1f5f9; min-height:100vh; }
.rom-bar { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 20px; background:#fff; border-bottom:1px solid #e2e8f0; position:sticky; top:0; z-index:10; }
.rom-folha { max-width:1000px; margin:20px auto; background:#fff; border:1px solid #cbd5e1; border-radius:10px; padding:24px; box-shadow:0 1px 3px rgba(15,23,42,.08); font-family: system-ui, -apple-system, sans-serif; color:#0f172a; }
.rom-head { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:12px; border-bottom:3px solid #0ea5e9; margin-bottom:14px; }
.rom-brand { font-size:12px; font-weight:800; color:#0ea5e9; letter-spacing:2px; }
.rom-title { font-size:22px; font-weight:800; margin-top:1px; line-height:1.1; }
.rom-filial { font-size:12px; color:#475569; margin-top:2px; }
.rom-meta { font-size:12px; color:#334155; text-align:right; line-height:1.7; }
.rom-meta b { color:#0f172a; }
.rom-badge { display:inline-block; padding:2px 9px; border-radius:6px; font-size:11px; font-weight:700; }
table.rom { width:100%; border-collapse:collapse; font-size:12px; }
table.rom thead th { background:#0f172a; color:#fff; text-align:left; padding:7px 8px; font-size:10px; text-transform:uppercase; letter-spacing:.6px; }
table.rom tbody td { padding:8px; border-bottom:1px solid #e2e8f0; vertical-align:top; }
table.rom tbody tr:nth-child(even) { background:#f8fafc; }
.rom-c { text-align:center; }
.rom-seq { text-align:center; font-weight:800; color:#0ea5e9; font-size:14px; }
.rom-dest { font-weight:700; }
.rom-tel { color:#475569; }
.rom-ref { color:#64748b; font-size:11px; margin-top:1px; }
.rom-assina { border-bottom:1px solid #94a3b8; height:20px; }
.rom-foot { margin-top:16px; display:flex; justify-content:space-between; align-items:center; gap:16px; font-size:12px; border-top:1px solid #e2e8f0; padding-top:10px; }
.rom-tot { font-weight:700; }
.rom-tot em { font-style:normal; color:#0ea5e9; }
.rom-horas { color:#475569; }
@media print {
  .no-print { display:none !important; }
  .rom-root { background:#fff; min-height:0; }
  .rom-folha { margin:0; border:none; border-radius:0; max-width:none; padding:0; box-shadow:none; }
  table.rom thead th, table.rom tbody tr:nth-child(even), .rom-badge { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  thead { display:table-header-group; } tr { break-inside:avoid; }
  @page { margin:10mm; size: A4 landscape; }
}`;

export function RomaneioPage() {
  const { id } = useParams();
  const [v, setV] = useState<ViagemR | null>(null);
  const [filiais, setFiliais] = useState<CoreItem[]>([]);
  const [usuarios, setUsuarios] = useState<CoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Injeta o CSS direto no <head> (robusto — não depende do <style> do React 19).
  useEffect(() => {
    const s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);
    return () => { s.remove(); };
  }, []);

  useEffect(() => {
    Promise.all([
      coreApi.get<CoreItem[]>('/filiais').catch(() => ({ data: [] })),
      coreApi.get<CoreItem[]>('/usuarios').catch(() => ({ data: [] })),
    ]).then(([f, u]) => { setFiliais(f.data); setUsuarios(u.data); });
  }, []);

  useEffect(() => {
    setLoading(true);
    logisticaApi.get<ViagemR>(`/viagens/${id}`)
      .then((r) => setV(r.data))
      .catch(() => setErro('Não foi possível carregar a viagem.'))
      .finally(() => setLoading(false));
  }, [id]);

  const nome = (lista: CoreItem[], cid?: string) => {
    const i = lista.find((x) => x.id === cid);
    return i ? i.nomeFantasia || i.nome || i.codigo || '' : '';
  };

  const paradas = (v?.paradas ?? []).filter((p) => p.entrega);
  const totalVol = paradas.reduce((s, p) => s + (p.entrega?.quantidadeVolumes ?? 0), 0);

  return (
    <div className="rom-root">
      <div className="no-print rom-bar">
        <button onClick={() => history.back()} className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <span className="text-sm text-slate-500">{v ? `Romaneio da Viagem #${v.numero}` : ''}</span>
        <button onClick={() => window.print()} disabled={!v || paradas.length === 0}
          className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">
          <Printer className="h-4 w-4" /> Imprimir
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 p-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
      ) : erro || !v ? (
        <div className="p-8 text-sm text-red-600">{erro ?? 'Viagem não encontrada.'}</div>
      ) : (
        <div className="rom-folha">
          <div className="rom-head">
            <div>
              <div className="rom-brand">CAPUL · LOGÍSTICA</div>
              <div className="rom-title">Romaneio de Viagem #{v.numero}</div>
              <div className="rom-filial">{nome(filiais, v.filialId)}</div>
            </div>
            <div className="rom-meta">
              <div><b>Veículo:</b> {v.veiculo?.placa ?? '—'}{v.veiculo?.modelo ? ` · ${v.veiculo.modelo}` : ''}</div>
              <div><b>Motorista:</b> {nome(usuarios, v.motoristaId) || '—'}</div>
              <div><b>Situação:</b> <span className="rom-badge" style={BADGE[v.situacao] ?? { background: '#f1f5f9', color: '#475569' }}>{v.situacao}</span></div>
            </div>
          </div>

          {paradas.length === 0 ? (
            <div className="text-sm text-slate-500">Viagem sem entregas.</div>
          ) : (
            <table className="rom">
              <thead>
                <tr>
                  <th style={{ width: 32 }}>#</th>
                  <th style={{ width: 50 }}>Entrega</th>
                  <th>Destinatário / Telefone</th>
                  <th>Endereço</th>
                  <th style={{ width: 44 }} className="rom-c">Vol</th>
                  <th style={{ width: 180 }}>Recebido por / assinatura</th>
                </tr>
              </thead>
              <tbody>
                {paradas.map((p) => {
                  const e = p.entrega!;
                  const linha2 = [e.endBairro, [e.endCidade, e.endUf].filter(Boolean).join('/'), e.endCep ? `CEP ${maskCep(e.endCep)}` : ''].filter(Boolean).join(' · ');
                  return (
                    <tr key={p.sequencia}>
                      <td className="rom-seq">{p.sequencia}</td>
                      <td className="rom-c">#{e.numero}</td>
                      <td>
                        <div className="rom-dest">{e.destinatarioNome}</div>
                        {e.telefone && <div className="rom-tel">{maskTelefone(e.telefone)}</div>}
                      </td>
                      <td>
                        <div>{e.endLogradouro}{e.endNumero ? `, ${e.endNumero}` : ''}{e.endComplemento ? ` — ${e.endComplemento}` : ''}</div>
                        {linha2 && <div>{linha2}</div>}
                        {e.endReferencia && <div className="rom-ref">Ref.: {e.endReferencia}</div>}
                      </td>
                      <td className="rom-seq">{e.quantidadeVolumes}</td>
                      <td><div className="rom-assina" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <div className="rom-foot">
            <div className="rom-tot">{paradas.length} entrega(s) · <em>{totalVol} volume(s)</em></div>
            <div className="rom-horas">Saída: ___/___/______  ___:___ &nbsp;·&nbsp; Retorno: ___/___/______  ___:___</div>
          </div>
        </div>
      )}
    </div>
  );
}
