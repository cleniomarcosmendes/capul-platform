import { useEffect, useRef, useState, useCallback } from 'react';
import { Network, Play, RefreshCw, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { fiscalApi } from '../../../services/api';
import { Button } from '../../../components/Button';
import { useToast } from '../../../components/Toast';
import { useConfirm } from '../../../components/ConfirmDialog';
import { useAuth } from '../../../contexts/AuthContext';
import { extractApiError } from '../../../utils/errors';
import { PageWrapper } from '../../../components/PageWrapper';

interface Row {
  id: number; cnpj: string; origem: string; razaoProtheus: string | null;
  razaoRfb: string | null; situacaoRfb: string | null; ufRfb: string | null;
  bloqueado: boolean; achadoRfb: boolean; optanteSimples: string | null; alerta: string;
}
interface Exec {
  id: number; status: string; iniciado: string; fim: string | null; total: number | null;
  alertaIrregular: number | null; alertaAtencao: number | null; alertaOk: number | null;
  naoEncontrado: number | null; observacao: string | null;
}
interface Resp { itens: Row[]; total: number; page: number; pageSize: number; execucoes: Exec[] }

const ALERTA_CLS: Record<string, string> = {
  OK: 'bg-green-100 text-green-800',
  ATENCAO: 'bg-amber-100 text-amber-800',
  IRREGULAR: 'bg-red-100 text-red-800',
  NAO_ENCONTRADO: 'bg-slate-100 text-slate-600',
};

/** Aba "Cruzamento CNPJ" — o payoff do achado: clientes/fornecedores do
 *  Protheus × base RFB local, sem certificado/SEFAZ. Snapshot consultável. */
export function RfbCruzamentoTab() {
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [f, setF] = useState({
    alerta: '', origem: '', uf: '', search: '', page: 1,
    sort: '' as string, dir: 'asc' as 'asc' | 'desc',
  });
  const toast = useToast();
  const confirm = useConfirm();
  const { fiscalRole } = useAuth();
  const isAdmin = fiscalRole === 'ADMIN_TI';
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const carregar = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (f.alerta) params.set('alerta', f.alerta);
      if (f.origem) params.set('origem', f.origem);
      if (f.uf) params.set('uf', f.uf);
      if (f.search) params.set('search', f.search);
      if (f.sort) { params.set('sort', f.sort); params.set('dir', f.dir); }
      params.set('page', String(f.page));
      const { data } = await fiscalApi.get<Resp>(`/rfb/cruzamento?${params}`);
      setData(data);
    } catch (e) {
      toast.error(extractApiError(e));
    } finally {
      setLoading(false);
    }
  }, [f, toast]);

  useEffect(() => {
    carregar();
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [carregar]);

  useEffect(() => {
    const rodando = data?.execucoes?.[0]?.status === 'RODANDO';
    if (rodando && !timer.current) timer.current = setInterval(carregar, 5000);
    else if (!rodando && timer.current) { clearInterval(timer.current); timer.current = null; }
  }, [data, carregar]);

  async function rodar() {
    const ok = await confirm({
      title: 'Rodar cruzamento SA1+SA2 × RFB?',
      description:
        'Coleta clientes e fornecedores do Protheus e cruza com a base CNPJ local ' +
        '(sem certificado, sem SEFAZ — zero risco). Roda em background; o snapshot ' +
        'anterior é substituído. Requer a base RFB já importada.',
      variant: 'info',
      confirmLabel: 'Rodar agora',
    });
    if (!ok) return;
    setActing(true);
    try {
      await fiscalApi.post('/rfb/cruzamento');
      toast.success('Cruzamento iniciado');
      await carregar();
    } catch (e) {
      toast.error(extractApiError(e));
    } finally {
      setActing(false);
    }
  }

  const ex = data?.execucoes?.[0];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  // Cabeçalho clicável: 1º clique ordena asc, 2º no mesmo desc; troca de
  // coluna volta a asc. Reseta página. Ordenação é server-side (whitelist).
  const Th = ({ col, label }: { col: string; label: string }) => {
    const active = f.sort === col;
    const Icon = active ? (f.dir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown;
    return (
      <th className="px-3 py-2">
        <button
          type="button"
          onClick={() => setF((p) => ({
            ...p, page: 1, sort: col,
            dir: p.sort === col && p.dir === 'asc' ? 'desc' : 'asc',
          }))}
          className={`inline-flex items-center gap-1 hover:text-slate-800 ${active ? 'text-slate-800 font-semibold' : ''}`}
          title="Ordenar"
        >
          {label}
          <Icon className={`h-3 w-3 ${active ? 'text-capul-600' : 'text-slate-300'}`} />
        </button>
      </th>
    );
  };

  if (loading) {
    return (
      <PageWrapper title="Cruzamento CNPJ × RFB">
        <div className="text-sm text-slate-500">Carregando…</div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="Cruzamento CNPJ × RFB">
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <Network className="h-5 w-5 flex-shrink-0 text-capul-600" />
        <p>
          Cruza <strong>clientes (SA1) + fornecedores (SA2)</strong> do Protheus contra a
          <strong> base pública CNPJ local</strong> — sem certificado, sem SEFAZ, zero risco
          de bloqueio. Alerta por situação cadastral RFB. O snapshot é gerado sob demanda
          (ADMIN_TI) e consultado aqui.
        </p>
      </div>

      {/* Resumo última execução */}
      {ex && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            ['Total', ex.total, 'text-slate-800'],
            ['Irregular', ex.alertaIrregular, 'text-red-600'],
            ['Atenção', ex.alertaAtencao, 'text-amber-600'],
            ['OK', ex.alertaOk, 'text-green-600'],
            ['Não na RFB', ex.naoEncontrado, 'text-slate-500'],
          ].map(([lbl, val, cls]) => (
            <div key={lbl as string} className="rounded-lg border border-slate-200 p-3">
              <div className="text-xs text-slate-500">{lbl as string}</div>
              <div className={`mt-1 text-lg font-semibold ${cls as string}`}>
                {(val as number | null)?.toLocaleString('pt-BR') ?? '—'}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span>
          Última execução: <strong>{ex?.status ?? '—'}</strong>
          {ex?.observacao ? ` · ${ex.observacao}` : ''}
          {ex?.fim ? ` · ${new Date(ex.fim).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}` : ''}
        </span>
        {isAdmin && (
          <Button size="sm" onClick={rodar} disabled={acting || ex?.status === 'RODANDO'}>
            <Play className="mr-1 h-3.5 w-3.5" /> Rodar cruzamento
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => carregar()} disabled={acting}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <select className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          value={f.alerta} onChange={(e) => setF({ ...f, alerta: e.target.value, page: 1 })}>
          <option value="">Todos os alertas</option>
          <option value="IRREGULAR">Irregular</option>
          <option value="ATENCAO">Atenção</option>
          <option value="OK">OK</option>
          <option value="NAO_ENCONTRADO">Não na RFB</option>
        </select>
        <select className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          value={f.origem} onChange={(e) => setF({ ...f, origem: e.target.value, page: 1 })}>
          <option value="">SA1 + SA2</option>
          <option value="SA1010">Clientes (SA1)</option>
          <option value="SA2010">Fornecedores (SA2)</option>
        </select>
        <input className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          placeholder="UF" maxLength={2} value={f.uf}
          onChange={(e) => setF({ ...f, uf: e.target.value.toUpperCase(), page: 1 })} />
        <input className="flex-1 min-w-[180px] rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          placeholder="Buscar CNPJ ou razão social" value={f.search}
          onChange={(e) => setF({ ...f, search: e.target.value, page: 1 })} />
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <Th col="cnpj" label="CNPJ" />
              <Th col="origem" label="Origem" />
              <Th col="razaoProtheus" label="Razão (Protheus)" />
              <Th col="razaoRfb" label="Razão (RFB)" />
              <Th col="situacaoRfb" label="Sit. RFB" />
              <Th col="ufRfb" label="UF" />
              <Th col="alerta" label="Alerta" />
            </tr>
          </thead>
          <tbody>
            {(data?.itens ?? []).map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-mono text-xs">{r.cnpj}</td>
                <td className="px-3 py-2 text-xs">{r.origem === 'SA1010' ? 'Cliente' : 'Fornec.'}</td>
                <td className="px-3 py-2">{r.razaoProtheus ?? '—'}</td>
                <td className="px-3 py-2 text-slate-600">{r.razaoRfb ?? '—'}</td>
                <td className="px-3 py-2 text-xs">{r.situacaoRfb ?? '—'}</td>
                <td className="px-3 py-2 text-xs">{r.ufRfb ?? '—'}</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${ALERTA_CLS[r.alerta] ?? 'bg-slate-100'}`}>
                    {r.alerta}
                  </span>
                </td>
              </tr>
            ))}
            {(data?.itens ?? []).length === 0 && (
              <tr><td colSpan={7} className="px-3 py-4 text-center text-slate-400">
                Sem resultados. Rode o cruzamento (precisa da base RFB importada).
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {data && data.total > data.pageSize && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>{data.total.toLocaleString('pt-BR')} registros · página {data.page}/{totalPages}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={f.page <= 1}
              onClick={() => setF({ ...f, page: f.page - 1 })}>Anterior</Button>
            <Button size="sm" variant="secondary" disabled={f.page >= totalPages}
              onClick={() => setF({ ...f, page: f.page + 1 })}>Próxima</Button>
          </div>
        </div>
      )}
    </div>
    </PageWrapper>
  );
}
