import { useEffect, useState, type CSSProperties } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { logisticaApi } from '../services/api';

// RDV MENSAL agregada (redesenho 6b): soma TODOS os planejamentos do supervisor no
// mês (despesas aprovadas, dia × tipo) + os adiantamentos (vários) → saldo.
interface Adiant { id: string; valor: number | string; dataAdiantamento: string; observacao?: string | null }
interface RdvMensal {
  supervisor: { matricula?: string | null; nome?: string | null };
  mesReferencia: number; planejamentos: number;
  planejamentosLista?: { id: string; numero: number; statusPlanejamento?: string | null }[];
  tipos: { id: string; nome: string; categoria: string }[];
  dias: { data: string; municipios: string[]; valores: Record<string, number>; total: number }[];
  totaisPorTipo: Record<string, number>;
  totaisPorCategoria: { VEICULO: number; INDIVIDUO: number };
  total: number; adiantamentos: Adiant[]; totalAdiantamento: number; saldo: number;
}

const brl = (v: number) => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtMes = (m?: number | null) => (m ? `${String(m % 100).padStart(2, '0')}/${Math.floor(m / 100)}` : '—');
const fmtDia = (s: string) => { const p = s.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}` : s; };
const fmtData = (s?: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—');

const cell: CSSProperties = { border: '1px solid #333', padding: '4px 6px', fontSize: 11 };
const cellR: CSSProperties = { ...cell, textAlign: 'right' };
const th: CSSProperties = { ...cell, background: '#eee', fontWeight: 700, textAlign: 'center' };

export function SupervisorRdvMensalPrintPage() {
  const { supervisorId, mes } = useParams<{ supervisorId: string; mes: string }>();
  const navigate = useNavigate();
  const [r, setR] = useState<RdvMensal | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    logisticaApi.get<RdvMensal>('/supervisor/rdv-mensal', { params: { supervisorId, mes } }).then((res) => setR(res.data)).catch(() => setErro(true));
  }, [supervisorId, mes]);

  if (erro) return <div style={{ padding: 24 }}>Falha ao carregar a RDV mensal.</div>;
  if (!r) return <div style={{ padding: 24 }}>Carregando…</div>;

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto', fontFamily: 'Arial, sans-serif', color: '#111' }}>
      <div className="print:hidden" style={{ marginBottom: 16 }}>
        <button onClick={() => navigate('/supervisores')} style={{ marginRight: 8, padding: '6px 12px' }}>← Voltar</button>
        <button onClick={() => window.print()} style={{ padding: '6px 12px' }}>Imprimir</button>
      </div>

      <h2 style={{ textAlign: 'center', margin: '0 0 4px' }}>RELATÓRIO DE DESPESAS DE VIAGEM (RDV) — MENSAL</h2>
      <p style={{ textAlign: 'center', margin: '0 0 12px', fontSize: 12 }}>
        Mês {fmtMes(r.mesReferencia)} · {r.planejamentos} planejamento(s){r.planejamentosLista?.length ? `: ${r.planejamentosLista.map((p) => `#${p.numero}`).join(', ')}` : ''}
      </p>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
        <tbody>
          <tr><td style={cell}><b>Funcionário:</b> {r.supervisor.nome ?? '—'}</td><td style={cell}><b>Matrícula:</b> {r.supervisor.matricula ?? '—'}</td></tr>
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
            <tr><td style={cell} colSpan={r.tipos.length + 3}>Sem despesas aprovadas no mês.</td></tr>
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

      {r.adiantamentos.length > 0 && (
        <table style={{ width: 420, borderCollapse: 'collapse', marginTop: 16 }}>
          <thead><tr><th style={th} colSpan={2}>Adiantamentos do mês</th></tr></thead>
          <tbody>
            {r.adiantamentos.map((a) => (
              <tr key={a.id}><td style={cell}>{fmtData(a.dataAdiantamento)}{a.observacao ? ` · ${a.observacao}` : ''}</td><td style={cellR}>{brl(Number(a.valor))}</td></tr>
            ))}
          </tbody>
        </table>
      )}

      <table style={{ width: 340, borderCollapse: 'collapse', marginTop: 16, marginLeft: 'auto' }}>
        <tbody>
          <tr><td style={cell}>Despesas de veículo</td><td style={cellR}>{brl(r.totaisPorCategoria.VEICULO)}</td></tr>
          <tr><td style={cell}>Despesas de indivíduo</td><td style={cellR}>{brl(r.totaisPorCategoria.INDIVIDUO)}</td></tr>
          <tr><td style={{ ...cell, fontWeight: 700 }}>Total de despesas</td><td style={{ ...cellR, fontWeight: 700 }}>{brl(r.total)}</td></tr>
          <tr><td style={cell}>Adiantamentos ({r.adiantamentos.length})</td><td style={cellR}>{brl(r.totalAdiantamento)}</td></tr>
          <tr><td style={{ ...cell, fontWeight: 700, background: '#f3f3f3' }}>{r.saldo >= 0 ? 'A devolver à CAPUL' : 'A reembolsar'}</td><td style={{ ...cellR, fontWeight: 700, background: '#f3f3f3' }}>{brl(Math.abs(r.saldo))}</td></tr>
        </tbody>
      </table>

      <div style={{ marginTop: 56, display: 'flex', justifyContent: 'space-around', fontSize: 12 }}>
        <div style={{ textAlign: 'center' }}>____________________________<br />Supervisor</div>
        <div style={{ textAlign: 'center' }}>____________________________<br />Coordenador</div>
      </div>
    </div>
  );
}
