import { useEffect, useState, type CSSProperties } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { logisticaApi } from '../services/api';
import { fmtDateTime } from './frota-utils';

interface Acerto {
  viagem: {
    numero: number; situacao: string; placa: string; modelo?: string | null;
    condutorNome?: string | null; condutorMatricula?: string | null;
    finalidade?: string | null; localSaida?: string | null;
    dataHoraSaida?: string | null; dataHoraChegada?: string | null;
    kmInicial?: number | null; kmFinal?: number | null; kmRodado?: number | null;
  };
  despesas: { id: string; data?: string | null; tipo: string; categoria: string; valor: number; situacao: string; fornecedor?: string | null }[];
  totalDespesas: number; adiantamento: number; saldo: number;
}

const brl = (v: number) => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDia = (s?: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }) : '—');
const SIT: Record<string, string> = { PENDENTE: 'Pendente', APROVADA: 'Aprovada', CONTESTADA: 'Rejeitada' };

const cell: CSSProperties = { border: '1px solid #333', padding: '4px 6px', fontSize: 11 };
const cellR: CSSProperties = { ...cell, textAlign: 'right' };
const th: CSSProperties = { ...cell, background: '#eee', fontWeight: 700, textAlign: 'center' };

export function AcertoViagemPrintPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [a, setA] = useState<Acerto | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    logisticaApi.get<Acerto>(`/frota/viagens/${id}/acerto`).then((res) => setA(res.data)).catch(() => setErro(true));
  }, [id]);

  if (erro) return <div style={{ padding: 24 }}>Falha ao carregar o acerto.</div>;
  if (!a) return <div style={{ padding: 24 }}>Carregando…</div>;
  const v = a.viagem;

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto', fontFamily: 'Arial, sans-serif', color: '#111' }}>
      <div className="print:hidden" style={{ marginBottom: 16 }}>
        <button onClick={() => navigate(`/frota/viagens/${id}`)} style={{ marginRight: 8, padding: '6px 12px' }}>← Voltar</button>
        <button onClick={() => window.print()} style={{ padding: '6px 12px' }}>Imprimir</button>
      </div>

      <h2 style={{ textAlign: 'center', margin: '0 0 4px' }}>ACERTO DE VIAGEM</h2>
      <p style={{ textAlign: 'center', margin: '0 0 12px', fontSize: 12 }}>Rota #{v.numero} · {v.placa}{v.modelo ? ` — ${v.modelo}` : ''}</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
        <tbody>
          <tr><td style={cell}><b>Condutor:</b> {v.condutorNome ?? '—'}</td><td style={cell}><b>Matrícula:</b> {v.condutorMatricula ?? '—'}</td></tr>
          <tr><td style={cell}><b>Saída:</b> {fmtDateTime(v.dataHoraSaida)}</td><td style={cell}><b>Retorno:</b> {fmtDateTime(v.dataHoraChegada)}</td></tr>
          <tr><td style={cell}><b>KM rodado:</b> {v.kmRodado != null ? `${v.kmRodado} km` : '—'}</td><td style={cell}><b>Finalidade:</b> {v.finalidade ?? '—'}</td></tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Data</th>
            <th style={th}>Tipo</th>
            <th style={th}>Fornecedor</th>
            <th style={th}>Situação</th>
            <th style={th}>Valor</th>
          </tr>
        </thead>
        <tbody>
          {a.despesas.length === 0 ? (
            <tr><td style={cell} colSpan={5}>Sem despesas lançadas.</td></tr>
          ) : a.despesas.map((d) => (
            <tr key={d.id}>
              <td style={cell}>{fmtDia(d.data)}</td>
              <td style={cell}>{d.tipo}</td>
              <td style={cell}>{d.fornecedor ?? '—'}</td>
              <td style={cell}>{SIT[d.situacao] ?? d.situacao}</td>
              <td style={cellR}>{brl(d.valor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: 10, color: '#666', margin: '6px 0 0' }}>Só despesas <b>Aprovadas</b> entram no saldo abaixo.</p>

      <table style={{ width: 340, borderCollapse: 'collapse', marginTop: 16, marginLeft: 'auto' }}>
        <tbody>
          <tr><td style={{ ...cell, fontWeight: 700 }}>Total de despesas (aprovadas)</td><td style={{ ...cellR, fontWeight: 700 }}>{brl(a.totalDespesas)}</td></tr>
          <tr><td style={cell}>Adiantamento</td><td style={cellR}>{brl(a.adiantamento)}</td></tr>
          <tr><td style={{ ...cell, fontWeight: 700, background: '#f3f3f3' }}>{a.saldo >= 0 ? 'A devolver à empresa' : 'A pagar ao condutor'}</td><td style={{ ...cellR, fontWeight: 700, background: '#f3f3f3' }}>{brl(Math.abs(a.saldo))}</td></tr>
        </tbody>
      </table>

      <div style={{ marginTop: 56, display: 'flex', justifyContent: 'space-around', fontSize: 12 }}>
        <div style={{ textAlign: 'center' }}>____________________________<br />Condutor</div>
        <div style={{ textAlign: 'center' }}>____________________________<br />Conferido por</div>
      </div>
    </div>
  );
}
