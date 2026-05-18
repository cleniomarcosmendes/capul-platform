import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, Search, Info } from 'lucide-react';
import { fiscalApi } from '../services/api';
import { PageWrapper } from '../components/PageWrapper';
import { Button } from '../components/Button';
import { useToast } from '../components/Toast';
import { extractApiError } from '../utils/errors';
import { fmtCnpj } from '../utils/format';

interface Empresa {
  cnpjCompleto: string;
  razaoSocial: string | null;
  situacao: string | null;
  uf: string | null;
  municipio: string | null;
  cnae: string | null;
  porte: string | null;
  dataSituacao: string | null;
  emProtheus: boolean; // true = já é cliente/fornecedor da CAPUL
}
interface Resp {
  itens: Empresa[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  semFiltro: boolean;
}

const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
  'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];
// situação_cadastral RFB: código → rótulo (o backend filtra pelo código).
const SITUACOES: Array<[string, string]> = [
  ['02', 'Ativa'], ['03', 'Suspensa'], ['04', 'Inapta'], ['08', 'Baixada'], ['01', 'Nula'],
];
const SIT_CLS: Record<string, string> = {
  ATIVA: 'bg-green-100 text-green-700',
  BAIXADA: 'bg-red-100 text-red-700', INAPTA: 'bg-red-100 text-red-700', NULA: 'bg-red-100 text-red-700',
  SUSPENSA: 'bg-amber-100 text-amber-700',
};
const fmtData = (s: string | null) =>
  s && /^\d{8}$/.test(s) ? `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}` : '—';

/**
 * Gap A — Explorador da base pública RFB (universo de empresas, NÃO só
 * as do Protheus). Prospecção / validar antes de cadastrar: filtra por
 * razão/UF/situação/CNAE + toggle "não está no Protheus". GESTOR_FISCAL+.
 * Estado na URL (voltar/refresh/favoritar preservam).
 */
export function BaseRfbEmpresasPage() {
  const [sp, setSp] = useSearchParams();
  const razaoUrl = (sp.get('razao') ?? '').trim();
  const uf = sp.get('uf') ?? '';
  const situacao = sp.get('situacao') ?? '';
  const cnae = sp.get('cnae') ?? '';
  const semProtheus = sp.get('semProtheus') === '1';
  const pageUrl = Math.max(1, Number(sp.get('page')) || 1);
  const [razao, setRazao] = useState(sp.get('razao') ?? '');
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  /** Atualiza a URL (replace — não polui histórico; o push do clique na
   *  linha é o snapshot p/ voltar). */
  function patch(part: Record<string, string>) {
    const q = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(part)) {
      if (v) q.set(k, v); else q.delete(k);
    }
    setSp(q, { replace: true });
  }

  // Debounce 350ms da razão → URL (volta p/ página 1).
  useEffect(() => {
    const t = setTimeout(() => {
      if (razao.trim() === razaoUrl) return;
      patch({ razao: razao.trim(), page: '' });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [razao, razaoUrl]);

  useEffect(() => {
    const temFiltro = razaoUrl.length >= 3 || !!uf || !!cnae.replace(/\D/g, '');
    if (!temFiltro) { setData(null); return; }
    let cancelado = false;
    setLoading(true);
    fiscalApi
      .get<Resp>('/rfb/empresas/busca', {
        params: {
          razao: razaoUrl, uf, situacao, cnae,
          ...(semProtheus ? { semProtheus: '1' } : {}),
          page: pageUrl,
        },
      })
      .then((r) => { if (!cancelado) setData(r.data); })
      .catch((e) => { if (!cancelado) toast.error(extractApiError(e)); })
      .finally(() => { if (!cancelado) setLoading(false); });
    return () => { cancelado = true; };
  }, [razaoUrl, uf, situacao, cnae, semProtheus, pageUrl, toast]);

  const itens = data?.itens ?? [];
  const semFiltroAtivo = razaoUrl.length < 3 && !uf && !cnae.replace(/\D/g, '');

  return (
    <PageWrapper title="Base RFB — Empresas">
      <div className="mb-4 flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <Building2 className="h-5 w-5 flex-shrink-0 text-capul-600" />
        <p>
          Explore o <strong>universo de empresas da base pública RFB</strong> (não só
          as do Protheus) — prospecção, ou validar uma empresa antes de cadastrar.
          Marque <strong>"não está no Protheus"</strong> para ver só as que a CAPUL
          ainda não tem. Sem certificado, sem SEFAZ. Clique numa linha para a
          Consulta Cadastral (base local). Informe ao menos razão (3+), UF ou CNAE.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="relative min-w-[260px] flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-700">Razão social</label>
          <Search className="pointer-events-none absolute left-3 top-[30px] h-4 w-4 text-slate-400" />
          <input
            value={razao}
            onChange={(e) => setRazao(e.target.value)}
            placeholder="Parte da razão social (mín. 3)"
            className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-slate-500 focus:ring-slate-500"
          />
        </div>
        <div className="w-24">
          <label className="mb-1 block text-xs font-medium text-slate-700">UF</label>
          <select value={uf} onChange={(e) => patch({ uf: e.target.value, page: '' })}
            className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm">
            <option value="">—</option>
            {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div className="w-36">
          <label className="mb-1 block text-xs font-medium text-slate-700">Situação</label>
          <select value={situacao} onChange={(e) => patch({ situacao: e.target.value, page: '' })}
            className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm">
            <option value="">—</option>
            {SITUACOES.map(([c, l]) => <option key={c} value={c}>{l}</option>)}
          </select>
        </div>
        <div className="w-32">
          <label className="mb-1 block text-xs font-medium text-slate-700">CNAE</label>
          <input value={cnae} onChange={(e) => patch({ cnae: e.target.value.replace(/\D/g, ''), page: '' })}
            placeholder="ex.: 4711" maxLength={7}
            className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm font-mono" />
        </div>
        <label className="flex items-center gap-1.5 pb-2 text-xs text-slate-700"
          title="Mostra só empresas que NÃO são cliente/fornecedor da CAPUL no Protheus">
          <input type="checkbox" checked={semProtheus}
            onChange={(e) => patch({ semProtheus: e.target.checked ? '1' : '', page: '' })} />
          Não está no Protheus
        </label>
      </div>

      {semFiltroAtivo && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <Info className="h-4 w-4" /> Informe razão (3+ caracteres), UF ou CNAE para buscar.
        </div>
      )}

      {loading && <div className="text-sm text-slate-500">Buscando…</div>}

      {!loading && data && !data.semFiltro && (
        <>
          <div className="mb-2 text-xs text-slate-500">
            {itens.length === 0
              ? 'Nenhuma empresa com esses filtros.'
              : `${itens.length} empresa(s) nesta página${data.hasMore ? ' (há mais)' : ''}.`}
          </div>
          {itens.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Razão social</th>
                    <th className="px-3 py-2">CNPJ</th>
                    <th className="px-3 py-2">Situação</th>
                    <th className="px-3 py-2">UF/Município</th>
                    <th className="px-3 py-2">CNAE</th>
                    <th className="px-3 py-2">Porte</th>
                    <th className="px-3 py-2">Cadastro CAPUL</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((r, i) => (
                    <tr
                      key={`${r.cnpjCompleto}-${i}`}
                      onClick={() => navigate(`/cadastro?cnpj=${r.cnpjCompleto.replace(/\D/g, '')}&fonte=local&auto=1`)}
                      className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                      title="Abrir Consulta Cadastral (base local)"
                    >
                      <td className="px-3 py-2 font-medium">{r.razaoSocial ?? '—'}</td>
                      <td className="px-3 py-2 font-mono text-xs">{fmtCnpj(r.cnpjCompleto)}</td>
                      <td className="px-3 py-2">
                        {r.situacao && (
                          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${SIT_CLS[r.situacao] ?? 'bg-slate-100 text-slate-600'}`}>
                            {r.situacao}
                          </span>
                        )}
                        {r.dataSituacao && (
                          <span className="ml-1 text-[10px] text-slate-400">{fmtData(r.dataSituacao)}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {r.uf ?? '—'}{r.municipio ? ` · ${r.municipio}` : ''}
                      </td>
                      <td className="px-3 py-2 text-xs">{r.cnae ?? '—'}</td>
                      <td className="px-3 py-2 text-xs">{r.porte ?? '—'}</td>
                      <td className="px-3 py-2">
                        {r.emProtheus ? (
                          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700"
                            title="Já é cliente/fornecedor da CAPUL (SA1/SA2)">
                            já cadastrada
                          </span>
                        ) : (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500"
                            title="Não consta no Protheus da CAPUL">
                            não
                          </span>
                        )}
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
                  onClick={() => patch({ page: String(pageUrl - 1) })}>Anterior</Button>
                <Button size="sm" variant="secondary" disabled={!data.hasMore}
                  onClick={() => patch({ page: String(pageUrl + 1) })}>Próxima</Button>
              </div>
            </div>
          )}
        </>
      )}
    </PageWrapper>
  );
}
