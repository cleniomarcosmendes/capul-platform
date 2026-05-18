import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Network, Play, RefreshCw, ChevronUp, ChevronDown, ChevronsUpDown, Download, X } from 'lucide-react';
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
  cnae: string | null; porte: string | null; optanteSimples: string | null;
  dataSituacao: string | null;
  bloqueado: boolean; achadoRfb: boolean; alerta: string;
  similaridadeRazao: number | null; divergenciaRazao: boolean;
}
interface Exec {
  id: number; status: string; iniciado: string; fim: string | null; total: number | null;
  alertaIrregular: number | null; alertaAtencao: number | null; alertaOk: number | null;
  naoEncontrado: number | null; observacao: string | null;
}
interface Resp {
  itens: Row[]; total: number; page: number; pageSize: number;
  execucoes: Exec[]; limiarRazao?: number;
}
type FacetItem = { valor: string; total: number };
interface Facetas {
  total: number; alerta: FacetItem[]; origem: FacetItem[]; situacao: FacetItem[];
  uf: FacetItem[]; porte: FacetItem[]; simples: FacetItem[]; cnaeTop: FacetItem[];
  divergencia: FacetItem[];
}

/** RFB data_situacao = AAAAMMDD. Formata e diz se mudou nos últimos 90d. */
const fmtDataSit = (s: string | null): string => {
  if (!s || !/^\d{8}$/.test(s)) return '—';
  return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
};
const isRecente = (s: string | null): boolean => {
  if (!s || !/^\d{8}$/.test(s)) return false;
  const d = new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`);
  return (Date.now() - d.getTime()) / 86400000 <= 90;
};

const ALERTA_CLS: Record<string, string> = {
  OK: 'bg-green-100 text-green-800',
  ATENCAO: 'bg-amber-100 text-amber-800',
  IRREGULAR: 'bg-red-100 text-red-800',
  NAO_ENCONTRADO: 'bg-slate-100 text-slate-600',
};

/**
 * "Inteligência Cadastral" — exploração estruturada de clientes (SA1) +
 * fornecedores (SA2) do Protheus × base pública CNPJ local. Sem
 * certificado, sem SEFAZ, zero risco. Facetas combináveis, drill-down
 * para a Consulta Cadastral e export. (F3 do plano.)
 */
export function RfbCruzamentoTab() {
  const [data, setData] = useState<Resp | null>(null);
  const [fac, setFac] = useState<Facetas | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [f, setF] = useState({
    alerta: '', origem: '', uf: '', situacao: '', porte: '', simples: '',
    divergencia: '', soRecente: false,
    search: '', page: 1, sort: '' as string, dir: 'asc' as 'asc' | 'desc',
  });
  // Busca com DEBOUNCE: o input mexe só em `searchInput` (imediato); 400ms
  // após parar de digitar, propaga p/ f.search (que dispara carregar). Sem
  // isso cada tecla = 2 fetches (lista+facetas) → estoura o limit_req do
  // nginx (30 r/s) e volta 429 (incidente Clenio 18/05).
  const [searchInput, setSearchInput] = useState('');
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { fiscalRole } = useAuth();
  const isAdmin = fiscalRole === 'ADMIN_TI';
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [limiarInput, setLimiarInput] = useState('');

  useEffect(() => {
    if (data?.limiarRazao != null) setLimiarInput(String(data.limiarRazao));
  }, [data?.limiarRazao]);

  /** Filtros (sem page/sort) — compartilhado por lista, facetas e export. */
  const filtroParams = useCallback(() => {
    const p = new URLSearchParams();
    if (f.alerta) p.set('alerta', f.alerta);
    if (f.origem) p.set('origem', f.origem);
    if (f.uf) p.set('uf', f.uf);
    if (f.situacao) p.set('situacao', f.situacao);
    if (f.porte) p.set('porte', f.porte);
    if (f.simples) p.set('simples', f.simples);
    if (f.divergencia) p.set('divergencia', f.divergencia === 'Sim' ? '1' : '0');
    if (f.soRecente) p.set('soRecente', '1');
    if (f.search) p.set('search', f.search);
    return p;
  }, [f]);

  const carregar = useCallback(async () => {
    try {
      const lp = filtroParams();
      if (f.sort) { lp.set('sort', f.sort); lp.set('dir', f.dir); }
      lp.set('page', String(f.page));
      const [lst, fc] = await Promise.all([
        fiscalApi.get<Resp>(`/rfb/cruzamento?${lp}`),
        fiscalApi.get<Facetas>(`/rfb/cruzamento/facetas?${filtroParams()}`),
      ]);
      setData(lst.data);
      setFac(fc.data);
    } catch (e) {
      toast.error(extractApiError(e));
    } finally {
      setLoading(false);
    }
  }, [f, filtroParams, toast]);

  useEffect(() => {
    carregar();
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [carregar]);

  useEffect(() => {
    const rodando = data?.execucoes?.[0]?.status === 'RODANDO';
    if (rodando && !timer.current) timer.current = setInterval(carregar, 5000);
    else if (!rodando && timer.current) { clearInterval(timer.current); timer.current = null; }
  }, [data, carregar]);

  // Debounce do texto de busca → 1 reload ~400ms após parar de digitar
  // (facetas/página continuam imediatas — são cliques discretos).
  useEffect(() => {
    const t = setTimeout(() => {
      setF((p) => (p.search === searchInput ? p : { ...p, search: searchInput, page: 1 }));
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

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

  async function exportar() {
    setActing(true);
    try {
      const resp = await fiscalApi.get(`/rfb/cruzamento/export?${filtroParams()}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([resp.data], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url; a.download = 'inteligencia-cadastral.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(extractApiError(e));
    } finally {
      setActing(false);
    }
  }

  async function salvarLimiar() {
    const v = Number(limiarInput);
    if (!Number.isFinite(v) || v < 0 || v > 100) {
      toast.error('Limiar inválido — informe um inteiro 0-100.');
      return;
    }
    setActing(true);
    try {
      await fiscalApi.post('/rfb/cruzamento/limiar', { valor: v });
      toast.success('Limiar salvo — aplica no próximo cruzamento');
      await carregar();
    } catch (e) {
      toast.error(extractApiError(e));
    } finally {
      setActing(false);
    }
  }

  /** Clique numa faceta = aplica/limpa o filtro daquela dimensão. */
  const toggleFacet = (dim: 'alerta' | 'origem' | 'uf' | 'situacao' | 'porte' | 'simples' | 'divergencia', val: string) => {
    const v = val === '(vazio)' ? '' : val;
    setF((p) => ({ ...p, [dim]: p[dim] === v ? '' : v, page: 1 }));
  };

  const limpar = () => {
    setSearchInput('');
    setF((p) => ({
      ...p, alerta: '', origem: '', uf: '', situacao: '', porte: '', simples: '', divergencia: '', soRecente: false, search: '', page: 1,
    }));
  };

  const ex = data?.execucoes?.[0];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const temFiltro = !!(f.alerta || f.origem || f.uf || f.situacao || f.porte || f.simples || f.divergencia || f.soRecente || f.search);

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

  /** Grupo de facetas: chips clicáveis (dim filtrável) ou só leitura. */
  const FacetGroup = ({
    titulo, itens, dim,
  }: { titulo: string; itens?: FacetItem[]; dim?: Parameters<typeof toggleFacet>[0] }) => {
    if (!itens || itens.length === 0) return null;
    return (
      <div className="min-w-[150px]">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{titulo}</div>
        <div className="flex flex-wrap gap-1">
          {itens.slice(0, 8).map((it) => {
            const sel = dim && f[dim] === (it.valor === '(vazio)' ? '' : it.valor) && f[dim] !== '';
            return (
              <button
                key={it.valor}
                type="button"
                disabled={!dim}
                onClick={() => dim && toggleFacet(dim, it.valor)}
                className={`rounded-full border px-2 py-0.5 text-[11px] ${
                  sel ? 'border-capul-500 bg-capul-50 text-capul-700'
                  : dim ? 'border-slate-200 text-slate-600 hover:border-slate-400'
                  : 'border-slate-200 text-slate-500 cursor-default'
                }`}
                title={dim ? 'Filtrar' : undefined}
              >
                {it.valor} <span className="text-slate-400">{it.total.toLocaleString('pt-BR')}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <PageWrapper title="Inteligência Cadastral">
        <div className="text-sm text-slate-500">Carregando…</div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="Inteligência Cadastral">
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <Network className="h-5 w-5 flex-shrink-0 text-capul-600" />
        <p>
          Exploração de <strong>clientes (SA1) + fornecedores (SA2)</strong> do Protheus ×
          <strong> base pública CNPJ local</strong> — sem certificado, sem SEFAZ, zero risco.
          Clique nas facetas para filtrar; clique numa linha para abrir a Consulta Cadastral.
          O snapshot é gerado sob demanda (ADMIN_TI).
        </p>
      </div>

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
        <Button size="sm" variant="secondary" onClick={exportar} disabled={acting || (data?.total ?? 0) === 0}>
          <Download className="mr-1 h-3.5 w-3.5" /> Exportar CSV
        </Button>
        {isAdmin && (
          <span className="inline-flex items-center gap-1.5">
            <label
              className="text-slate-500"
              title="% mínimo de similaridade de razão p/ NÃO marcar divergência. Aplica no próximo cruzamento."
            >
              Limiar divergência:
            </label>
            <input
              type="number" min={0} max={100}
              value={limiarInput}
              onChange={(e) => setLimiarInput(e.target.value)}
              className="w-16 rounded-md border border-slate-300 px-2 py-1 text-xs"
            />
            <span className="text-slate-400">%</span>
            <Button
              size="sm" variant="secondary" onClick={salvarLimiar}
              disabled={acting || limiarInput === String(data?.limiarRazao ?? '')}
            >
              Salvar limiar
            </Button>
          </span>
        )}
      </div>

      {/* Facetas combináveis */}
      {fac && (
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">
              Facetas {temFiltro && <span className="text-slate-400">· {fac.total.toLocaleString('pt-BR')} no filtro atual</span>}
            </span>
            {temFiltro && (
              <button onClick={limpar} className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-capul-600">
                <X className="h-3 w-3" /> Limpar filtros
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <FacetGroup titulo="Alerta" itens={fac.alerta} dim="alerta" />
            <FacetGroup titulo="Situação RFB" itens={fac.situacao} dim="situacao" />
            <FacetGroup titulo="Origem" itens={fac.origem} dim="origem" />
            <FacetGroup titulo="UF" itens={fac.uf} dim="uf" />
            <FacetGroup titulo="Porte" itens={fac.porte} dim="porte" />
            <FacetGroup titulo="Simples" itens={fac.simples} dim="simples" />
            <FacetGroup titulo="Divergência razão" itens={fac.divergencia} dim="divergencia" />
            <FacetGroup titulo="Top CNAE" itens={fac.cnaeTop} />
          </div>
        </div>
      )}

      {/* Busca livre + filtro de situação recente (data_situacao RFB) */}
      <div className="flex items-center gap-3">
        <input className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          placeholder="Buscar CNPJ, razão social ou matrícula Protheus" value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)} />
        <label className="flex shrink-0 items-center gap-1.5 text-xs text-slate-600" title="Situação cadastral alterada na Receita nos últimos 90 dias">
          <input type="checkbox" checked={f.soRecente}
            onChange={(e) => setF({ ...f, soRecente: e.target.checked, page: 1 })} />
          Só situação recente (≤90d)
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <Th col="cnpj" label="CNPJ" />
              <Th col="origem" label="Origem" />
              <Th col="razaoProtheus" label="Razão (Protheus)" />
              <Th col="razaoRfb" label="Razão (RFB)" />
              <Th col="similaridadeRazao" label="Razão ≈" />
              <Th col="situacaoRfb" label="Sit. RFB" />
              <th className="px-3 py-2">Situação desde</th>
              <Th col="ufRfb" label="UF" />
              <Th col="alerta" label="Alerta" />
            </tr>
          </thead>
          <tbody>
            {(data?.itens ?? []).map((r) => (
              <tr
                key={r.id}
                onClick={() => navigate(`/cadastro?cnpj=${r.cnpj.replace(/\D/g, '')}${r.ufRfb ? `&uf=${r.ufRfb}` : ''}&fonte=local&auto=1`)}
                className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                title="Abrir na Consulta Cadastral (base local — zero certificado)"
              >
                <td className="px-3 py-2 font-mono text-xs">{r.cnpj}</td>
                <td className="px-3 py-2 text-xs">{r.origem === 'SA1010' ? 'Cliente' : 'Fornec.'}</td>
                <td className="px-3 py-2">{r.razaoProtheus ?? '—'}</td>
                <td className="px-3 py-2 text-slate-600">{r.razaoRfb ?? '—'}</td>
                <td className="px-3 py-2 text-xs whitespace-nowrap">
                  {r.similaridadeRazao == null ? (
                    <span className="text-slate-300">—</span>
                  ) : r.divergenciaRazao ? (
                    <span
                      className="rounded bg-red-100 px-1.5 py-0.5 font-medium text-red-700"
                      title="Razão social do Protheus diverge da oficial RFB"
                    >
                      {r.similaridadeRazao}% diverge
                    </span>
                  ) : (
                    <span className="text-green-700" title="Razão compatível com a RFB">
                      {r.similaridadeRazao}%
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs">{r.situacaoRfb ?? '—'}</td>
                <td className="px-3 py-2 text-xs whitespace-nowrap">
                  {fmtDataSit(r.dataSituacao)}
                  {isRecente(r.dataSituacao) && (
                    <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-700">
                      recente
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs">{r.ufRfb ?? '—'}</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${ALERTA_CLS[r.alerta] ?? 'bg-slate-100'}`}>
                    {r.alerta}
                  </span>
                </td>
              </tr>
            ))}
            {(data?.itens ?? []).length === 0 && (
              <tr><td colSpan={9} className="px-3 py-4 text-center text-slate-400">
                Sem resultados. Rode o cruzamento (precisa da base RFB importada).
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

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
