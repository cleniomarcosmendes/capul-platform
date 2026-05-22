import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Network, RefreshCw, ChevronUp, ChevronDown, ChevronRight, ChevronsUpDown, Download, X, SlidersHorizontal, Users } from 'lucide-react';
import { fiscalApi } from '../../../services/api';
import { Button } from '../../../components/Button';
import { useToast } from '../../../components/Toast';
import { extractApiError } from '../../../utils/errors';
import { PageWrapper } from '../../../components/PageWrapper';
import { useAuth, hasMinRole } from '../../../contexts/AuthContext';

interface Row {
  id: number; cnpj: string; origem: string; razaoProtheus: string | null;
  inscricaoEstadual: string | null; inscricaoEstadualUf: string | null;
  codigo: string | null; loja: string | null;
  razaoRfb: string | null; situacaoRfb: string | null; ufRfb: string | null;
  cnae: string | null; porte: string | null; optanteSimples: string | null;
  dataSituacao: string | null;
  bloqueado: boolean; achadoRfb: boolean; alerta: string;
  similaridadeRazao: number | null; divergenciaRazao: boolean;
  acao: string; // BLOQUEAR | REVISAR | NENHUMA
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
  divergencia: FacetItem[]; acao: FacetItem[];
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

// Rótulos amigáveis p/ os listboxes (a base guarda códigos crus da RFB).
const SIT_LABEL: Record<string, string> = {
  '01': 'Nula', '02': 'Ativa', '03': 'Suspensa', '04': 'Inapta', '08': 'Baixada',
};
const PORTE_LABEL: Record<string, string> = {
  '00': 'Não informado', '01': 'Microempresa', '03': 'Pequeno porte', '05': 'Demais',
};
const ORIGEM_LABEL: Record<string, string> = { SA1010: 'Cliente', SA2010: 'Fornecedor' };
const SIMPLES_LABEL: Record<string, string> = { S: 'Optante', N: 'Não optante' };

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
  // A URL é a FONTE DE VERDADE dos filtros/busca/ordenação/página. Assim
  // "voltar" do navegador (após clicar numa linha), refresh e favoritar
  // restauram a exploração exatamente como estava. useMemo([sp]) mantém
  // `f` estável entre renders (senão carregar/useEffect entram em loop).
  const [sp, setSp] = useSearchParams();
  const f = useMemo(() => ({
    alerta: sp.get('alerta') ?? '',
    origem: sp.get('origem') ?? '',
    uf: sp.get('uf') ?? '',
    situacao: sp.get('situacao') ?? '',
    porte: sp.get('porte') ?? '',
    simples: sp.get('simples') ?? '',
    divergencia: sp.get('divergencia') ?? '',
    acao: sp.get('acao') ?? '',
    soRecente: sp.get('soRecente') === '1',
    semIe: sp.get('semIe') === '1',
    search: sp.get('search') ?? '',
    page: Math.max(1, Number(sp.get('page')) || 1),
    sort: sp.get('sort') ?? '',
    dir: (sp.get('dir') === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc',
  }), [sp]);

  // "Mais filtros" recolhível: começa aberto se a URL já trouxe algum
  // filtro secundário (refresh/favoritar/voltar restauram visível).
  const [maisAberto, setMaisAberto] = useState(
    () => ['alerta', 'origem', 'uf', 'situacao', 'porte', 'simples'].some((k) => sp.get(k)),
  );

  /** Atualiza filtros na URL (replace — não polui histórico ao filtrar/
   *  digitar; o snapshot p/ "voltar" é o push do clique na linha). */
  const patch = useCallback((partial: Partial<typeof f>) => {
    const n = { ...f, ...partial };
    const q = new URLSearchParams();
    if (n.alerta) q.set('alerta', n.alerta);
    if (n.origem) q.set('origem', n.origem);
    if (n.uf) q.set('uf', n.uf);
    if (n.situacao) q.set('situacao', n.situacao);
    if (n.porte) q.set('porte', n.porte);
    if (n.simples) q.set('simples', n.simples);
    if (n.divergencia) q.set('divergencia', n.divergencia);
    if (n.acao) q.set('acao', n.acao);
    if (n.soRecente) q.set('soRecente', '1');
    if (n.semIe) q.set('semIe', '1');
    if (n.search) q.set('search', n.search);
    if (n.page > 1) q.set('page', String(n.page));
    if (n.sort) { q.set('sort', n.sort); q.set('dir', n.dir); }
    setSp(q, { replace: true });
  }, [f, setSp]);

  // Busca com DEBOUNCE: o input mexe só em `searchInput` (imediato); 400ms
  // após parar de digitar, propaga p/ a URL (que dispara carregar). Sem
  // isso cada tecla = 2 fetches (lista+facetas) → estoura o limit_req do
  // nginx (30 r/s) e volta 429 (incidente Clenio 18/05). Inicia do URL.
  const [searchInput, setSearchInput] = useState(sp.get('search') ?? '');
  const toast = useToast();
  const navigate = useNavigate();
  // Export CSV (extração em massa de dado cadastral/fiscal) restrito a
  // GESTOR_FISCAL+ por LGPD/governança — ANALISTA_CADASTRO consulta na
  // tela mas não exporta (decisão Clenio 19/05). Backend espelha em
  // @RoleMinima('GESTOR_FISCAL') no /cruzamento/export.
  const { fiscalRole } = useAuth();
  const podeExportar = hasMinRole(fiscalRole, 'GESTOR_FISCAL');
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

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
    if (f.semIe) p.set('semIe', '1');
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
      if (searchInput !== f.search) patch({ search: searchInput, page: 1 });
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput, f.search, patch]);

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

  /** Conta de um valor numa dimensão de faceta (p/ os atalhos de Foco).
   *  null = dimensão filtrada fora do resultado atual (não exibe número). */
  const facCount = (itens: FacetItem[] | undefined, valor: string): number | null =>
    itens?.find((i) => i.valor === valor)?.total ?? null;

  /** Atalho de "Foco": liga/desliga um filtro-objetivo (toggle). */
  const togglePreset = (dim: 'acao' | 'divergencia', val: string) =>
    patch({ [dim]: f[dim] === val ? '' : val, page: 1 });

  const limpar = () => {
    setSearchInput('');
    setSp({}, { replace: true });
  };

  const ex = data?.execucoes?.[0];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const temFiltro = !!(f.alerta || f.origem || f.uf || f.situacao || f.porte || f.simples || f.divergencia || f.acao || f.soRecente || f.semIe || f.search);
  const filtrosAvancados = (['alerta', 'origem', 'uf', 'situacao', 'porte', 'simples'] as const)
    .filter((k) => f[k]).length;

  const Th = ({ col, label, hint }: { col: string; label: string; hint?: string }) => {
    const active = f.sort === col;
    const Icon = active ? (f.dir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown;
    return (
      <th className="px-3 py-2" title={hint}>
        <button
          type="button"
          onClick={() => patch({
            page: 1, sort: col,
            dir: f.sort === col && f.dir === 'asc' ? 'desc' : 'asc',
          })}
          className={`inline-flex items-center gap-1 hover:text-slate-800 ${active ? 'text-slate-800 font-semibold' : ''}`}
          title="Ordenar"
        >
          {label}
          <Icon className={`h-3 w-3 ${active ? 'text-capul-600' : 'text-slate-300'}`} />
        </button>
      </th>
    );
  };

  /** Atalho de Foco: botão-objetivo com contagem (toggle visual). */
  const PresetBtn = ({
    active, tone, label, count, title, onClick,
  }: {
    active: boolean; tone: 'red' | 'amber' | 'slate'; label: string;
    count: number | null; title: string; onClick: () => void;
  }) => {
    const palette = {
      red: active ? 'border-red-600 bg-red-600 text-white' : 'border-red-200 text-red-700 hover:bg-red-50',
      amber: active ? 'border-amber-600 bg-amber-600 text-white' : 'border-amber-200 text-amber-700 hover:bg-amber-50',
      slate: active ? 'border-slate-600 bg-slate-700 text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-50',
    }[tone];
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        aria-pressed={active}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${palette}`}
      >
        {label}
        {count != null && (
          <span className={active ? 'text-white/80' : 'text-slate-400'}>
            {count.toLocaleString('pt-BR')}
          </span>
        )}
      </button>
    );
  };

  /** Listbox de dimensão secundária (rótulo amigável + contagem).
   *  "(vazio)" é omitido — o backend não filtra por nulo (montarWhere usa
   *  truthy), então ofertá-lo seria um "Todos" disfarçado. */
  const FacetSelect = ({
    titulo, dim, itens, labels,
  }: {
    titulo: string;
    dim: 'alerta' | 'origem' | 'uf' | 'situacao' | 'porte' | 'simples';
    itens?: FacetItem[];
    labels?: Record<string, string>;
  }) => {
    const opts = (itens ?? []).filter((it) => it.valor !== '(vazio)');
    if (opts.length === 0) return null;
    return (
      <label className="flex min-w-[160px] flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{titulo}</span>
        <select
          value={f[dim]}
          onChange={(e) => patch({ [dim]: e.target.value, page: 1 })}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:ring-slate-500"
        >
          <option value="">Todos</option>
          {opts.map((it) => (
            <option key={it.valor} value={it.valor}>
              {labels?.[it.valor] ?? it.valor} ({it.total.toLocaleString('pt-BR')})
            </option>
          ))}
        </select>
      </label>
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
          Use o <strong>Foco</strong> para os casos acionáveis (irregular × ativo no Protheus);
          <strong> Mais filtros</strong> refina. Clique numa linha para a Consulta Cadastral.
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
          Snapshot de: <strong>{ex?.status ?? '—'}</strong>
          {ex?.observacao ? ` · ${ex.observacao}` : ''}
          {ex?.fim ? ` · ${new Date(ex.fim).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}` : ''}
          <span className="ml-1 text-slate-400" title="Reprocessar o cruzamento (lote pesado) é feito em Operação → Controle Operacional → Base CNPJ (RFB), por ADMIN_TI.">
            · reprocessar em Operação → Controle
          </span>
        </span>
        <Button size="sm" variant="secondary" onClick={() => carregar()} disabled={acting}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Atualizar
        </Button>
        {podeExportar && (
          <Button size="sm" variant="secondary" onClick={exportar} disabled={acting || (data?.total ?? 0) === 0}>
            <Download className="mr-1 h-3.5 w-3.5" /> Exportar CSV
          </Button>
        )}
      </div>

      {/* Camada 1 — Foco: atalhos pro objetivo da tela (acionável) */}
      {fac && (
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">
                Foco {temFiltro && <span className="text-slate-400">· {fac.total.toLocaleString('pt-BR')} no resultado</span>}
              </span>
              {temFiltro && (
                <button onClick={limpar} className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-capul-600">
                  <X className="h-3 w-3" /> Limpar tudo
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <PresetBtn
                active={f.acao === 'BLOQUEAR'} tone="red" label="Bloquear"
                count={facCount(fac.acao, 'BLOQUEAR')}
                title="RFB inapta/baixada e ainda ATIVO no Protheus — ação concreta."
                onClick={() => togglePreset('acao', 'BLOQUEAR')}
              />
              <PresetBtn
                active={f.acao === 'REVISAR'} tone="amber" label="Revisar"
                count={facCount(fac.acao, 'REVISAR')}
                title="RFB suspensa/nula, ou razão divergente, com Protheus ativo."
                onClick={() => togglePreset('acao', 'REVISAR')}
              />
              <PresetBtn
                active={f.divergencia === 'Sim'} tone="amber" label="Razão divergente"
                count={facCount(fac.divergencia, 'Sim')}
                title="Razão social do Protheus diverge da oficial da RFB."
                onClick={() => togglePreset('divergencia', 'Sim')}
              />
              <PresetBtn
                active={f.soRecente} tone="slate" label="Situação recente ≤90d"
                count={null}
                title="Situação cadastral alterada na Receita nos últimos 90 dias."
                onClick={() => patch({ soRecente: !f.soRecente, page: 1 })}
              />
              <PresetBtn
                active={f.semIe} tone="slate" label="Sem IE (Protheus)"
                count={null}
                title="Cliente/fornecedor sem Inscrição Estadual no Protheus (dado bruto do ERP, não validado contra SEFAZ). Ausência pode ser legítima (CPF/produtor, isento, serviço) — exige análise."
                onClick={() => patch({ semIe: !f.semIe, page: 1 })}
              />
            </div>
          </div>

          {/* Camada 2 — Mais filtros (listboxes), recolhível */}
          <div className="rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setMaisAberto((v) => !v)}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              aria-expanded={maisAberto}
            >
              {maisAberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
              Mais filtros
              {filtrosAvancados > 0 && (
                <span className="rounded-full bg-capul-100 px-1.5 py-0.5 text-[10px] font-medium text-capul-700">
                  {filtrosAvancados} ativo{filtrosAvancados > 1 ? 's' : ''}
                </span>
              )}
            </button>
            {maisAberto && (
              <div className="border-t border-slate-100 p-3">
                <div className="flex flex-wrap gap-x-5 gap-y-3">
                  <FacetSelect titulo="Alerta" dim="alerta" itens={fac.alerta} />
                  <FacetSelect titulo="Situação RFB" dim="situacao" itens={fac.situacao} labels={SIT_LABEL} />
                  <FacetSelect titulo="Origem" dim="origem" itens={fac.origem} labels={ORIGEM_LABEL} />
                  <FacetSelect titulo="UF" dim="uf" itens={fac.uf} />
                  <FacetSelect titulo="Porte" dim="porte" itens={fac.porte} labels={PORTE_LABEL} />
                  <FacetSelect titulo="Simples" dim="simples" itens={fac.simples} labels={SIMPLES_LABEL} />
                </div>
                {fac.cnaeTop.filter((c) => c.valor !== '(vazio)').length > 0 && (
                  <div className="mt-3 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                    <span className="font-semibold uppercase tracking-wide text-slate-400">Top CNAE</span>{' '}
                    {fac.cnaeTop.filter((c) => c.valor !== '(vazio)').slice(0, 8).map((c) => (
                      <span key={c.valor} className="mr-2 whitespace-nowrap">
                        {c.valor} <span className="text-slate-400">{c.total.toLocaleString('pt-BR')}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Busca livre (situação recente virou atalho de Foco) */}
      <div className="flex items-center gap-3">
        <input className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          placeholder="Buscar CNPJ, razão social, matrícula Protheus ou IE" value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <Th col="cnpj" label="CNPJ" />
              <Th col="origem" label="Origem" />
              <th className="px-3 py-2" title="Código + Loja no Protheus (A1_COD/A1_LOJA para cliente, A2_COD/A2_LOJA para fornecedor)">Cód/Loja</th>
              <Th col="razaoProtheus" label="Razão (Protheus)" />
              <Th col="inscricaoEstadual" label="IE (Protheus)"
                hint="Inscrição Estadual como está no Protheus (SA1/SA2). Dado bruto do ERP — NÃO validado contra SEFAZ/CCC. A base RFB Dados Abertos não tem IE." />
              <Th col="razaoRfb" label="Razão (RFB)" />
              <Th col="similaridadeRazao" label="Razão (sim.%)" />
              <Th col="situacaoRfb" label="Sit. RFB" />
              <th className="px-3 py-2">Situação desde</th>
              <Th col="ufRfb" label="UF" />
              <Th col="alerta" label="Alerta" />
              <Th col="acao" label="Ação" />
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
                <td className="px-3 py-2 font-mono text-xs">
                  <span className="inline-flex items-center gap-1.5">
                    {r.cnpj}
                    {/* Cruzamento: "ver sócios" → Consulta Cadastral ancorada no QSA.
                        stopPropagation: a linha em si abre a Consulta Cadastral no topo. */}
                    <Link
                      to={`/cadastro?cnpj=${r.cnpj.replace(/\D/g, '')}${r.ufRfb ? `&uf=${r.ufRfb}` : ''}&fonte=local&auto=1#qsa`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-slate-400 hover:text-blue-600"
                      title="Ver os sócios desta empresa (QSA)"
                    >
                      <Users className="h-3.5 w-3.5" />
                    </Link>
                  </span>
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.origem === 'SA1010' ? 'Cliente' : 'Fornec.'}
                  {r.bloqueado && (
                    <span
                      className="ml-1 rounded bg-slate-200 px-1 py-0.5 text-[10px] font-medium text-slate-600"
                      title="Cliente/fornecedor BLOQUEADO no Protheus"
                    >
                      bloq.
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                  {r.codigo ? `${r.codigo}${r.loja ? '/' + r.loja : ''}` : '—'}
                </td>
                <td className="px-3 py-2">{r.razaoProtheus ?? '—'}</td>
                <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                  {r.inscricaoEstadual ? (
                    <>
                      {r.inscricaoEstadual}
                      {r.inscricaoEstadualUf && (
                        <span className="ml-1 text-slate-400">{r.inscricaoEstadualUf}</span>
                      )}
                    </>
                  ) : (
                    <span className="text-slate-300" title="Sem IE no Protheus (pode ser legítimo: CPF/produtor, isento, serviço)">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-600">{r.razaoRfb ?? '—'}</td>
                <td className="px-3 py-2 text-xs whitespace-nowrap">
                  {r.similaridadeRazao == null ? (
                    <span className="text-slate-300" title="Sem comparação (não encontrado na RFB ou sem razão)">—</span>
                  ) : r.divergenciaRazao ? (
                    <span
                      title={`Razão do Protheus diverge da oficial RFB — só ${r.similaridadeRazao}% de similaridade (quanto menor, mais diferente; 0% = nada em comum).`}
                      className="whitespace-nowrap"
                    >
                      <span className="rounded bg-red-100 px-1.5 py-0.5 font-semibold text-red-700">diverge</span>
                      <span className="ml-1 text-slate-400">{r.similaridadeRazao}% sim.</span>
                    </span>
                  ) : (
                    <span className="text-green-700" title="Razão compatível com a RFB (similaridade alta)">
                      {r.similaridadeRazao}% sim.
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
                <td className="px-3 py-2">
                  {r.acao === 'BLOQUEAR' ? (
                    <span
                      className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700"
                      title="RFB INAPTA/BAIXADA e ainda ATIVO no Protheus — bloquear/atualizar o cadastro."
                    >
                      BLOQUEAR
                    </span>
                  ) : r.acao === 'REVISAR' ? (
                    <span
                      className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700"
                      title="RFB SUSPENSA/NULA, ou razão social divergente, com Protheus ativo — revisar o cadastro."
                    >
                      REVISAR
                    </span>
                  ) : (
                    <span
                      className="text-slate-300"
                      title="Sem ação: situação OK, não encontrado na RFB, ou já bloqueado no Protheus (tratado)."
                    >
                      —
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {(data?.itens ?? []).length === 0 && (
              <tr><td colSpan={12} className="px-3 py-4 text-center text-slate-400">
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
              onClick={() => patch({ page: f.page - 1 })}>Anterior</Button>
            <Button size="sm" variant="secondary" disabled={f.page >= totalPages}
              onClick={() => patch({ page: f.page + 1 })}>Próxima</Button>
          </div>
        </div>
      )}
    </div>
    </PageWrapper>
  );
}
