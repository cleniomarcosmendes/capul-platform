import { useState, useEffect } from 'react';
import { X, UserCheck, Loader2 } from 'lucide-react';
import { countingListService } from '../../../services/counting-list.service';
import type { AvailableCounter } from '../../../services/counting-list.service';

interface Props {
  inventoryId: string;
  onClose: () => void;
  onCreated: () => void;
}

export function CriarListaModal({ inventoryId, onClose, onCreated }: Props) {
  const [visible, setVisible] = useState(false);
  const [counters, setCounters] = useState<AvailableCounter[]>([]);
  const [loadingCounters, setLoadingCounters] = useState(true);

  // Seleção de contadores por ciclo
  const [counterCycle1, setCounterCycle1] = useState('');
  const [counterCycle2, setCounterCycle2] = useState('');
  const [counterCycle3, setCounterCycle3] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Carregar contadores disponíveis
  useEffect(() => {
    setLoadingCounters(true);
    countingListService.listarContadoresDisponiveis(inventoryId)
      .then(setCounters)
      .catch(() => setCounters([]))
      .finally(() => setLoadingCounters(false));
  }, [inventoryId]);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 200);
  }

  // Gerar nome automático baseado no contador selecionado
  function generateListName(counterId: string): string {
    const counter = counters.find((c) => c.user_id === counterId);
    if (!counter) return 'Lista de Contagem';
    return `Lista ${counter.full_name || counter.username}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!counterCycle1) {
      setError('Selecione o contador do 1o ciclo.');
      return;
    }

    setSaving(true);
    setError('');

    const listName = generateListName(counterCycle1);
    const counter = counters.find((c) => c.user_id === counterCycle1);
    const description = `Lista de contagem do(a) ${counter?.full_name || counter?.username || 'Contador'}`;

    try {
      await countingListService.criar(inventoryId, {
        list_name: listName,
        description,
        counter_cycle_1: counterCycle1 || undefined,
        counter_cycle_2: counterCycle2 || undefined,
        counter_cycle_3: counterCycle3 || undefined,
      });
      onCreated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar lista.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-200 ${visible ? 'bg-black/40' : 'bg-transparent'}`}
    >
      <div
        className={`bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 transition-all duration-200 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Nova Lista de Contagem</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Selecione os contadores responsaveis por cada ciclo
            </p>
          </div>
          <button onClick={handleClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          {loadingCounters ? (
            <div className="flex items-center justify-center gap-2 py-6 text-slate-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Carregando contadores disponiveis...
            </div>
          ) : counters.length === 0 ? (
            <div className="text-center py-6">
              <UserCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Nenhum contador disponivel nesta filial.</p>
              <p className="text-xs text-slate-400 mt-1">Cadastre operadores ou supervisores para atribuir listas.</p>
            </div>
          ) : (
            <>
              {/* Preview do nome */}
              {counterCycle1 && (
                <div className="p-3 bg-capul-50 border border-capul-200 rounded-lg">
                  <p className="text-xs text-capul-600 font-medium">Nome da lista (auto-gerado)</p>
                  <p className="text-sm text-capul-800 font-semibold mt-0.5">
                    {generateListName(counterCycle1)}
                  </p>
                </div>
              )}

              {/* Contador 1o Ciclo (obrigatório) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <span className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center">1</span>
                    Contador 1o Ciclo *
                  </span>
                </label>
                <select
                  value={counterCycle1}
                  onChange={(e) => setCounterCycle1(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500 bg-white"
                >
                  <option value="">Selecione o contador...</option>
                  {counters.map((c) => (
                    <option key={c.user_id} value={c.user_id}>
                      {c.full_name || c.username} ({c.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Contador 2o Ciclo (opcional) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <span className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center">2</span>
                    Contador 2o Ciclo
                    <span className="text-xs text-slate-400 font-normal">(recontagem)</span>
                  </span>
                </label>
                <select
                  value={counterCycle2}
                  onChange={(e) => setCounterCycle2(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500 bg-white"
                >
                  <option value="">Mesmo do 1o ciclo</option>
                  {counters.map((c) => (
                    <option key={c.user_id} value={c.user_id}>
                      {c.full_name || c.username} ({c.role})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Se nao selecionado, o contador do 1o ciclo sera usado na recontagem.
                </p>
              </div>

              {/* Contador 3o Ciclo (opcional) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <span className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-red-100 text-red-700 text-xs font-bold flex items-center justify-center">3</span>
                    Contador 3o Ciclo
                    <span className="text-xs text-slate-400 font-normal">(desempate)</span>
                  </span>
                </label>
                <select
                  value={counterCycle3}
                  onChange={(e) => setCounterCycle3(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500 bg-white"
                >
                  <option value="">Mesmo do 2o ciclo</option>
                  {counters.map((c) => (
                    <option key={c.user_id} value={c.user_id}>
                      {c.full_name || c.username} ({c.role})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Se nao selecionado, o contador do 2o ciclo sera usado no desempate.
                </p>
              </div>

              {/* Info */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-500">
                <p className="font-medium text-slate-600 mb-1">Como funciona:</p>
                <ul className="space-y-0.5 list-disc list-inside">
                  <li>O nome da lista sera gerado automaticamente com o nome do contador</li>
                  <li>Apos criar, distribua os produtos entre as listas</li>
                  <li>Cada lista pode ter contadores diferentes por ciclo</li>
                  <li>Voce pode criar varias listas com contadores distintos</li>
                </ul>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !counterCycle1 || loadingCounters}
              className="px-4 py-2 text-sm text-white bg-capul-600 rounded-lg hover:bg-capul-700 disabled:opacity-50"
            >
              {saving ? 'Criando...' : 'Criar Lista'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
