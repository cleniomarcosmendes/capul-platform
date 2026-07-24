import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fiscalApi } from '../services/api';
import { useToast } from '../components/Toast';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { extractApiError } from '../utils/errors';

type Tipo = 'numero' | 'razao';

interface DocumentoBusca {
  id: string;
  chave: string;
  filial: string;
  numeroNF: string | null;
  serie: string | null;
  cnpjEmitente: string | null;
  cnpjDestinatario: string | null;
  emitenteRazaoSocial: string | null;
  destinatarioRazaoSocial: string | null;
  valorTotal: string | number | null;
  statusAtual: string | null;
  dataAutorizacao: string | null;
  updatedAt: string;
}

interface ListResp {
  items: DocumentoBusca[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const PAGE_SIZE = 20;

const fmtChave = (chave: string) =>
  `${chave.slice(0, 4)}…${chave.slice(-8)}`;

const fmtCnpj = (v: string | null) => {
  if (!v) return '';
  const d = v.replace(/\D/g, '');
  if (d.length !== 14) return v;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
};

const fmtValor = (v: string | number | null) => {
  if (v == null) return '—';
  const n = typeof v === 'string' ? Number(v) : v;
  if (Number.isNaN(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const fmtData = (v: string | null) => (v ? new Date(v).toLocaleDateString('pt-BR') : '—');

/**
 * Busca de NF-e (18/06/2026) — por NÚMERO da nota (9 dígitos, NÃO a chave) ou
 * por RAZÃO SOCIAL (fornecedor/destinatário). 100% LOCAL: consulta apenas as
 * NF-es já baixadas (fiscal.documento_consulta), NUNCA dispara SEFAZ. O clique
 * na linha abre a Consulta NF-e por chave já existente.
 */
export function NfeBuscaPage() {
  const toast = useToast();

  const [tipo, setTipo] = useState<Tipo>('numero');
  const [termo, setTermo] = useState('');
  const [termoDebounced, setTermoDebounced] = useState('');
  const [items, setItems] = useState<DocumentoBusca[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [buscou, setBuscou] = useState(false);

  // Debounce de 350ms — busca só após parar de digitar.
  useEffect(() => {
    const t = setTimeout(() => {
      setTermoDebounced(termo);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [termo]);

  const carregar = useCallback(async () => {
    const termoLimpo = termoDebounced.trim();
    // Número precisa de ao menos 1 dígito; razão de ao menos 2 chars.
    const minOk = tipo === 'numero' ? /\d/.test(termoLimpo) : termoLimpo.length >= 2;
    if (!minOk) {
      setItems([]);
      setTotal(0);
      setTotalPages(0);
      setBuscou(false);
      return;
    }
    setLoading(true);
    try {
      const r = await fiscalApi.get<ListResp>('/nfe/buscar', {
        params: { tipo, termo: termoLimpo, page: String(page), limit: String(PAGE_SIZE) },
      });
      setItems(r.data.items);
      setTotal(r.data.total);
      setTotalPages(r.data.totalPages);
      setBuscou(true);
    } catch (err) {
      toast.error('Erro na busca de NF-e', extractApiError(err) ?? undefined);
    } finally {
      setLoading(false);
    }
  }, [tipo, termoDebounced, page, toast]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const trocarTipo = (t: Tipo) => {
    if (t === tipo) return;
    setTipo(t);
    setTermo('');
    setTermoDebounced('');
    setItems([]);
    setTotal(0);
    setTotalPages(0);
    setBuscou(false);
    setPage(1);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Busca de NF-e</h1>
        <p className="text-sm text-slate-600 mt-1">
          Localize uma NF-e já consultada pelo <strong>número da nota</strong> ou pela{' '}
          <strong>razão social</strong>. Clique na linha para abrir a Consulta NF-e completa.
        </p>
        <p className="text-xs text-slate-500 mt-1">
          ⓘ Busca apenas nos documentos já baixados — não consulta a SEFAZ. NF-es nunca consultadas
          por aqui não aparecem; e a razão social só existe para notas consultadas a partir de 18/06.
        </p>
      </div>

      {/* Abas tipo de busca */}
      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {([
          ['numero', '🔢 Por número da nota'],
          ['razao', '🏢 Por razão social'],
        ] as const).map(([t, label]) => (
          <button
            key={t}
            onClick={() => trocarTipo(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              tipo === t
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[260px]">
          <label className="block text-xs text-gray-600 mb-1">
            {tipo === 'numero' ? 'Número da nota fiscal' : 'Razão social (emitente ou destinatário)'}
          </label>
          <input
            type="text"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder={
              tipo === 'numero'
                ? 'Ex.: 12345 (os zeros à esquerda são ignorados)'
                : 'Ex.: parte do nome do fornecedor'
            }
            className={`w-full px-3 py-1.5 border rounded text-sm ${
              tipo === 'numero' ? 'font-mono' : ''
            }`}
            inputMode={tipo === 'numero' ? 'numeric' : 'text'}
            autoFocus
          />
        </div>
        <div className="text-sm text-slate-600">
          {loading ? 'Buscando…' : buscou ? `${total} ${total === 1 ? 'nota' : 'notas'}` : ''}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-700 text-xs uppercase">
            <tr>
              <th className="px-3 py-2 text-left">NF / Série</th>
              <th className="px-3 py-2 text-left">Emitente</th>
              <th className="px-3 py-2 text-left">Destinatário</th>
              <th className="px-3 py-2 text-left">Filial</th>
              <th className="px-3 py-2 text-right">Valor</th>
              <th className="px-3 py-2 text-left">Autorização</th>
              <th className="px-3 py-2 text-left">Chave</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                  {!buscou
                    ? tipo === 'numero'
                      ? 'Digite o número da nota para buscar.'
                      : 'Digite parte da razão social para buscar.'
                    : 'Nenhuma NF-e encontrada nos documentos já consultados.'}
                </td>
              </tr>
            )}
            {items.map((it) => (
              <tr key={it.id} className="border-t border-slate-100 hover:bg-sky-50">
                <td className="px-3 py-2 whitespace-nowrap font-medium">
                  <Link
                    to={`/nfe?chave=${it.chave}&filial=${it.filial}`}
                    className="text-sky-700 hover:underline"
                  >
                    {it.numeroNF ?? '—'}
                    {it.serie && <span className="text-slate-500"> / {it.serie}</span>}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <div className="text-slate-800">{it.emitenteRazaoSocial ?? '—'}</div>
                  {it.cnpjEmitente && (
                    <div className="text-xs text-slate-400 font-mono">{fmtCnpj(it.cnpjEmitente)}</div>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="text-slate-800">{it.destinatarioRazaoSocial ?? '—'}</div>
                  {it.cnpjDestinatario && (
                    <div className="text-xs text-slate-400 font-mono">
                      {fmtCnpj(it.cnpjDestinatario)}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2">{it.filial}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{fmtValor(it.valorTotal)}</td>
                <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-600">
                  {fmtData(it.dataAutorizacao)}
                  {it.statusAtual && (
                    <div>
                      <Badge variant="gray">{it.statusAtual}</Badge>
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  <Link
                    to={`/nfe?chave=${it.chave}&filial=${it.filial}`}
                    className="text-sky-700 hover:underline"
                    title={it.chave}
                  >
                    {fmtChave(it.chave)}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-slate-600">
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
            >
              ← Anterior
            </Button>
            <Button
              variant="secondary"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
            >
              Próximo →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
