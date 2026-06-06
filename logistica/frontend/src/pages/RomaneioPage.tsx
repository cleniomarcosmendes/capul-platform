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

// Estilos 100% INLINE — não dependem de stylesheet/cache/<style>.
const ADJ = { WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as CSSProperties;
const S = {
  folha: { maxWidth: 1000, margin: '20px auto', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 10, padding: 24, boxShadow: '0 1px 3px rgba(15,23,42,.08)', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#0f172a' } as CSSProperties,
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 12, borderBottom: '3px solid #0ea5e9', marginBottom: 14 } as CSSProperties,
  brand: { fontSize: 12, fontWeight: 800, color: '#0ea5e9', letterSpacing: 2 } as CSSProperties,
  title: { fontSize: 22, fontWeight: 800, marginTop: 1, lineHeight: 1.1 } as CSSProperties,
  filial: { fontSize: 12, color: '#475569', marginTop: 2 } as CSSProperties,
  meta: { fontSize: 12, color: '#334155', textAlign: 'right', lineHeight: 1.7 } as CSSProperties,
  badgeBase: { display: 'inline-block', padding: '2px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700 } as CSSProperties,
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 2 } as CSSProperties,
  th: { background: '#0f172a', color: '#fff', textAlign: 'left', padding: '7px 8px', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6, ...ADJ } as CSSProperties,
  thC: { background: '#0f172a', color: '#fff', textAlign: 'center', padding: '7px 8px', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6, ...ADJ } as CSSProperties,
  td: { padding: 8, borderBottom: '1px solid #e2e8f0', verticalAlign: 'top' } as CSSProperties,
  seq: { padding: 8, borderBottom: '1px solid #e2e8f0', verticalAlign: 'top', textAlign: 'center', fontWeight: 800, color: '#0ea5e9', fontSize: 14 } as CSSProperties,
  dest: { fontWeight: 700 } as CSSProperties,
  tel: { color: '#475569' } as CSSProperties,
  ref: { color: '#64748b', fontSize: 11, marginTop: 1 } as CSSProperties,
  assina: { borderBottom: '1px solid #94a3b8', height: 20 } as CSSProperties,
  foot: { marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, fontSize: 12, borderTop: '1px solid #e2e8f0', paddingTop: 10 } as CSSProperties,
  tot: { fontWeight: 700 } as CSSProperties,
  horas: { color: '#475569' } as CSSProperties,
};

// Só @media print precisa de stylesheet (esconder toolbar + página A4). Injetado no head.
const PRINT_CSS = `
@media print {
  .rom-noprint { display:none !important; }
  body { background:#fff !important; }
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
    const s = document.createElement('style');
    s.textContent = PRINT_CSS;
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
    <div style={{ background: '#f1f5f9', minHeight: '100vh' }}>
      <div className="rom-noprint" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 20px', background: '#fff', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 }}>
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
        <div style={S.folha}>
          <div style={S.head}>
            <div>
              <div style={S.brand}>CAPUL · LOGÍSTICA</div>
              <div style={S.title}>Romaneio de Viagem #{v.numero}</div>
              <div style={S.filial}>{nome(filiais, v.filialId)}</div>
            </div>
            <div style={S.meta}>
              <div><b>Veículo:</b> {v.veiculo?.placa ?? '—'}{v.veiculo?.modelo ? ` · ${v.veiculo.modelo}` : ''}</div>
              <div><b>Motorista:</b> {nome(usuarios, v.motoristaId) || '—'}</div>
              <div><b>Situação:</b> <span style={{ ...S.badgeBase, ...(BADGE[v.situacao] ?? { background: '#f1f5f9', color: '#475569' }), ...ADJ }}>{v.situacao}</span></div>
            </div>
          </div>

          {paradas.length === 0 ? (
            <div className="text-sm text-slate-500">Viagem sem entregas.</div>
          ) : (
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={{ ...S.thC, width: 32 }}>#</th>
                  <th style={{ ...S.thC, width: 50 }}>Entrega</th>
                  <th style={S.th}>Destinatário / Telefone</th>
                  <th style={S.th}>Endereço</th>
                  <th style={{ ...S.thC, width: 44 }}>Vol</th>
                  <th style={{ ...S.th, width: 180 }}>Recebido por / assinatura</th>
                </tr>
              </thead>
              <tbody>
                {paradas.map((p, i) => {
                  const e = p.entrega!;
                  const linha2 = [e.endBairro, [e.endCidade, e.endUf].filter(Boolean).join('/'), e.endCep ? `CEP ${maskCep(e.endCep)}` : ''].filter(Boolean).join(' · ');
                  const rowBg = i % 2 === 1 ? { background: '#f8fafc', ...ADJ } : undefined;
                  return (
                    <tr key={p.sequencia} style={rowBg}>
                      <td style={S.seq}>{p.sequencia}</td>
                      <td style={{ ...S.td, textAlign: 'center' }}>#{e.numero}</td>
                      <td style={S.td}>
                        <div style={S.dest}>{e.destinatarioNome}</div>
                        {e.telefone && <div style={S.tel}>{maskTelefone(e.telefone)}</div>}
                      </td>
                      <td style={S.td}>
                        <div>{e.endLogradouro}{e.endNumero ? `, ${e.endNumero}` : ''}{e.endComplemento ? ` — ${e.endComplemento}` : ''}</div>
                        {linha2 && <div>{linha2}</div>}
                        {e.endReferencia && <div style={S.ref}>Ref.: {e.endReferencia}</div>}
                      </td>
                      <td style={S.seq}>{e.quantidadeVolumes}</td>
                      <td style={S.td}><div style={S.assina} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <div style={S.foot}>
            <div style={S.tot}>{paradas.length} entrega(s) · <span style={{ color: '#0ea5e9' }}>{totalVol} volume(s)</span></div>
            <div style={S.horas}>Saída: ___/___/______  ___:___ &nbsp;·&nbsp; Retorno: ___/___/______  ___:___</div>
          </div>
        </div>
      )}
    </div>
  );
}
