import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowUpDown, FileText, Loader2, Truck } from 'lucide-react';
import { logisticaApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

// Viagens (padrão workspace, redesenho 12/06): LISTA em grid ordenável +
// chips de situação; clique abre o detalhe (/viagens/:id); a montagem vive
// em página própria (/viagens/montar).

interface Viagem {
  id: string; numero: number; situacao: string; criadoEm: string;
  veiculo?: { placa: string } | null; _count?: { paradas: number };
  motoristaNome?: string | null; totalVolumes?: number;
}

const SIT_META: Record<string, { label: string; cls: string }> = {
  RASCUNHO: { label: 'Rascunho', cls: 'bg-sky-100 text-sky-700' },
  EM_CURSO: { label: 'Em curso', cls: 'bg-amber-100 text-amber-700' },
  CONCLUIDA: { label: 'Concluída', cls: 'bg-emerald-100 text-emerald-700' },
  CANCELADA: { label: 'Cancelada', cls: 'bg-slate-100 text-slate-500' },
};

type SortKey = 'numero' | 'criadoEm' | 'placa' | 'motoristaNome' | 'paradas' | 'totalVolumes' | 'situacao';
type SortDir = 'asc' | 'desc';

export function ViagensPage() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const filialId = usuario?.filialAtual?.id ?? usuario?.filiais?.[0]?.id ?? '';

  const [viagens, setViagens] = useState<Viagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [situacaoSel, setSituacaoSel] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('numero');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const params: Record<string, string> = {};
        if (filialId) params.filialId = filialId;
        if (situacaoSel) params.situacao = situacaoSel;
        const { data } = await logisticaApi.get<Viagem[]>('/viagens', { params });
        setViagens(data);
      } finally { setLoading(false); }
    })();
  }, [filialId, situacaoSel]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }
  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 text-slate-300" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-sky-600" /> : <ArrowDown className="h-3 w-3 text-sky-600" />;
  };

  const ordenadas = useMemo(() => {
    const val = (v: Viagem, k: SortKey): string | number => {
      switch (k) {
        case 'placa': return v.veiculo?.placa ?? '';
        case 'paradas': return v._count?.paradas ?? 0;
        case 'motoristaNome': return v.motoristaNome ?? '';
        case 'totalVolumes': return v.totalVolumes ?? 0;
        default: return v[k] as string | number;
      }
    };
    const arr = [...viagens];
    arr.sort((a, b) => {
      const va = val(a, sortKey); const vb = val(b, sortKey);
      const cmp = typeof va === 'number' || typeof vb === 'number'
        ? Number(va) - Number(vb)
        : String(va).localeCompare(String(vb), 'pt-BR');
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [viagens, sortKey, sortDir]);

  const th = 'px-3 py-2.5';
  const btnSort = 'flex items-center gap-1 hover:text-slate-700';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Viagens</h2>
          <p className="text-sm text-slate-500">Clique numa viagem para ver as paradas, despachar e dar baixas.</p>
        </div>
        <Link to="/viagens/montar" className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700">
          <Truck className="h-4 w-4" /> Montar viagem
        </Link>
      </div>

      <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-4">
        <button onClick={() => setSituacaoSel('')}
          className={`rounded-full px-3 py-1 text-xs font-medium ${situacaoSel === '' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
          Todas
        </button>
        {Object.entries(SIT_META).map(([k, m]) => (
          <button key={k} onClick={() => setSituacaoSel(k)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${situacaoSel === k ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {m.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="p-6 text-sm text-slate-500"><Loader2 className="inline h-4 w-4 animate-spin" /> Carregando…</div>
        ) : ordenadas.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">Nenhuma viagem{situacaoSel ? ' nessa situação' : ''}.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className={th}><button onClick={() => toggleSort('numero')} className={btnSort}>Nº <SortIcon col="numero" /></button></th>
                <th className={th}><button onClick={() => toggleSort('criadoEm')} className={btnSort}>Criada <SortIcon col="criadoEm" /></button></th>
                <th className={th}><button onClick={() => toggleSort('placa')} className={btnSort}>Veículo <SortIcon col="placa" /></button></th>
                <th className={th}><button onClick={() => toggleSort('motoristaNome')} className={btnSort}>Motorista <SortIcon col="motoristaNome" /></button></th>
                <th className={th}><button onClick={() => toggleSort('paradas')} className={btnSort}>Paradas <SortIcon col="paradas" /></button></th>
                <th className={th}><button onClick={() => toggleSort('totalVolumes')} className={btnSort}>Vol. <SortIcon col="totalVolumes" /></button></th>
                <th className={th}><button onClick={() => toggleSort('situacao')} className={btnSort}>Situação <SortIcon col="situacao" /></button></th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ordenadas.map((v) => {
                const sit = SIT_META[v.situacao] ?? { label: v.situacao, cls: 'bg-slate-100 text-slate-600' };
                return (
                  <tr key={v.id} onClick={() => navigate(`/viagens/${v.id}`)} className="cursor-pointer hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-700">#{v.numero}</td>
                    <td className="px-3 py-2 text-slate-500">{new Date(v.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-3 py-2 text-slate-600">{v.veiculo?.placa ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{v.motoristaNome ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{v._count?.paradas ?? 0}</td>
                    <td className="px-3 py-2 text-slate-600">{v.totalVolumes ?? 0}</td>
                    <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-xs font-medium ${sit.cls}`}>{sit.label}</span></td>
                    <td className="px-3 py-2 text-right" onClick={(ev) => ev.stopPropagation()}>
                      <a href={`/entregas/romaneio/viagem/${v.id}`} target="_blank" rel="noopener" title="Romaneio"
                        className="inline-flex text-slate-300 hover:text-sky-600"><FileText className="h-4 w-4" /></a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-xs text-slate-400">{ordenadas.length} viagem{ordenadas.length === 1 ? '' : 'ns'} · clique no cabeçalho para ordenar</p>
    </div>
  );
}
