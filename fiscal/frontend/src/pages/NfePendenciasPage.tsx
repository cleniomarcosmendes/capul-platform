import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fiscalApi } from '../services/api';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { PromptDialog } from '../components/PromptDialog';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { extractApiError } from '../utils/errors';

interface DocumentoPendencia {
  id: string;
  chave: string;
  filial: string;
  cnpjEmitente: string | null;
  numeroNF: string | null;
  serie: string | null;
  protheusGrvXmlGravado: boolean | null;
  protheusGrvPrenotaFalhou: boolean | null;
  protheusGrvPendAmarracao: boolean | null;
  protheusGrvMensagem: string | null;
  inconsistenciaResolvidaEm: string | null;
  inconsistenciaResolvidaPorNome: string | null;
  inconsistenciaObservacao: string | null;
  updatedAt: string;
}

interface ListResp {
  items: DocumentoPendencia[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const PAGE_SIZE = 20;

const fmtChave = (chave: string) =>
  `${chave.slice(0, 4)} ${chave.slice(4, 8)} ${chave.slice(8, 22)}…${chave.slice(-8)}`;

/**
 * Lista NF-es onde nossa aplicação chamou grvXML e Protheus retornou pendência
 * operacional (preNotaFalhou ou pendenteAmarracao). Conjunto finito — não
 * inclui NF-es gravadas por outros meios (importação manual, integração legada).
 *
 * Operador resolve a pendência manualmente no Protheus, depois marca aqui.
 * Default: lista somente pendentes (não resolvidas). Toggle pra histórico.
 */
export function NfePendenciasPage() {
  const toast = useToast();
  const confirm = useConfirm();

  const [items, setItems] = useState<DocumentoPendencia[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  // Busca com DEBOUNCE (mesmo padrão de AtivosListPage/RfbCruzamentoTab):
  // o input mexe só em `search` (UI imediata); 350ms após parar de digitar,
  // propaga p/ `searchDebounced` (que alimenta o fetch). Sem isso era 1
  // request/tecla → desperdício + risco de 429 no limit_req do nginx.
  const [searchDebounced, setSearchDebounced] = useState('');
  const [filtro, setFiltro] = useState<'pendentes' | 'resolvidas' | 'todas'>('pendentes');
  const [marcandoId, setMarcandoId] = useState<string | null>(null);
  const [promptDocId, setPromptDocId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(page),
        limit: String(PAGE_SIZE),
        inconsistenciaFiltro: filtro,
      };
      if (searchDebounced) params.search = searchDebounced.replace(/\D/g, '');
      const r = await fiscalApi.get<ListResp>('/nfe/pendencias', { params });
      setItems(r.data.items);
      setTotal(r.data.total);
      setTotalPages(r.data.totalPages);
    } catch (err) {
      toast.error('Erro ao carregar pendências NF-e', extractApiError(err) ?? undefined);
    } finally {
      setLoading(false);
    }
  }, [page, searchDebounced, filtro, toast]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Debounce: aplica a busca 350ms após parar de digitar + volta p/ pág. 1.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchDebounced(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const confirmarMarcarResolvida = async (observacao: string) => {
    const id = promptDocId;
    setPromptDocId(null);
    if (!id) return;
    setMarcandoId(id);
    try {
      await fiscalApi.post(`/nfe/${id}/marcar-resolvida`, {
        observacao: observacao.trim() || undefined,
      });
      toast.success('Inconsistência marcada como resolvida');
      void carregar();
    } catch (err) {
      toast.error('Falha ao marcar', extractApiError(err) ?? undefined);
    } finally {
      setMarcandoId(null);
    }
  };

  const desmarcarResolvida = async (id: string) => {
    const ok = await confirm({
      title: 'Desmarcar resolução?',
      description: 'Use só se marcou por engano — vai voltar pra fila de pendências.',
      variant: 'warning',
      confirmLabel: 'Desmarcar',
    });
    if (!ok) return;
    setMarcandoId(id);
    try {
      await fiscalApi.post(`/nfe/${id}/desmarcar-resolvida`);
      toast.success('Resolução desmarcada');
      void carregar();
    } catch (err) {
      toast.error('Falha ao desmarcar', extractApiError(err) ?? undefined);
    } finally {
      setMarcandoId(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Pendências NF-e no Protheus</h1>
        <p className="text-sm text-slate-600 mt-1">
          NF-es gravadas pela nossa aplicação que tiveram pendência operacional no Protheus
          (pré-nota falhou ou aguarda amarração). Após resolver manualmente no ERP, marque aqui.
        </p>
        <p className="text-xs text-slate-500 mt-1">
          ⓘ NF-es gravadas por outros meios (importação manual, integração legada) não aparecem
          nesta lista — não temos os flags de resposta do Protheus pra elas.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-gray-600 mb-1">Buscar por chave</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cole a chave de 44 dígitos"
            className="w-full px-3 py-1.5 border rounded text-sm font-mono"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Filtro</label>
          <select
            value={filtro}
            onChange={(e) => {
              setFiltro(e.target.value as 'pendentes' | 'resolvidas' | 'todas');
              setPage(1);
            }}
            className="px-3 py-1.5 border rounded text-sm"
          >
            <option value="pendentes">⚠ Pendentes de correção</option>
            <option value="resolvidas">✓ Resolvidas manualmente</option>
            <option value="todas">Todas</option>
          </select>
        </div>
        <div className="text-sm text-slate-600">
          {loading ? 'Carregando…' : `${total} ${total === 1 ? 'documento' : 'documentos'}`}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-700 text-xs uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Chave</th>
              <th className="px-3 py-2 text-left">NF / Série</th>
              <th className="px-3 py-2 text-left">Filial</th>
              <th className="px-3 py-2 text-left">Tipo de pendência</th>
              <th className="px-3 py-2 text-left">Última atualização</th>
              <th className="px-3 py-2 text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                  {filtro === 'pendentes'
                    ? '✓ Nenhuma pendência de correção. Tudo em dia.'
                    : 'Nenhum documento encontrado.'}
                </td>
              </tr>
            )}
            {items.map((it) => (
              <tr key={it.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 font-mono text-xs">
                  <Link
                    to={`/nfe?chave=${it.chave}&filial=${it.filial}`}
                    className="text-blue-700 hover:underline"
                  >
                    {fmtChave(it.chave)}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  {it.numeroNF ?? '—'}
                  {it.serie && <span className="text-slate-500"> / {it.serie}</span>}
                </td>
                <td className="px-3 py-2">{it.filial}</td>
                <td className="px-3 py-2">
                  {it.inconsistenciaResolvidaEm ? (
                    <span
                      title={`Resolvida por ${it.inconsistenciaResolvidaPorNome ?? '?'} em ${new Date(
                        it.inconsistenciaResolvidaEm,
                      ).toLocaleString('pt-BR')}${it.inconsistenciaObservacao ? ` — "${it.inconsistenciaObservacao}"` : ''}`}
                    >
                      <Badge variant="green">✓ Resolvida</Badge>
                    </span>
                  ) : it.protheusGrvPrenotaFalhou ? (
                    <span title={it.protheusGrvMensagem ?? 'Pré-nota falhou'}>
                      <Badge variant="yellow">⚠ Pré-nota pendente</Badge>
                    </span>
                  ) : it.protheusGrvPendAmarracao ? (
                    <span title={it.protheusGrvMensagem ?? 'Aguarda amarração'}>
                      <Badge variant="yellow">⚠ Aguarda amarração</Badge>
                    </span>
                  ) : (
                    <Badge variant="gray">—</Badge>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  {new Date(it.updatedAt).toLocaleString('pt-BR')}
                </td>
                <td className="px-3 py-2 text-right">
                  {it.inconsistenciaResolvidaEm ? (
                    <Button
                      variant="secondary"
                      onClick={() => desmarcarResolvida(it.id)}
                      loading={marcandoId === it.id}
                    >
                      Desmarcar
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      onClick={() => setPromptDocId(it.id)}
                      loading={marcandoId === it.id}
                    >
                      ✓ Marcar resolvida
                    </Button>
                  )}
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
      <PromptDialog
        open={!!promptDocId}
        title="Marcar inconsistência como resolvida"
        description="Confirma que a pendência foi resolvida manualmente no Protheus?"
        label="Observação"
        placeholder='Ex: "cadastrado SA2 da BRASPRESS e concluí pré-nota"'
        inputType="textarea"
        rows={3}
        maxLength={500}
        confirmLabel="Marcar resolvida"
        onConfirm={confirmarMarcarResolvida}
        onCancel={() => setPromptDocId(null)}
      />
    </div>
  );
}
