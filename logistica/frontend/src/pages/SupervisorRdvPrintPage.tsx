import { useEffect, useState, type CSSProperties } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { logisticaApi } from '../services/api';

interface Rdv {
  viagem: { numero: number; mesReferencia?: number | null; situacao: string };
  supervisor: { matricula?: string | null; nome?: string | null };
  veiculo?: { placa: string; modelo?: string | null } | null;
  tipos: { id: string; nome: string; categoria: string }[];
  dias: { data: string; municipios: string[]; valores: Record<string, number>; total: number }[];
  totaisPorTipo: Record<string, number>;
  totaisPorCategoria: { VEICULO: number; INDIVIDUO: number };
  total: number; adiantamento: number; saldo: number;
}

const brl = (v: number) => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtMes = (m?: number | null) => (m ? `${String(m % 100).padStart(2, '0')}/${Math.floor(m / 100)}` : '—');
const fmtDia = (s: string) => { const p = s.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}` : s; };

const cell: CSSProperties = { border: '1px solid #333', padding: '4px 6px', fontSize: 11 };
const cellR: CSSProperties = { ...cell, textAlign: 'right' };
const th: CSSProperties = { ...cell, background: '#eee', fontWeight: 700, textAlign: 'center' };

export function SupervisorRdvPrintPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [r, setR] = useState<Rdv | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    logisticaApi.get<Rdv>(`/supervisor/viagens/${id}/rdv`).then((res) => setR(res.data)).catch(() => setErro(true));
  }, [id]);

  if (erro) return <div style={{ padding: 24 }}>Falha ao carregar a RDV.</div>;
  if (!r) return <div style={{ padding: 24 }}>Carregando…</div>;

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto', fontFamily: 'Arial, sans-serif', color: '#111' }}>
      <div className="print:hidden" style={{ marginBottom: 16 }}>
        <button onClick={() => navigate(`/supervisores/viagens/${id}`)} style={{ marginRight: 8, padding: '6px 12px' }}>← Voltar</button>
        <button onClick={() => window.print()} style={{ padding: '6px 12px' }}>Imprimir</button>
      </div>

      <h2 style={{ textAlign: 'center', margin: '0 0 4px' }}>RELATÓRIO DE DESPESAS DE VIAGEM (RDV)</h2>
      <p style={{ textAlign: 'center', margin: '0 0 12px', fontSize: 12 }}>Viagem #{r.viagem.numero} · Mês {fmtMes(r.viagem.mesReferencia)}</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
        <tbody>
          <tr><td style={cell}><b>Funcionário:</b> {r.supervisor.nome ?? '—'}</td><td style={cell}><b>Matrícula:</b> {r.supervisor.matricula ?? '—'}</td></tr>
          <tr><td style={cell}><b>Veículo:</b> {r.veiculo ? `${r.veiculo.placa}${r.veiculo.modelo ? ` (${r.veiculo.modelo})` : ''}` : '—'}</td><td style={cell}></td></tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Dia</th>
            <th style={th}>Município(s)</th>
            {r.tipos.map((t) => <th key={t.id} style={th}>{t.nome}</th>)}
            <th style={th}>Total</th>
          </tr>
        </thead>
        <tbody>
          {r.dias.length === 0 ? (
            <tr><td style={cell} colSpan={r.tipos.length + 3}>Sem despesas lançadas.</td></tr>
          ) : r.dias.map((d) => (
            <tr key={d.data}>
              <td style={cell}>{fmtDia(d.data)}</td>
              <td style={cell}>{d.municipios.join(', ') || '—'}</td>
              {r.tipos.map((t) => <td key={t.id} style={cellR}>{d.valores[t.id] ? brl(d.valores[t.id]) : ''}</td>)}
              <td style={{ ...cellR, fontWeight: 700 }}>{brl(d.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td style={{ ...th, textAlign: 'right' }} colSpan={2}>TOTAIS</td>
            {r.tipos.map((t) => <td key={t.id} style={{ ...cellR, fontWeight: 700 }}>{brl(r.totaisPorTipo[t.id] || 0)}</td>)}
            <td style={{ ...cellR, fontWeight: 700 }}>{brl(r.total)}</td>
          </tr>
        </tfoot>
      </table>

      <table style={{ width: 340, borderCollapse: 'collapse', marginTop: 16, marginLeft: 'auto' }}>
        <tbody>
          <tr><td style={cell}>Despesas de veículo</td><td style={cellR}>{brl(r.totaisPorCategoria.VEICULO)}</td></tr>
          <tr><td style={cell}>Despesas de indivíduo</td><td style={cellR}>{brl(r.totaisPorCategoria.INDIVIDUO)}</td></tr>
          <tr><td style={{ ...cell, fontWeight: 700 }}>Total de despesas</td><td style={{ ...cellR, fontWeight: 700 }}>{brl(r.total)}</td></tr>
          <tr><td style={cell}>Adiantamento</td><td style={cellR}>{brl(r.adiantamento)}</td></tr>
          <tr><td style={{ ...cell, fontWeight: 700, background: '#f3f3f3' }}>{r.saldo >= 0 ? 'A devolver à CAPUL' : 'A reembolsar'}</td><td style={{ ...cellR, fontWeight: 700, background: '#f3f3f3' }}>{brl(Math.abs(r.saldo))}</td></tr>
        </tbody>
      </table>

      <div style={{ marginTop: 56, display: 'flex', justifyContent: 'space-around', fontSize: 12 }}>
        <div style={{ textAlign: 'center' }}>____________________________<br />Supervisor</div>
        <div style={{ textAlign: 'center' }}>____________________________<br />Conferido por</div>
      </div>
    </div>
  );
}
