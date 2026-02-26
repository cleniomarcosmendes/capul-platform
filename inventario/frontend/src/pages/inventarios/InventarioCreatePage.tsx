import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { inventoryService } from '../../services/inventory.service';
import { warehouseService } from '../../services/warehouse.service';
import { ArrowLeft } from 'lucide-react';
import type { WarehouseSimple } from '../../types';

export function InventarioCreatePage() {
  const navigate = useNavigate();
  const [armazens, setArmazens] = useState<WarehouseSimple[]>([]);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');

  const [form, setForm] = useState({
    name: '',
    description: '',
    warehouse: '',
    reference_date: '',
    count_deadline: '',
  });

  useEffect(() => {
    warehouseService.listarSimples().then(setArmazens).catch(() => {});
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');

    if (!form.name.trim()) {
      setErro('Nome e obrigatorio.');
      return;
    }
    if (!form.warehouse) {
      setErro('Selecione um armazem.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        warehouse: form.warehouse,
        reference_date: form.reference_date ? new Date(form.reference_date).toISOString() : undefined,
        count_deadline: form.count_deadline ? new Date(form.count_deadline).toISOString() : undefined,
      };
      const created = await inventoryService.criar(payload);
      navigate(`/inventario/inventarios/${created.id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setErro(msg || 'Erro ao criar inventario.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Header title="Novo Inventario" />
      <div className="p-4 md:p-6 max-w-2xl">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <h3 className="text-lg font-semibold text-slate-800">Criar Inventario</h3>

          {erro && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
              {erro}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Ex: Inventario Janeiro 2026"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500"
              maxLength={100}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descricao</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Descricao opcional..."
              rows={3}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500 resize-none"
              maxLength={500}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Armazem *</label>
            <select
              name="warehouse"
              value={form.warehouse}
              onChange={handleChange}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500"
            >
              <option value="">Selecione...</option>
              {armazens.map((a) => (
                <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data Referencia</label>
              <input
                type="datetime-local"
                name="reference_date"
                value={form.reference_date}
                onChange={handleChange}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Prazo Contagem</label>
              <input
                type="datetime-local"
                name="count_deadline"
                value={form.count_deadline}
                onChange={handleChange}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-capul-600 text-white rounded-lg font-medium hover:bg-capul-700 disabled:opacity-50"
            >
              {saving ? 'Criando...' : 'Criar Inventario'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
