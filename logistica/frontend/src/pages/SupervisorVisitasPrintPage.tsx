import { useEffect, useState, type CSSProperties } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { logisticaApi } from '../services/api';

// Relatório de visitas MENSAL: fechamento é mensal, então lista TODAS as visitas
// do supervisor no mês (de todos os planejamentos), não de uma viagem só.
interface Visita {
  id: string; planejamentoNumero: number; sequencia: number;
  clienteMatricula?: string | null; clienteNome?: string | null;
  municipio?: string | null; propriedade?: string | null; observacao?: string | null; dataHora?: string | null;
  status?: 'PLANEJADA' | 'REALIZADA' | 'PULADA' | null; motivoPulada?: string | null;
  atividade?: { nome: string } | null;
}
const SITUACAO: Record<string, string> = { REALIZADA: 'Realizada', PULADA: 'Pulada', PLANEJADA: 'Planejada' };
interface RdvMensal {
  supervisor: { id: string; nome: string; matricula: string };
  mesReferencia: number;
  planejamentosLista: { id: string; numero: number; statusPlanejamento?: string | null }[];
  visitas: Visita[];
}

const fmtMes = (m?: number | null) => (m ? `${String(m % 100).padStart(2, '0')}/${Math.floor(m / 100)}` : '—');
const fmtData = (s?: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—');

const cell: CSSProperties = { border: '1px solid #333', padding: '4px 6px', fontSize: 11 };
const th: CSSProperties = { ...cell, background: '#eee', fontWeight: 700, textAlign: 'center' };

export function SupervisorVisitasPrintPage() {
  const { supervisorId, mes } = useParams<{ supervisorId: string; mes: string }>();
  const navigate = useNavigate();
  const [r, setR] = useState<RdvMensal | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    logisticaApi.get<RdvMensal>('/supervisor/rdv-mensal', { params: { supervisorId, mes } })
      .then((res) => setR(res.data)).catch(() => setErro(true));
  }, [supervisorId, mes]);

  if (erro) return <div style={{ padding: 24 }}>Falha ao carregar as visitas.</div>;
  if (!r) return <div style={{ padding: 24 }}>Carregando…</div>;

  const visitas = r.visitas;
  const realizadas = visitas.filter((p) => (p.status ?? 'REALIZADA') === 'REALIZADA').length;
  const puladas = visitas.filter((p) => p.status === 'PULADA').length;

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto', fontFamily: 'Arial, sans-serif', color: '#111' }}>
      <div className="print:hidden" style={{ marginBottom: 16 }}>
        <button onClick={() => navigate('/supervisores')} style={{ marginRight: 8, padding: '6px 12px' }}>← Voltar</button>
        <button onClick={() => window.print()} style={{ padding: '6px 12px' }}>Imprimir</button>
      </div>

      <h2 style={{ textAlign: 'center', margin: '0 0 4px' }}>RELATÓRIO DE VISITAS — MENSAL</h2>
      <p style={{ textAlign: 'center', margin: '0 0 4px', fontSize: 12 }}>
        Mês {fmtMes(r.mesReferencia)} · Supervisor: {r.supervisor.nome} ({r.supervisor.matricula})
      </p>
      <p style={{ textAlign: 'center', margin: '0 0 12px', fontSize: 11, color: '#555' }}>
        {r.planejamentosLista.length} planejamento(s) no mês: {r.planejamentosLista.map((p) => `#${p.numero}`).join(', ') || '—'}
      </p>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Planej.</th>
            <th style={th}>Data</th>
            <th style={th}>Situação</th>
            <th style={th}>Cliente (matrícula)</th>
            <th style={th}>Propriedade</th>
            <th style={th}>Município</th>
            <th style={th}>Atividade</th>
            <th style={th}>Obs / Motivo</th>
          </tr>
        </thead>
        <tbody>
          {visitas.length === 0 ? (
            <tr><td style={cell} colSpan={8}>Nenhuma visita registrada no mês.</td></tr>
          ) : visitas.map((p) => {
            const pulada = p.status === 'PULADA';
            return (
              <tr key={p.id} style={pulada ? { background: '#fafafa', color: '#666' } : undefined}>
                <td style={{ ...cell, textAlign: 'center' }}>#{p.planejamentoNumero}</td>
                <td style={cell}>{fmtData(p.dataHora)}</td>
                <td style={{ ...cell, textAlign: 'center', fontWeight: pulada ? 700 : 400 }}>{SITUACAO[p.status ?? 'REALIZADA'] ?? p.status ?? '—'}</td>
                <td style={cell}>{p.clienteNome ?? '—'}{p.clienteMatricula ? ` (${p.clienteMatricula})` : ''}</td>
                <td style={cell}>{p.propriedade ?? '—'}</td>
                <td style={cell}>{p.municipio ?? '—'}</td>
                <td style={cell}>{p.atividade?.nome ?? '—'}</td>
                <td style={cell}>{pulada ? (p.motivoPulada ? `Pulada — ${p.motivoPulada}` : 'Pulada (sem motivo)') : (p.observacao ?? '—')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p style={{ marginTop: 12, fontSize: 12 }}>
        Total: <b>{visitas.length}</b> · Realizadas: <b>{realizadas}</b> · Puladas: <b>{puladas}</b>
      </p>

      <div style={{ marginTop: 56, display: 'flex', justifyContent: 'space-around', fontSize: 12 }}>
        <div style={{ textAlign: 'center' }}>____________________________<br />Supervisor</div>
        <div style={{ textAlign: 'center' }}>____________________________<br />Conferido por</div>
      </div>
    </div>
  );
}
