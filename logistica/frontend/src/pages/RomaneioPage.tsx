import { useEffect, useState } from 'react';
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

const CSS = `
.rom-root { background:#f1f5f9; min-height:100vh; }
.rom-toolbar { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 20px; background:#fff; border-bottom:1px solid #e2e8f0; position:sticky; top:0; z-index:10; }
.rom-folha { max-width:900px; margin:16px auto; background:#fff; border:1px solid #cbd5e1; border-radius:8px; padding:18px; font-family: system-ui, -apple-system, sans-serif; color:#0f172a; }
.rom-cab { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #0f172a; padding-bottom:8px; margin-bottom:6px; }
.rom-titulo { font-size:18px; font-weight:800; }
.rom-sub { font-size:12px; color:#475569; margin-top:2px; }
.rom-meta { font-size:12px; text-align:right; color:#334155; }
table.rom { width:100%; border-collapse:collapse; font-size:12px; margin-top:8px; }
table.rom th { background:#f1f5f9; text-align:left; padding:5px 6px; border:1px solid #cbd5e1; font-size:10px; text-transform:uppercase; letter-spacing:.4px; color:#475569; }
table.rom td { padding:6px; border:1px solid #cbd5e1; vertical-align:top; }
.rom-seq { font-weight:700; text-align:center; }
.rom-rodape { margin-top:10px; font-size:12px; color:#475569; display:flex; justify-content:space-between; }
@media print {
  .no-print { display:none !important; }
  .rom-root { background:#fff; min-height:0; }
  .rom-folha { margin:0; border:none; border-radius:0; max-width:none; padding:0; }
  @page { margin:10mm; size: A4 landscape; }
}`;

export function RomaneioPage() {
  const { id } = useParams();
  const [v, setV] = useState<ViagemR | null>(null);
  const [filiais, setFiliais] = useState<CoreItem[]>([]);
  const [usuarios, setUsuarios] = useState<CoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

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
      <style>{CSS}</style>
      <div className="no-print rom-toolbar">
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
          <div className="rom-cab">
            <div>
              <div className="rom-titulo">Romaneio de Viagem #{v.numero}</div>
              <div className="rom-sub">CAPUL · {nome(filiais, v.filialId)}</div>
            </div>
            <div className="rom-meta">
              <div><b>Veículo:</b> {v.veiculo?.placa ?? '—'}{v.veiculo?.modelo ? ` (${v.veiculo.modelo})` : ''}</div>
              <div><b>Motorista:</b> {nome(usuarios, v.motoristaId) || '—'}</div>
              <div><b>Situação:</b> {v.situacao}</div>
            </div>
          </div>

          {paradas.length === 0 ? (
            <div className="text-sm text-slate-500">Viagem sem entregas.</div>
          ) : (
            <table className="rom">
              <thead>
                <tr>
                  <th style={{ width: 28 }}>#</th>
                  <th style={{ width: 44 }}>Entrega</th>
                  <th>Destinatário / Telefone</th>
                  <th>Endereço</th>
                  <th style={{ width: 40 }}>Vol</th>
                  <th style={{ width: 150 }}>Recebido por / assinatura</th>
                </tr>
              </thead>
              <tbody>
                {paradas.map((p) => {
                  const e = p.entrega!;
                  const linha2 = [e.endBairro, [e.endCidade, e.endUf].filter(Boolean).join('/'), e.endCep ? `CEP ${maskCep(e.endCep)}` : ''].filter(Boolean).join(' · ');
                  return (
                    <tr key={p.sequencia}>
                      <td className="rom-seq">{p.sequencia}</td>
                      <td>#{e.numero}</td>
                      <td>
                        <div><b>{e.destinatarioNome}</b></div>
                        {e.telefone && <div>{maskTelefone(e.telefone)}</div>}
                      </td>
                      <td>
                        <div>{e.endLogradouro}{e.endNumero ? `, ${e.endNumero}` : ''}{e.endComplemento ? ` — ${e.endComplemento}` : ''}</div>
                        {linha2 && <div>{linha2}</div>}
                        {e.endReferencia && <div style={{ color: '#64748b' }}>Ref.: {e.endReferencia}</div>}
                      </td>
                      <td className="rom-seq">{e.quantidadeVolumes}</td>
                      <td></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <div className="rom-rodape">
            <span>{paradas.length} entrega(s) · {totalVol} volume(s)</span>
            <span>Saída: ____/____/______  ____:____   ·   Retorno: ____/____/______  ____:____</span>
          </div>
        </div>
      )}
    </div>
  );
}
