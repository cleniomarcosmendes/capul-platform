import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2, Plus } from 'lucide-react';
import { coreApi, logisticaApi } from '../services/api';

// Frota (padrão workspace): LISTA em grid ordenável + chips de situação;
// clique na linha abre o form de edição (/veiculos/:id/editar).

interface CoreItem { id: string; nome?: string; codigo?: string; nomeFantasia?: string }
interface Veiculo {
  id: string; placa: string; modelo?: string | null; marca?: string | null;
  ano?: number | null; tipo: string; propriedade?: string; situacao: string; kmAtual: number;
  filialId: string; supervisorId: string;
}

const labelCore = (i?: CoreItem) => (i ? i.nomeFantasia || i.nome || i.codigo || i.id.slice(0, 8) : '—');

const SIT_META: Record<string, { label: string; cls: string }> = {
  DISPONIVEL: { label: 'Disponível', cls: 'bg-emerald-100 text-emerald-700' },
  EM_USO: { label: 'Em uso', cls: 'bg-sky-100 text-sky-700' },
  EM_MANUTENCAO: { label: 'Em manutenção', cls: 'bg-amber-100 text-amber-700' },
  BAIXADO: { label: 'Baixado', cls: 'bg-rose-100 text-rose-700' },
};

type SortKey = 'placa' | 'modelo' | 'tipo' | 'situacao' | 'supervisor' | 'kmAtual';
type SortDir = 'asc' | 'desc';

export function VeiculosPage() {
  const navigate = useNavigate();
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [usuarios, setUsuarios] = useState<CoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [situacaoSel, setSituacaoSel] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('placa');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const [v, u] = await Promise.all([
          logisticaApi.get<Veiculo[]>('/veiculos', { params: situacaoSel ? { situacao: situacaoSel } : undefined }),
          coreApi.get<CoreItem[]>('/usuarios').catch(() => ({ data: [] })),
        ]);
        setVeiculos(v.data); setUsuarios(u.data);
      } finally { setLoading(false); }
    })();
  }, [situacaoSel]);

  const nomeSupervisor = (id: string) => labelCore(usuarios.find((x) => x.id === id));

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }
  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 text-slate-300" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-sky-600" /> : <ArrowDown className="h-3 w-3 text-sky-600" />;
  };

  const ordenados = useMemo(() => {
    const val = (v: Veiculo, k: SortKey): string | number => {
      switch (k) {
        case 'modelo': return `${v.marca ?? ''} ${v.modelo ?? ''}`.trim();
        case 'supervisor': return nomeSupervisor(v.supervisorId);
        default: return (v[k] as string | number) ?? '';
      }
    };
    const arr = [...veiculos];
    arr.sort((a, b) => {
      const va = val(a, sortKey); const vb = val(b, sortKey);
      const cmp = typeof va === 'number' || typeof vb === 'number'
        ? Number(va) - Number(vb)
        : String(va).localeCompare(String(vb), 'pt-BR');
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [veiculos, sortKey, sortDir, usuarios]);

  const th = 'px-3 py-2.5';
  const btnSort = 'flex items-center gap-1 hover:text-slate-700';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Frota</h2>
          <p className="text-sm text-slate-500">Veículos da logística — clique numa linha para editar.</p>
        </div>
        <Link to="/veiculos/novo" className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700">
          <Plus className="h-4 w-4" /> Novo veículo
        </Link>
      </div>

      <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-4">
        <button onClick={() => setSituacaoSel('')}
          className={`rounded-full px-3 py-1 text-xs font-medium ${situacaoSel === '' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
          Todos
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
        ) : ordenados.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">Nenhum veículo{situacaoSel ? ' nessa situação' : ' cadastrado'}.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className={th}><button onClick={() => toggleSort('placa')} className={btnSort}>Placa <SortIcon col="placa" /></button></th>
                <th className={th}><button onClick={() => toggleSort('modelo')} className={btnSort}>Veículo <SortIcon col="modelo" /></button></th>
                <th className={th}><button onClick={() => toggleSort('tipo')} className={btnSort}>Tipo <SortIcon col="tipo" /></button></th>
                <th className={th}><button onClick={() => toggleSort('situacao')} className={btnSort}>Situação <SortIcon col="situacao" /></button></th>
                <th className={th}><button onClick={() => toggleSort('supervisor')} className={btnSort}>Supervisor <SortIcon col="supervisor" /></button></th>
                <th className={`${th} text-right`}><button onClick={() => toggleSort('kmAtual')} className={`${btnSort} ml-auto`}>KM <SortIcon col="kmAtual" /></button></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ordenados.map((v) => {
                const sit = SIT_META[v.situacao] ?? { label: v.situacao, cls: 'bg-slate-100 text-slate-600' };
                return (
                  <tr key={v.id} onClick={() => navigate(`/veiculos/${v.id}/editar`)} className="cursor-pointer hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono font-medium text-slate-700">{v.placa}</td>
                    <td className="px-3 py-2 text-slate-600">{[v.marca, v.modelo].filter(Boolean).join(' ') || '—'}{v.ano ? ` · ${v.ano}` : ''}</td>
                    <td className="px-3 py-2 text-slate-500">{v.tipo}{v.propriedade === 'ALUGADO' ? ' · Alugado' : ''}</td>
                    <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-xs font-medium ${sit.cls}`}>{sit.label}</span></td>
                    <td className="px-3 py-2 text-slate-600">{nomeSupervisor(v.supervisorId)}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-600">{v.kmAtual}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-xs text-slate-400">{ordenados.length} veículo{ordenados.length === 1 ? '' : 's'} · clique no cabeçalho para ordenar</p>
    </div>
  );
}
