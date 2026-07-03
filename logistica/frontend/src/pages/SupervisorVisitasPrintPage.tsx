import { useEffect, useState, type CSSProperties } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { logisticaApi } from '../services/api';

interface Visita {
  id: string; sequencia: number; clienteMatricula?: string | null; clienteNome?: string | null;
  municipio?: string | null; propriedade?: string | null; observacao?: string | null; dataHora?: string | null;
  atividade?: { nome: string } | null;
}
interface Detalhe {
  numero: number; mesReferencia?: number | null; condutorNome?: string | null; condutorMatricula?: string | null;
  paradas: Visita[];
}

const fmtMes = (m?: number | null) => (m ? `${String(m % 100).padStart(2, '0')}/${Math.floor(m / 100)}` : '—');
const fmtData = (s?: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—');

const cell: CSSProperties = { border: '1px solid #333', padding: '4px 6px', fontSize: 11 };
const th: CSSProperties = { ...cell, background: '#eee', fontWeight: 700, textAlign: 'center' };

export function SupervisorVisitasPrintPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [v, setV] = useState<Detalhe | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    logisticaApi.get<Detalhe>(`/supervisor/viagens/${id}`).then((res) => setV(res.data)).catch(() => setErro(true));
  }, [id]);

  if (erro) return <div style={{ padding: 24 }}>Falha ao carregar as visitas.</div>;
  if (!v) return <div style={{ padding: 24 }}>Carregando…</div>;

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto', fontFamily: 'Arial, sans-serif', color: '#111' }}>
      <div className="print:hidden" style={{ marginBottom: 16 }}>
        <button onClick={() => navigate(`/supervisores/viagens/${id}`)} style={{ marginRight: 8, padding: '6px 12px' }}>← Voltar</button>
        <button onClick={() => window.print()} style={{ padding: '6px 12px' }}>Imprimir</button>
      </div>

      <h2 style={{ textAlign: 'center', margin: '0 0 4px' }}>RELATÓRIO DE VISITAS</h2>
      <p style={{ textAlign: 'center', margin: '0 0 12px', fontSize: 12 }}>
        Viagem #{v.numero} · Mês {fmtMes(v.mesReferencia)} · Supervisor: {v.condutorNome ?? '—'}
      </p>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Data</th>
            <th style={th}>Cliente (matrícula)</th>
            <th style={th}>Propriedade</th>
            <th style={th}>Município</th>
            <th style={th}>Atividade</th>
            <th style={th}>Obs</th>
          </tr>
        </thead>
        <tbody>
          {v.paradas.length === 0 ? (
            <tr><td style={cell} colSpan={6}>Nenhuma visita registrada.</td></tr>
          ) : v.paradas.map((p) => (
            <tr key={p.id}>
              <td style={cell}>{fmtData(p.dataHora)}</td>
              <td style={cell}>{p.clienteNome ?? '—'}{p.clienteMatricula ? ` (${p.clienteMatricula})` : ''}</td>
              <td style={cell}>{p.propriedade ?? '—'}</td>
              <td style={cell}>{p.municipio ?? '—'}</td>
              <td style={cell}>{p.atividade?.nome ?? '—'}</td>
              <td style={cell}>{p.observacao ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ marginTop: 12, fontSize: 12 }}>Total de visitas: <b>{v.paradas.length}</b></p>

      <div style={{ marginTop: 56, display: 'flex', justifyContent: 'space-around', fontSize: 12 }}>
        <div style={{ textAlign: 'center' }}>____________________________<br />Supervisor</div>
        <div style={{ textAlign: 'center' }}>____________________________<br />Conferido por</div>
      </div>
    </div>
  );
}
