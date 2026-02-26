import { useState } from 'react';
import { X } from 'lucide-react';
import { countingListService } from '../../../services/counting-list.service';

interface Props {
  inventoryId: string;
  onClose: () => void;
  onCreated: () => void;
}

export function CriarListaModal({ inventoryId, onClose, onCreated }: Props) {
  const [listName, setListName] = useState('');
  const [description, setDescription] = useState('');
  const [counterCycle1, setCounterCycle1] = useState('');
  const [counterCycle2, setCounterCycle2] = useState('');
  const [counterCycle3, setCounterCycle3] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!listName.trim()) {
      setError('Nome da lista e obrigatorio.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await countingListService.criar(inventoryId, {
        list_name: listName.trim(),
        description: description.trim() || undefined,
        counter_cycle_1: counterCycle1.trim() || undefined,
        counter_cycle_2: counterCycle2.trim() || undefined,
        counter_cycle_3: counterCycle3.trim() || undefined,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800">Nova Lista de Contagem</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nome da Lista *
            </label>
            <input
              type="text"
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              placeholder="Ex: Lista Setor A"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Descricao
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descricao opcional"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500"
            />
          </div>

          <div className="border-t border-slate-200 pt-4">
            <p className="text-sm font-medium text-slate-700 mb-3">Contadores (opcional)</p>
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Contador 1o Ciclo</label>
                <input
                  type="text"
                  value={counterCycle1}
                  onChange={(e) => setCounterCycle1(e.target.value)}
                  placeholder="ID ou nome do contador"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Contador 2o Ciclo</label>
                <input
                  type="text"
                  value={counterCycle2}
                  onChange={(e) => setCounterCycle2(e.target.value)}
                  placeholder="ID ou nome do contador"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Contador 3o Ciclo</label>
                <input
                  type="text"
                  value={counterCycle3}
                  onChange={(e) => setCounterCycle3(e.target.value)}
                  placeholder="ID ou nome do contador"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
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
