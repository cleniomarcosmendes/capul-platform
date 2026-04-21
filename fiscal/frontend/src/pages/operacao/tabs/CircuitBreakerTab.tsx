import { useEffect, useState } from 'react';
import { fiscalApi } from '../../../services/api';
import { Badge } from '../../../components/Badge';

interface UfCircuit {
  uf: string;
  estado: 'FECHADO' | 'MEIO_ABERTO' | 'ABERTO';
  errosRecentes: number;
  abertoEm: string | null;
  retomadaEm: string | null;
  motivoBloqueio: string | null;
  ultimaAtualizacao: string;
}

export function CircuitBreakerTab() {
  const [circuits, setCircuits] = useState<UfCircuit[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setLoading(true);
      const { data } = await fiscalApi.get<UfCircuit[]>('/cruzamento/circuit-breaker');
      setCircuits(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 15_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
        Cada SEFAZ estadual tem um disjuntor próprio. UFs com 3 ou mais erros consecutivos ficam
        bloqueadas por 30 minutos automaticamente (estado <strong>ABERTO</strong>), depois entram
        em <strong>MEIO_ABERTO</strong> para testar recuperação e voltam a <strong>FECHADO</strong>{' '}
        se respondem bem. Protege contra cascata de falhas quando uma UF está instável.
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-5 text-slate-500">Carregando…</div>
        ) : circuits.length === 0 ? (
          <div className="p-5 text-sm text-slate-500">
            Nenhum estado registrado — nenhuma UF apresentou falhas recentes.
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-5 py-2">UF</th>
                <th className="px-5 py-2">Estado</th>
                <th className="px-5 py-2">Erros</th>
                <th className="px-5 py-2">Retoma em</th>
                <th className="px-5 py-2">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {circuits.map((c) => (
                <tr key={c.uf} className="border-b border-slate-100">
                  <td className="px-5 py-2 font-mono font-semibold">{c.uf}</td>
                  <td className="px-5 py-2">
                    <Badge
                      variant={
                        c.estado === 'FECHADO' ? 'green' : c.estado === 'MEIO_ABERTO' ? 'yellow' : 'red'
                      }
                    >
                      {c.estado}
                    </Badge>
                  </td>
                  <td className="px-5 py-2">{c.errosRecentes}</td>
                  <td className="px-5 py-2 text-xs text-slate-600">
                    {c.retomadaEm ? new Date(c.retomadaEm).toLocaleString('pt-BR') : '-'}
                  </td>
                  <td className="px-5 py-2 text-xs text-slate-600">{c.motivoBloqueio ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
