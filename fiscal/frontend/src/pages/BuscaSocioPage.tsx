import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Users, Search, Info, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { fiscalApi } from '../services/api';
import { PageWrapper } from '../components/PageWrapper';
import { Button } from '../components/Button';
import { useToast } from '../components/Toast';
import { extractApiError } from '../utils/errors';
import { fmtCnpj } from '../utils/format';

interface SocioEmpresa {
  cnpjBasico: string;
  cnpjCompleto: string | null;
  razaoSocial: string | null;
  situacao: string | null;
  uf: string | null;
  municipio: string | null;
  socioNome: string | null;
  socioTipo: string; // PF | PJ | Estrangeiro
  qualificacao: string | null;
  dataEntrada: string | null;
  faixaEtaria: string | null;
}
interface Resp {
  itens: SocioEmpresa[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  termoCurto: boolean;
}

const SIT_CLS: Record<string, string> = {
  ATIVA: 'bg-green-100 text-green-700',
  BAIXADA: 'bg-red-100 text-red-700',
  INAPTA: 'bg-red-100 text-red-700',
  NULA: 'bg-red-100 text-red-700',
  SUSPENSA: 'bg-amber-100 text-amber-700',
};
// RFB faixa_etaria: 1..9 faixas + 0 = não se aplica (sócio PJ).
const FAIXA: Record<string, string> = {
  '1': '0-12', '2': '13-20', '3': '21-30', '4': '31-40', '5': '41-50',
  '6': '51-60', '7': '61-70', '8': '71-80', '9': '> 80',
};
const fmtData = (s: string | null) =>
  s && /^\d{8}$/.test(s) ? `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}` : '—';

/**
 * Busca reversa por SÓCIO — digita o nome de uma pessoa/empresa e lista
 * as empresas em que ela consta no quadro societário (rfb.socios, base
 * pública Dados Abertos). Sem certificado/SEFAZ. GESTOR_FISCAL+.
 */
export function BuscaSocioPage() {
  // A URL é a FONTE DE VERDADE da busca (?nome=&page=). Assim "voltar" do
  // navegador (após clicar numa empresa), refresh e favoritar restauram
  // a pesquisa exatamente como estava — sem redigitar.
  const [sp, setSp] = useSearchParams();
  const nomeUrl = (sp.get('nome') ?? '').trim();
  const pageUrl = Math.max(1, Number(sp.get('page')) || 1);
  const sortUrl = sp.get('sort') ?? '';
  const dirUrl: 'asc' | 'desc' = sp.get('dir') === 'desc' ? 'desc' : 'asc';
  // Input controlado; inicia do URL (mostra o termo ao restaurar).
  const [termo, setTermo] = useState(sp.get('nome') ?? '');
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  /** Atualiza a URL preservando o que não mudou (replace — não polui o
   *  histórico ao digitar/ordenar; o push p/ "voltar" é o clique na linha). */
  const setParams = useCallback((partial: Record<string, string>) => {
    const q = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(partial)) {
      if (v) q.set(k, v); else q.delete(k);
    }
    setSp(q, { replace: true });
  }, [sp, setSp]);

  // Debounce (lição do 429): digitar mexe só no input; 350ms depois grava
  // na URL. Novo termo volta p/ página 1 (preserva ordenação); se igual
  // ao da URL, não faz nada. Termo vazio limpa tudo.
  useEffect(() => {
    const t = setTimeout(() => {
      const v = termo.trim();
      if (v === nomeUrl) return;
      if (v) setParams({ nome: v, page: '1' });
      else setSp({}, { replace: true });
    }, 350);
    return () => clearTimeout(t);
  }, [termo, nomeUrl, setParams, setSp]);

  // Fetch keyed na URL (nome+page+sort+dir).
  useEffect(() => {
    if (nomeUrl.length < 3) { setData(null); return; }
    let cancelado = false;
    setLoading(true);
    fiscalApi
      .get<Resp>('/rfb/socios/busca', {
        params: { nome: nomeUrl, page: pageUrl, ...(sortUrl ? { sort: sortUrl, dir: dirUrl } : {}) },
      })
      .then((r) => { if (!cancelado) setData(r.data); })
      .catch((e) => { if (!cancelado) toast.error(extractApiError(e)); })
      .finally(() => { if (!cancelado) setLoading(false); });
    return () => { cancelado = true; };
  }, [nomeUrl, pageUrl, sortUrl, dirUrl, toast]);

  const irPagina = (p: number) => setParams({ page: String(Math.max(1, p)) });

  /** Ordena por coluna (clique no cabeçalho) — volta p/ página 1. */
  const toggleSort = (col: string) =>
    setParams({ sort: col, dir: sortUrl === col && dirUrl === 'asc' ? 'desc' : 'asc', page: '1' });

  const Th = ({ col, label }: { col: string; label: string }) => {
    const active = sortUrl === col;
    const Icon = active ? (dirUrl === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown;
    return (
      <th className="px-3 py-2">
        <button
          type="button"
          onClick={() => toggleSort(col)}
          className={`inline-flex items-center gap-1 hover:text-slate-800 ${active ? 'font-semibold text-slate-800' : ''}`}
          title="Ordenar"
        >
          {label}
          <Icon className={`h-3 w-3 ${active ? 'text-capul-600' : 'text-slate-300'}`} />
        </button>
      </th>
    );
  };

  const itens = data?.itens ?? [];

  return (
    <PageWrapper title="Busca por Sócio">
      <div className="mb-4 flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <Users className="h-5 w-5 flex-shrink-0 text-capul-600" />
        <p>
          Digite o <strong>nome de um sócio</strong> (pessoa ou empresa) e veja
          as empresas em que ele consta no quadro societário. Fonte:{' '}
          <strong>base pública RFB (Dados Abertos)</strong> — sem certificado,
          sem SEFAZ. Clique numa linha para abrir a Consulta Cadastral (base
          local) da empresa.
        </p>
      </div>

      <div className="relative mb-4 max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input
          autoFocus
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Nome do sócio (mín. 3 caracteres)"
          className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-slate-500 focus:ring-slate-500"
        />
      </div>

      {termo.trim().length > 0 && termo.trim().length < 3 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <Info className="h-4 w-4" /> Digite ao menos 3 caracteres.
        </div>
      )}

      {loading && <div className="text-sm text-slate-500">Buscando…</div>}

      {!loading && data && (
        <>
          <div className="mb-2 text-xs text-slate-500">
            {itens.length === 0
              ? 'Nenhum sócio encontrado com esse nome.'
              : `${itens.length} vínculo(s) nesta página${data.hasMore ? ' (há mais)' : ''}.`}
          </div>
          {itens.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <Th col="socio" label="Sócio" />
                    <th className="px-3 py-2">Tipo</th>
                    <Th col="qualificacao" label="Qualificação" />
                    <Th col="entrada" label="Entrada" />
                    <Th col="empresa" label="Empresa" />
                    <Th col="cnpj" label="CNPJ" />
                    <Th col="situacao" label="Situação" />
                    <Th col="uf" label="UF/Município" />
                  </tr>
                </thead>
                <tbody>
                  {itens.map((r, i) => (
                    <tr
                      key={`${r.cnpjBasico}-${i}`}
                      onClick={() =>
                        r.cnpjCompleto &&
                        navigate(`/cadastro?cnpj=${r.cnpjCompleto.replace(/\D/g, '')}&fonte=local&auto=1`)
                      }
                      className={`border-t border-slate-100 ${r.cnpjCompleto ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                      title={r.cnpjCompleto ? 'Abrir Consulta Cadastral (base local)' : undefined}
                    >
                      <td className="px-3 py-2 font-medium">{r.socioNome ?? '—'}</td>
                      <td className="px-3 py-2 text-xs">
                        {r.socioTipo}
                        {r.faixaEtaria && FAIXA[r.faixaEtaria] && (
                          <span
                            className="ml-1 cursor-help text-slate-400 underline decoration-dotted"
                            title={
                              `Faixa etária do sócio: ${FAIXA[r.faixaEtaria]} anos. `
                              + 'A RFB não publica a idade exata (privacidade) — só a faixa. '
                              + 'Reflete a foto mensal da base pública (Dados Abertos); '
                              + 'código 0 = não se aplica (ex.: sócio pessoa jurídica).'
                            }
                          >
                            · {FAIXA[r.faixaEtaria]}a
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">{r.qualificacao ?? '—'}</td>
                      <td className="px-3 py-2 text-xs whitespace-nowrap">{fmtData(r.dataEntrada)}</td>
                      <td className="px-3 py-2">
                        {r.razaoSocial ? (
                          // Cruzamento: razão da empresa → Base RFB — Empresas.
                          // stopPropagation: a linha em si abre a Consulta Cadastral.
                          <Link
                            to={`/rfb/empresas?razao=${encodeURIComponent(r.razaoSocial)}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-blue-600 hover:underline"
                            title="Ver esta empresa na Base RFB — Empresas"
                          >
                            {r.razaoSocial}
                          </Link>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {r.cnpjCompleto ? fmtCnpj(r.cnpjCompleto) : `${r.cnpjBasico}…`}
                      </td>
                      <td className="px-3 py-2">
                        {r.situacao && (
                          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${SIT_CLS[r.situacao] ?? 'bg-slate-100 text-slate-600'}`}>
                            {r.situacao}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {r.uf ?? '—'}{r.municipio ? ` · ${r.municipio}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {(pageUrl > 1 || data.hasMore) && (
            <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
              <span>Página {pageUrl}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" disabled={pageUrl <= 1}
                  onClick={() => irPagina(pageUrl - 1)}>Anterior</Button>
                <Button size="sm" variant="secondary" disabled={!data.hasMore}
                  onClick={() => irPagina(pageUrl + 1)}>Próxima</Button>
              </div>
            </div>
          )}
        </>
      )}
    </PageWrapper>
  );
}
