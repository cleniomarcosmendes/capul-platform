import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { inventoryService } from '../../services/inventory.service';
import { countingListService } from '../../services/counting-list.service';
import { ScannerInput } from './components/ScannerInput';
import { CountingProgress } from './components/CountingProgress';
import { LoteContagemModal } from './components/LoteContagemModal';
import { ListasResponsaveis } from './components/ListasResponsaveis';
import { useCountingData } from './hooks/useCountingData';
import { ArrowLeft, ChevronLeft, ChevronRight, Check, Loader2, Layers, CheckCircle2, Send } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import type { LotCount } from '../../types';

const cycleColors = ['', 'bg-green-600', 'bg-amber-600', 'bg-red-600'];

export function ContagemMobilePage() {
  const { inventoryId } = useParams<{ inventoryId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const listIdHint = searchParams.get('list') || undefined;
  const {
    inventario, products, loading, stats,
    currentListId, currentCycle, currentListName, getCountedQty, countCycleKey, updateProduct,
    noAssignedList, listNotReleased, notCounterOfRequested, partialReviewMode,
    allLists, assignedLists, counterNames, showPreviousCounts,
  } = useCountingData(inventoryId!, listIdHint);
  const toast = useToast();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [quantity, setQuantity] = useState('');
  const [observation, setObservation] = useState('');
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState(false);
  const [showLotModal, setShowLotModal] = useState(false);
  const [showCompletionScreen, setShowCompletionScreen] = useState(false);
  const [showHandoffConfirm, setShowHandoffConfirm] = useState(false);
  const [handoffLoading, setHandoffLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevPendingRef = useRef<number | null>(null);

  // Detecta transição "tinha pendentes → zero pendentes" para mostrar tela de conclusão.
  useEffect(() => {
    const prev = prevPendingRef.current;
    if (prev !== null && prev > 0 && stats.pending === 0 && stats.total > 0) {
      setShowCompletionScreen(true);
    }
    prevPendingRef.current = stats.pending;
  }, [stats.pending, stats.total]);

  // No fluxo normal `products` = allProducts (filter='all'). Em modo revisão parcial
  // o hook força filter='revisar' → products contém só os marcados pelo supervisor.
  // Navegação Anterior/Próximo opera sobre `products` em ambos os casos.
  const currentProduct = products[currentIndex] || null;
  const isLotProduct = currentProduct?.requires_lot || currentProduct?.has_lot;

  // Focus input when product changes
  useEffect(() => {
    if (currentProduct && inputRef.current && !isLotProduct) {
      const counted = getCountedQty(currentProduct);
      if (counted !== null) {
        setQuantity(String(counted));
      } else {
        setQuantity('');
      }
      setObservation('');
      inputRef.current.focus();
    }
    if (currentProduct && isLotProduct) {
      const counted = getCountedQty(currentProduct);
      if (counted !== null) {
        setQuantity(String(counted));
      } else {
        setQuantity('');
      }
    }
  }, [currentIndex, currentProduct, getCountedQty, isLotProduct]);

  // Scanner: find product and navigate to it
  const handleScan = useCallback((code: string) => {
    const idx = products.findIndex(
      (p) => p.product_code.toUpperCase() === code.toUpperCase()
        || p.product_code.toUpperCase().endsWith(code.toUpperCase()),
    );
    if (idx >= 0) {
      setCurrentIndex(idx);
    } else {
      toast.warning(`Produto "${code}" nao encontrado.`);
    }
  }, [products]);

  // Advance to next pending after save. Returns true if moved, false if stayed.
  function advanceToNext(): boolean {
    const isPending = (p: typeof products[number]) =>
      p.status === 'PENDING' || p.status === 'pending';
    // 1) próximo pendente à frente
    const nextPendingIdx = products.findIndex((p, i) => i > currentIndex && isPending(p));
    if (nextPendingIdx >= 0) {
      setCurrentIndex(nextPendingIdx);
      return true;
    }
    // 2) wrap-around: pendente em qualquer outro índice (estamos no último mas há pendentes atrás)
    const wrapPendingIdx = products.findIndex((p, i) => i !== currentIndex && isPending(p));
    if (wrapPendingIdx >= 0) {
      setCurrentIndex(wrapPendingIdx);
      return true;
    }
    // 3) próximo índice (sequencial) se não estamos no último
    if (currentIndex < products.length - 1) {
      setCurrentIndex(currentIndex + 1);
      return true;
    }
    return false;
  }

  // Save count (cycle-aware) — for non-lot products
  const handleSave = useCallback(async () => {
    if (!currentProduct) return;

    // For lot products, open the lot modal instead
    if (isLotProduct) {
      setShowLotModal(true);
      return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty < 0) {
      toast.warning('Informe uma quantidade valida.');
      return;
    }

    // Saber se este save vai zerar pending (precisa decidir antes do updateProduct)
    const wasNotCounted = getCountedQty(currentProduct) === null;
    const willCloseList = wasNotCounted ? stats.pending === 1 : stats.pending === 0;

    setSaving(true);
    try {
      await inventoryService.registrarContagem(currentProduct.id, {
        quantity: qty,
        observation: observation.trim() || undefined,
      });
      updateProduct(currentProduct.id, {
        [countCycleKey]: qty,
        status: 'COUNTED',
      } as Record<string, unknown>);

      setFlash(true);
      setTimeout(() => setFlash(false), 500);

      if (willCloseList) {
        setShowCompletionScreen(true);
      } else {
        const moved = advanceToNext();
        if (!moved) {
          // Sem item para avançar (último, sem outros pendentes) — feedback explícito.
          toast.success(wasNotCounted ? 'Contagem salva.' : 'Contagem atualizada.');
        }
      }
    } catch {
      toast.error('Erro ao salvar contagem.');
    } finally {
      setSaving(false);
    }
  }, [currentProduct, quantity, observation, currentIndex, products, updateProduct, countCycleKey, isLotProduct, getCountedQty, stats.pending]);

  // Save lot-based count
  const handleSaveLotCount = useCallback(async (totalQty: number, lotCounts: LotCount[]) => {
    if (!currentProduct) return;
    const wasNotCounted = getCountedQty(currentProduct) === null;
    const willCloseList = wasNotCounted ? stats.pending === 1 : stats.pending === 0;

    await inventoryService.registrarContagem(currentProduct.id, {
      quantity: totalQty,
      lot_counts: lotCounts,
    });
    updateProduct(currentProduct.id, {
      [countCycleKey]: totalQty,
      status: 'COUNTED',
    } as Record<string, unknown>);
    setShowLotModal(false);
    setFlash(true);
    setTimeout(() => setFlash(false), 500);
    toast.success(`Contagem por lote salva — ${lotCounts.length} lote(s).`);

    if (willCloseList) {
      setShowCompletionScreen(true);
    } else {
      advanceToNext();
    }
  }, [currentProduct, updateProduct, countCycleKey, currentIndex, products, getCountedQty, stats.pending]);

  function handleClear() {
    setQuantity('');
    setObservation('');
    inputRef.current?.focus();
  }

  function handlePrev() {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  }

  function handleNext() {
    if (currentIndex < products.length - 1) setCurrentIndex(currentIndex + 1);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleSave();
    }
  }

  async function handleHandoff() {
    if (!currentListId) return;
    setHandoffLoading(true);
    try {
      const res = await countingListService.liberarParaSupervisor(currentListId);
      const zerados = res.zerados || 0;
      toast.success(
        zerados > 0
          ? `Lista entregue ao supervisor. ${zerados} item(ns) nao contado(s) registrado(s) como zero.`
          : 'Lista entregue ao supervisor.'
      );
      setShowHandoffConfirm(false);
      navigate('/inventario/contagem');
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(detail || 'Erro ao liberar lista para supervisor.');
    } finally {
      setHandoffLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-capul-500 animate-spin" />
      </div>
    );
  }

  // Bloqueio: lista solicitada existe mas user não é contador dela no ciclo atual
  if (notCounterOfRequested) {
    const ownerName = notCounterOfRequested.counterId
      ? counterNames[notCounterOfRequested.counterId] || 'outro contador'
      : 'ninguém';
    return (
      <div className="min-h-screen max-w-md mx-auto bg-slate-50 flex flex-col shadow-xl ring-1 ring-slate-200">
        <div className="bg-capul-600 text-white px-4 py-3 flex items-center shrink-0">
          <button onClick={() => navigate('/inventario/contagem')} className="p-1">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-medium text-sm ml-2 truncate">Acesso negado</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 space-y-2">
            <p className="font-semibold text-amber-900">Você não é o contador desta lista</p>
            <p className="text-sm text-amber-800">
              A lista <strong>{notCounterOfRequested.listName}</strong> está atribuída a{' '}
              <strong>{ownerName}</strong> no {notCounterOfRequested.counterCycle}º ciclo.
              Apenas o contador atribuído pode realizar a contagem (mesmo administradores
              não devem contar pelo outro — mantém a auditoria limpa).
            </p>
          </div>
          {assignedLists.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-2">Suas listas neste inventário:</p>
              {assignedLists.map((l) => (
                <button
                  key={l.id}
                  onClick={() => navigate(`/inventario/contagem/${inventoryId}/mobile?list=${l.id}`)}
                  className="w-full text-left bg-white border border-slate-200 rounded-xl p-3 hover:border-capul-400 mb-2"
                >
                  <p className="font-semibold text-slate-800">{l.list_name}</p>
                  <p className="text-xs text-slate-500">
                    {l.current_cycle}º ciclo · {l.total_items ?? 0} itens
                  </p>
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => navigate('/inventario/contagem')}
            className="w-full py-2.5 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Voltar para listas
          </button>
        </div>
      </div>
    );
  }

  // Quando o operador tem 2+ listas atribuidas e nao escolheu uma → mostra selecao
  if (!currentListId && assignedLists.length >= 2) {
    return (
      <div className="min-h-screen max-w-md mx-auto bg-slate-50 flex flex-col shadow-xl ring-1 ring-slate-200">
        <div className="bg-capul-600 text-white px-4 py-3 flex items-center shrink-0">
          <button onClick={() => navigate('/inventario/contagem')} className="p-1">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-medium text-sm ml-2 truncate">{inventario?.name || 'Contagem'}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div>
            <p className="text-slate-700 font-medium">Selecione uma lista</p>
            <p className="text-sm text-slate-500 mt-0.5">Voce e contador de {assignedLists.length} listas neste inventario.</p>
          </div>
          {assignedLists.map((l) => {
            const total = l.total_items ?? 0;
            const counted = l.counted_items ?? 0;
            const pending = total - counted;
            return (
              <button
                key={l.id}
                onClick={() => navigate(`/inventario/contagem/${inventoryId}/mobile?list=${l.id}`)}
                className="w-full text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-capul-400 hover:bg-capul-50/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-slate-800">{l.list_name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    {l.current_cycle}o Ciclo
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span>Itens: <strong className="text-slate-700">{total}</strong></span>
                  <span>Contados: <strong className="text-green-600">{counted}</strong></span>
                  <span>Pendentes: <strong className="text-amber-600">{pending}</strong></span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (noAssignedList || listNotReleased) {
    return (
      <div className="min-h-screen max-w-md mx-auto bg-slate-50 flex flex-col shadow-xl ring-1 ring-slate-200">
        <div className="bg-capul-600 text-white px-4 py-3 flex items-center shrink-0">
          <button onClick={() => navigate('/inventario/contagem')} className="p-1">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-medium text-sm ml-2">Contagem</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="text-center mt-4">
            {listNotReleased ? (
              <>
                <p className="text-slate-600 font-medium">Lista ainda nao liberada</p>
                <p className="text-sm text-slate-400 mt-1">A lista precisa ser liberada antes de iniciar a contagem.</p>
              </>
            ) : (
              <>
                <p className="text-slate-600 font-medium">Nenhuma lista atribuida a voce</p>
                <p className="text-sm text-slate-400 mt-1">Voce nao e contador de nenhuma lista neste inventario.</p>
              </>
            )}
          </div>
          <ListasResponsaveis listas={allLists} counterNames={counterNames} />
        </div>
      </div>
    );
  }

  const countedQty = currentProduct ? getCountedQty(currentProduct) : null;

  return (
    <div className={`min-h-screen max-w-md mx-auto flex flex-col transition-colors shadow-xl ring-1 ring-slate-200 ${flash ? 'bg-green-100' : 'bg-slate-50'}`}>
      {/* Header fino */}
      <div className={`${cycleColors[currentCycle] || 'bg-capul-600'} text-white px-4 py-3 flex items-center justify-between shrink-0`}>
        <button onClick={() => navigate('/inventario/contagem')} className="p-1">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 mx-2 min-w-0 text-center">
          <div className="font-medium text-sm truncate">
            {inventario?.name || 'Contagem'}
          </div>
          {currentListName && (
            <div className="text-[11px] opacity-90 truncate">
              {currentListName} {showPreviousCounts ? '· aberto' : '· cego'}
            </div>
          )}
        </div>
        <span className="text-xs bg-white/20 px-2 py-0.5 rounded font-bold">
          {currentCycle}o Ciclo
        </span>
      </div>

      {/* Banner: modo revisão parcial — supervisor marcou apenas alguns itens */}
      {partialReviewMode && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 shrink-0">
          <p className="text-xs text-amber-800">
            <strong>Modo revisão:</strong> mostrando apenas {products.length} item{products.length === 1 ? '' : 's'}{' '}
            marcado{products.length === 1 ? '' : 's'} pelo supervisor. Itens já aprovados não aparecem.
          </p>
        </div>
      )}

      {/* Progresso */}
      <div className="px-4 py-2 bg-white border-b border-slate-200 shrink-0 flex items-center gap-3">
        <div className="flex-1">
          <CountingProgress
            total={stats.total}
            counted={stats.counted}
            compact
          />
        </div>
        {currentListId && (
          <button
            onClick={() => setShowHandoffConfirm(true)}
            disabled={handoffLoading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 whitespace-nowrap shadow-sm"
            title="Bipou todos os produtos físicos disponíveis? Clique aqui para entregar a lista ao supervisor. Itens não bipados serão registrados como zero."
          >
            <Send className="w-4 h-4" />
            Liberar
          </button>
        )}
      </div>

      {/* Scanner */}
      <div className="px-4 py-3 bg-white border-b border-slate-100 shrink-0">
        <ScannerInput onScan={handleScan} size="large" autoFocus={false} />
      </div>

      {/* Card do produto */}
      <div className="flex-1 p-4 flex items-center justify-center">
        {showCompletionScreen ? (
          <div className="bg-white rounded-xl border border-green-200 shadow-sm w-full max-w-md p-6 space-y-4 text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Contagem concluída!</h2>
            <p className="text-sm text-slate-600">
              Você contou todos os {stats.total} produtos do {currentCycle}º ciclo.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => setShowHandoffConfirm(true)}
                disabled={handoffLoading}
                className="w-full py-3 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
              >
                {handoffLoading ? 'Liberando...' : 'Liberar para supervisor'}
              </button>
              <button
                onClick={() => navigate('/inventario/contagem')}
                className="w-full py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200"
              >
                Voltar para Listas
              </button>
              <button
                onClick={() => setShowCompletionScreen(false)}
                className="w-full py-2 text-slate-500 text-xs hover:text-slate-700"
              >
                Revisar contagens
              </button>
            </div>
          </div>
        ) : !currentProduct ? (
          <div className="text-center text-slate-500">
            <p>Nenhum produto para contar.</p>
          </div>
        ) : (
          <div className={`bg-white rounded-xl border shadow-sm w-full max-w-md p-5 space-y-4 ${
            currentProduct.revisar_no_ciclo ? 'border-purple-300 ring-2 ring-purple-100' : 'border-slate-200'
          }`}>
            {/* Banner: revisar (supervisor devolveu este item) */}
            {currentProduct.revisar_no_ciclo && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs text-purple-800">
                <p className="font-semibold mb-0.5">Marcado para revisao pelo supervisor</p>
                {currentProduct.motivo_revisao && (
                  <p className="text-purple-700">Motivo: {currentProduct.motivo_revisao}</p>
                )}
                <p className="text-purple-600 mt-1">
                  Confirme a contagem atual ou edite com o novo valor.
                </p>
              </div>
            )}

            {/* Info do produto */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-xs text-slate-400">Codigo</p>
                {isLotProduct && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-medium">
                    <Layers className="w-3 h-3" />
                    Lote
                  </span>
                )}
              </div>
              <p className="text-lg font-mono font-bold text-slate-800">{currentProduct.product_code}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Descricao</p>
              <p className="text-base text-slate-700">{currentProduct.product_description || currentProduct.product_name}</p>
            </div>
            <div className="flex gap-4">
              <div>
                <p className="text-xs text-slate-400">Armazem</p>
                <p className="text-sm font-medium text-slate-700">{currentProduct.warehouse}</p>
              </div>
              {currentProduct.location && (
                <div>
                  <p className="text-xs text-slate-400">Localizacao</p>
                  <p className="text-sm font-medium font-mono text-slate-700">{currentProduct.location}</p>
                </div>
              )}
              {/* Saldo sistema só visível quando lista foi liberada com permissão (não-cega) */}
              {showPreviousCounts && (
                <div>
                  <p className="text-xs text-slate-400">Saldo sistema</p>
                  <p className="text-sm font-medium tabular-nums text-slate-700">{currentProduct.system_qty.toFixed(2)}</p>
                </div>
              )}
            </div>

            {/* Hint: entrega posterior */}
            {(currentProduct.b2_xentpos || 0) > 0.001 && (
              <div className="p-2 bg-sky-50 border border-sky-200 rounded-lg text-xs text-sky-700">
                Este produto possui entregas posteriores.
              </div>
            )}

            {/* Contagens de ciclos anteriores — só se a lista foi liberada com permissao */}
            {showPreviousCounts && currentCycle >= 2 && currentProduct.count_cycle_1 !== null && (
              <div className="p-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                C1: {currentProduct.count_cycle_1.toFixed(2)}
              </div>
            )}
            {showPreviousCounts && currentCycle >= 3 && currentProduct.count_cycle_2 !== null && (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                C2: {currentProduct.count_cycle_2.toFixed(2)}
              </div>
            )}

            {/* Status atual */}
            {countedQty !== null && (
              <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
                <Check className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-blue-700">
                  Ja contado (C{currentCycle}): {countedQty.toFixed(2)}
                </span>
              </div>
            )}

            {/* Input quantidade — only for non-lot products */}
            {isLotProduct ? (
              <div>
                <button
                  onClick={() => setShowLotModal(true)}
                  disabled={saving}
                  className="w-full py-4 bg-purple-600 text-white rounded-lg text-base font-bold hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Layers className="w-5 h-5" />
                  {countedQty !== null ? `Recontar por Lote (${countedQty.toFixed(2)})` : 'Contar por Lote'}
                </button>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade</label>
                  <input
                    ref={inputRef}
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="0"
                    className="w-full border border-slate-300 rounded-lg px-4 py-4 text-2xl text-center font-bold focus:outline-none focus:ring-2 focus:ring-capul-500"
                  />
                </div>

                {/* Observacao */}
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Observacao (opcional)</label>
                  <input
                    type="text"
                    value={observation}
                    onChange={(e) => setObservation(e.target.value)}
                    placeholder="Obs..."
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500"
                  />
                </div>

                {/* Botoes */}
                <div className="flex gap-3">
                  <button
                    onClick={handleClear}
                    className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200"
                  >
                    Limpar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !quantity}
                    className="flex-1 py-3 bg-capul-600 text-white rounded-lg text-sm font-medium hover:bg-capul-700 disabled:opacity-50"
                  >
                    {saving ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Navegacao */}
      <div className="px-4 py-3 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
        <button
          onClick={handlePrev}
          disabled={currentIndex <= 0}
          className="flex items-center gap-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium disabled:opacity-40"
        >
          <ChevronLeft className="w-4 h-4" />
          Anterior
        </button>
        <span className="text-sm text-slate-500">
          {products.length > 0 ? `${currentIndex + 1} de ${products.length}` : '0 de 0'}
        </span>
        <button
          onClick={handleNext}
          disabled={currentIndex >= products.length - 1}
          className="flex items-center gap-1 px-4 py-3 bg-capul-600 text-white rounded-lg text-sm font-medium disabled:opacity-40"
        >
          Proximo
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Status bar */}
      <div className="px-4 py-2 bg-slate-100 border-t border-slate-200 flex items-center justify-center gap-6 text-xs text-slate-500 shrink-0">
        <span>Pendentes: <strong className="text-amber-600">{stats.pending}</strong></span>
        <span>Contados: <strong className="text-green-600">{stats.counted}</strong></span>
        {stats.divergent > 0 && <span>Diverg.: <strong className="text-red-600">{stats.divergent}</strong></span>}
      </div>

      {/* Modal de contagem por lote */}
      {showLotModal && currentProduct && (
        <LoteContagemModal
          product={currentProduct}
          currentCycle={currentCycle}
          showPreviousCounts={showPreviousCounts}
          onSave={handleSaveLotCount}
          onClose={() => setShowLotModal(false)}
        />
      )}

      {/* Modal de confirmacao Liberar para supervisor */}
      {showHandoffConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-800">Liberar para supervisor?</h3>
            <p className="text-sm text-slate-600">
              A lista <strong>{currentListName}</strong> sera entregue ao supervisor para revisao.
            </p>
            {stats.pending > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                <strong>{stats.pending} item(ns) nao contado(s)</strong> serao registrados como <strong>zero</strong>.
                Use isso quando o produto nao foi encontrado fisicamente.
              </div>
            )}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600">
              Apos liberar, voce nao podera mais alterar contagens. O supervisor pode devolver a lista
              caso precise refazer alguma contagem.
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowHandoffConfirm(false)}
                disabled={handoffLoading}
                className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleHandoff}
                disabled={handoffLoading}
                className="flex-1 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
              >
                {handoffLoading ? 'Liberando...' : 'Liberar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
