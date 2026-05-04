import { useEffect, useMemo, useState } from 'react';
import { Search, RotateCcw, Loader2 } from 'lucide-react';
import { countingListService } from '../../../services/counting-list.service';
import type { CountingList, CountingListProduct } from '../../../types';

type SortOrder = 'ORIGINAL' | 'PRODUCT_CODE' | 'PRODUCT_DESCRIPTION' | 'LOCAL1' | 'LOCAL2' | 'LOCAL3';

interface DevolverListaModalProps {
  lista: CountingList;
  onCancel: () => void;
  onConfirm: (motivo: string, itemIds: string[], sortOrder?: SortOrder) => void;  // itemIds vazio = devolução total
  loading: boolean;
  currentSortOrder?: SortOrder;
}

/**
 * Modal de devolução do supervisor → contador.
 *
 * Modos:
 * - "Todos os itens" (default): backend marca todos os itens contados no ciclo atual.
 * - "Selecionar itens": supervisor escolhe especificamente quais precisam de revisão.
 *
 * Em ambos os casos, as contagens existentes são MANTIDAS — o contador faz revisão.
 */
export function DevolverListaModal({ lista, onCancel, onConfirm, loading, currentSortOrder }: DevolverListaModalProps) {
  const [motivo, setMotivo] = useState('');
  const [parcial, setParcial] = useState(false);
  const [busca, setBusca] = useState('');
  const [items, setItems] = useState<CountingListProduct[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [loadingItems, setLoadingItems] = useState(false);
  // Default = manter o sort_order atual da lista (se houver) — supervisor escolhe trocar se quiser
  const [sortOrder, setSortOrder] = useState<SortOrder>(currentSortOrder || 'ORIGINAL');

  // Carrega itens quando entra em modo parcial
  useEffect(() => {
    if (!parcial || items.length > 0) return;
    setLoadingItems(true);
    countingListService.listarItens(lista.id, true)  // show_all=true (mostra todos os itens da lista)
      .then((res) => {
        setItems(res.data?.products || []);
      })
      .catch(() => {
        setItems([]);
      })
      .finally(() => setLoadingItems(false));
  }, [parcial, lista.id, items.length]);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) =>
      p.product_code.toLowerCase().includes(q)
      || (p.product_description || p.product_name || '').toLowerCase().includes(q)
    );
  }, [items, busca]);

  function toggleSelect(itemId: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function selectAll() {
    setSelecionados(new Set(filtered.map((p) => p.id)));
  }

  function clearAll() {
    setSelecionados(new Set());
  }

  function handleConfirm() {
    const ids = parcial ? Array.from(selecionados) : [];
    // Só envia sort_order se for diferente do atual (caso contrário backend mantém)
    const newSort = sortOrder !== currentSortOrder ? sortOrder : undefined;
    onConfirm(motivo, ids, newSort);
  }

  const podeConfirmar = !loading && (!parcial || selecionados.size > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header fixo */}
        <div className="p-6 pb-4 shrink-0 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-purple-600" />
            Devolver lista para revisao
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            A lista volta a EM_CONTAGEM. As contagens existentes sao mantidas — o contador
            apenas revisa os itens marcados.
          </p>
        </div>

        {/* Conteúdo scrollável */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="text-xs bg-slate-50 rounded-lg p-3 grid grid-cols-3 gap-2">
            <div><span className="text-slate-500">Lista:</span> <strong className="text-slate-800">{lista.list_name}</strong></div>
            <div><span className="text-slate-500">Ciclo:</span> <strong className="text-slate-800">{lista.current_cycle}o</strong></div>
            <div><span className="text-slate-500">Itens:</span> <strong className="text-slate-800">{lista.total_items ?? 0}</strong></div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Motivo geral (opcional)
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              placeholder="Ex: Conferir produtos do setor X, recontar itens de lote..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500"
            />
          </div>

        {/* Toggle modo */}
        <div className="flex gap-2 border border-slate-200 rounded-lg p-1">
          <button
            onClick={() => setParcial(false)}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              !parcial ? 'bg-purple-100 text-purple-700' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Todos os itens contados
          </button>
          <button
            onClick={() => setParcial(true)}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              parcial ? 'bg-purple-100 text-purple-700' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Selecionar itens especificos
          </button>
        </div>

        {/* Lista de itens (modo parcial) */}
        {parcial ? (
          <>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar codigo ou descricao..."
                  className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-capul-500"
                />
              </div>
              <button onClick={selectAll} className="text-xs px-2.5 py-1.5 text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200">
                Marcar todos
              </button>
              <button onClick={clearAll} className="text-xs px-2.5 py-1.5 text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200">
                Limpar
              </button>
            </div>

            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-lg min-h-[200px] max-h-[300px]">
              {loadingItems ? (
                <div className="flex items-center justify-center h-32 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Carregando itens...
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  {busca ? 'Nenhum item com este filtro.' : 'Nenhum item na lista.'}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-center w-10 py-2"></th>
                      <th className="text-left py-2 px-2 font-medium text-slate-600">Codigo</th>
                      <th className="text-left py-2 px-2 font-medium text-slate-600">Descricao</th>
                      <th className="text-right py-2 px-2 font-medium text-slate-600">C{lista.current_cycle}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => {
                      const cycle = lista.current_cycle;
                      const cnt = cycle === 1 ? p.count_cycle_1 : cycle === 2 ? p.count_cycle_2 : p.count_cycle_3;
                      const checked = selecionados.has(p.id);
                      return (
                        <tr
                          key={p.id}
                          onClick={() => toggleSelect(p.id)}
                          className={`border-b border-slate-100 cursor-pointer ${checked ? 'bg-purple-50' : 'hover:bg-slate-50'}`}
                        >
                          <td className="text-center py-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSelect(p.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td className="py-2 px-2 font-mono text-xs text-slate-700">{p.product_code}</td>
                          <td className="py-2 px-2 text-slate-800 truncate max-w-[280px]">
                            {p.product_description || p.product_name}
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums text-slate-700">
                            {cnt !== null ? cnt.toFixed(2) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <p className="text-xs text-slate-500">
              <strong>{selecionados.size}</strong> de {filtered.length} item(ns) selecionado(s) para revisao.
            </p>
          </>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            <strong>Todos os itens contados</strong> serao marcados para revisao.
            O contador vera os itens com badge "Revisar" no topo da lista, mantendo as contagens
            atuais para confirmar ou editar.
          </div>
        )}

          {/* Ordenação dos produtos para o contador (re-liberação pode mudar) */}
          <div className="border-t border-slate-200 pt-3">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Ordem dos produtos para o contador
            </label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-capul-500"
            >
              <option value="ORIGINAL">Ordem original (sequência da lista)</option>
              <option value="LOCAL1">Localização 1 ⭐ (ordem física das prateleiras — recomendado)</option>
              <option value="LOCAL2">Localização 2 (ordem física das prateleiras)</option>
              <option value="LOCAL3">Localização 3 (ordem física das prateleiras)</option>
              <option value="PRODUCT_CODE">Código do produto</option>
              <option value="PRODUCT_DESCRIPTION">Descrição (alfabético)</option>
            </select>
            {currentSortOrder && currentSortOrder !== sortOrder && (
              <p className="text-[11px] text-amber-600 mt-1">
                ⚠ Você está alterando a ordenação anterior ({currentSortOrder}).
              </p>
            )}
          </div>
        </div>
        {/* /conteúdo scrollável */}

        {/* Footer fixo — sempre visível */}
        <div className="flex gap-2 justify-end p-6 pt-4 border-t border-slate-200 shrink-0 bg-white rounded-b-xl">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!podeConfirmar}
            className="px-4 py-2 text-sm text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Devolver{parcial && selecionados.size > 0 ? ` (${selecionados.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
