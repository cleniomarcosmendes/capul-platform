import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Filter, RefreshCw } from 'lucide-react';
import { fiscalApi } from '../../../services/api';
import { Badge } from '../../../components/Badge';
import { Button } from '../../../components/Button';
import { useToast } from '../../../components/Toast';
import { extractApiError } from '../../../utils/errors';

type Status = 'OK' | 'BLOQUEADO' | 'LIMITE_ATINGIDO' | 'ERRO_SEFAZ' | 'CIRCUIT_BREAK' | 'ERRO_INTERNO';

interface LoteItem {
  id: number;
  cnpjConsulente: string;
  ambiente: number;
  iniciadoEm: string;
  finalizadoEm: string | null;
  iteracoes: number;
  ultNsuInicial: string;
  ultNsuFinal: string;
  maxNsuFinal: string;
  docsPersistidos: number;
  docsDuplicados: number;
  status: Status;
  cStatUltimo: string | null;
  xMotivoUltimo: string | null;
  motivoStop: string | null;
  origem: string;
  dryRun: boolean;
  duracaoMs: number | null;
  erroDetalhe: string | null;
}

interface ListResp {
  items: LoteItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const STATUS_OPTIONS: { v: '' | Status; l: string }[] = [
  { v: '', l: 'Todos' },
  { v: 'OK', l: 'OK' },
  { v: 'BLOQUEADO', l: 'Bloqueado' },
  { v: 'LIMITE_ATINGIDO', l: 'Limite atingido' },
  { v: 'ERRO_SEFAZ', l: 'Erro SEFAZ' },
  { v: 'CIRCUIT_BREAK', l: 'Circuit break' },
  { v: 'ERRO_INTERNO', l: 'Erro interno' },
];

const ORIGEM_OPTIONS = [
  { v: '', l: 'Todas' },
  { v: 'manual', l: 'Manual' },
  { v: 'cron', l: 'Cron automático' },
  { v: 'retry', l: 'Retry' },
];

const STATUS_VARIANT: Record<Status, 'green' | 'gray' | 'yellow' | 'red'> = {
  OK: 'green',
  BLOQUEADO: 'gray',
  LIMITE_ATINGIDO: 'yellow',
  ERRO_SEFAZ: 'red',
  CIRCUIT_BREAK: 'red',
  ERRO_INTERNO: 'red',
};

/**
 * Aba "Histórico" de /operacao/controle — lista paginada de cte_lote_consulta.
 * Toda execução do scheduler (cron) ou disparo manual gera um registro;
 * essa tela permite o operador investigar "o que rodou às 14h05 sexta?".
 */
export function CteHistoricoTab() {
  const toast = useToast();
  const [items, setItems] = useState<LoteItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'' | Status>('');
  const [origem, setOrigem] = useState('');
  const [ambiente, setAmbiente] = useState<'' | '1' | '2'>('');
  const [expandido, setExpandido] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '20' };
      if (status) params.status = status;
      if (origem) params.origem = origem;
      if (ambiente) params.ambiente = ambiente;
      const r = await fiscalApi.get<ListResp>('/cte/lotes', { params });
      setItems(r.data.items);
      setTotal(r.data.total);
      setTotalPages(r.data.totalPages);
    } catch (err) {
      toast.error('Erro ao carregar histórico', extractApiError(err) ?? undefined);
    } finally {
      setLoading(false);
    }
  }, [page, status, origem, ambiente, toast]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <>
      {/* Filtros */}
      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-3">
          <Filter size={16} />
          Filtros
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-slate-600 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as Status | '');
                setPage(1);
              }}
              className="w-full px-3 py-1.5 border rounded text-sm"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.v} value={s.v}>
                  {s.l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Origem</label>
            <select
              value={origem}
              onChange={(e) => {
                setOrigem(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 border rounded text-sm"
            >
              {ORIGEM_OPTIONS.map((s) => (
                <option key={s.v} value={s.v}>
                  {s.l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Ambiente SEFAZ</label>
            <select
              value={ambiente}
              onChange={(e) => {
                setAmbiente(e.target.value as '' | '1' | '2');
                setPage(1);
              }}
              className="w-full px-3 py-1.5 border rounded text-sm"
            >
              <option value="">Todos</option>
              <option value="1">Produção</option>
              <option value="2">Homologação</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button variant="ghost" onClick={() => carregar()} disabled={loading}>
              <RefreshCw size={16} className="mr-1" />
              Recarregar
            </Button>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-2 text-sm text-slate-600 border-b">
          {total} execução(ões) — página {page} de {Math.max(totalPages, 1)}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left">Início</th>
                <th className="px-3 py-2 text-left">CNPJ</th>
                <th className="px-3 py-2 text-left">Amb.</th>
                <th className="px-3 py-2 text-left">Origem</th>
                <th className="px-3 py-2 text-right">Iter.</th>
                <th className="px-3 py-2 text-right">Docs+</th>
                <th className="px-3 py-2 text-right">Dup.</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Duração</th>
                <th className="px-3 py-2 text-left">Motivo stop</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading && items.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-slate-500">
                    Carregando…
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-slate-500">
                    Nenhuma execução encontrada — scheduler ainda não rodou ou flag inativa.
                  </td>
                </tr>
              )}
              {items.map((it) => (
                <>
                  <tr
                    key={it.id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => setExpandido(expandido === it.id ? null : it.id)}
                  >
                    <td className="px-3 py-2 text-xs">
                      {new Date(it.iniciadoEm).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{it.cnpjConsulente}</td>
                    <td className="px-3 py-2">
                      <Badge variant={it.ambiente === 1 ? 'red' : 'yellow'}>
                        {it.ambiente === 1 ? 'PROD' : 'HOM'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {it.origem}
                      {it.dryRun && <span className="ml-1 text-amber-600">(dry)</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-xs">{it.iteracoes}</td>
                    <td className="px-3 py-2 text-right text-xs">{it.docsPersistidos}</td>
                    <td className="px-3 py-2 text-right text-xs text-slate-500">
                      {it.docsDuplicados}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={STATUS_VARIANT[it.status]}>{it.status}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right text-xs">
                      {it.duracaoMs != null ? `${it.duracaoMs}ms` : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs max-w-md truncate" title={it.motivoStop ?? ''}>
                      {it.motivoStop ?? '—'}
                    </td>
                  </tr>
                  {expandido === it.id && (
                    <tr key={`${it.id}-exp`}>
                      <td colSpan={10} className="px-3 py-3 bg-slate-50 text-xs">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <span className="text-slate-500">NSU inicial → final:</span>{' '}
                            <span className="font-mono">
                              {it.ultNsuInicial} → {it.ultNsuFinal}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500">maxNSU final:</span>{' '}
                            <span className="font-mono">{it.maxNsuFinal}</span>
                          </div>
                          {it.cStatUltimo && (
                            <div>
                              <span className="text-slate-500">cStat último:</span> {it.cStatUltimo}
                            </div>
                          )}
                          {it.xMotivoUltimo && (
                            <div className="col-span-2">
                              <span className="text-slate-500">xMotivo:</span>{' '}
                              {it.xMotivoUltimo}
                            </div>
                          )}
                          {it.finalizadoEm && (
                            <div>
                              <span className="text-slate-500">Finalizou em:</span>{' '}
                              {new Date(it.finalizadoEm).toLocaleString('pt-BR')}
                            </div>
                          )}
                          {it.erroDetalhe && (
                            <div className="col-span-2">
                              <span className="text-slate-500">Erro:</span>
                              <pre className="mt-1 bg-red-50 border border-red-200 rounded p-2 text-red-800 whitespace-pre-wrap break-all">
                                {it.erroDetalhe}
                              </pre>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-4 py-2 border-t flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
            >
              <ChevronLeft size={16} />
            </Button>
            <span className="text-sm">
              {page} / {totalPages}
            </span>
            <Button
              variant="ghost"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
