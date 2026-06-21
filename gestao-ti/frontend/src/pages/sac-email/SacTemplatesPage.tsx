import { useEffect, useState } from 'react';
import { Header } from '../../layouts/Header';
import { useToast } from '../../components/Toast';
import { sacTemplateService, type SacTemplate } from '../../services/sacTemplate.service';
import { MessageSquareText, Plus, Pencil, Trash2, Save, X } from 'lucide-react';

type Form = { id: string | null; titulo: string; corpo: string; ativo: boolean; ordem: number };
const VAZIO: Form = { id: null, titulo: '', corpo: '', ativo: true, ordem: 0 };

/** SAC 4b — gestão das respostas prontas (templates). Admin/Gestor. */
export function SacTemplatesPage() {
  const { toast, confirm } = useToast();
  const [itens, setItens] = useState<SacTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Form | null>(null);
  const [salvando, setSalvando] = useState(false);

  function carregar() {
    setLoading(true);
    sacTemplateService
      .listarTodos()
      .then(setItens)
      .catch(() => toast('error', 'Falha ao carregar as respostas.'))
      .finally(() => setLoading(false));
  }
  useEffect(carregar, [toast]);

  function novo() {
    setForm({ ...VAZIO });
  }
  function editar(t: SacTemplate) {
    setForm({ id: t.id, titulo: t.titulo, corpo: t.corpo, ativo: t.ativo, ordem: t.ordem });
  }

  async function salvar() {
    if (!form) return;
    if (!form.titulo.trim() || !form.corpo.trim()) {
      toast('error', 'Preencha título e corpo.');
      return;
    }
    setSalvando(true);
    try {
      const payload = { titulo: form.titulo.trim(), corpo: form.corpo, ativo: form.ativo, ordem: form.ordem };
      if (form.id) await sacTemplateService.atualizar(form.id, payload);
      else await sacTemplateService.criar(payload);
      toast('success', 'Resposta salva.');
      setForm(null);
      carregar();
    } catch {
      toast('error', 'Falha ao salvar.');
    } finally {
      setSalvando(false);
    }
  }

  async function remover(t: SacTemplate) {
    const ok = await confirm('Remover resposta', `Remover "${t.titulo}"?`, { confirmLabel: 'Remover', variant: 'danger' });
    if (!ok) return;
    try {
      await sacTemplateService.remover(t.id);
      toast('success', 'Resposta removida.');
      carregar();
    } catch {
      toast('error', 'Falha ao remover.');
    }
  }

  return (
    <>
      <Header title="SAC — Respostas prontas" />
      <div className="p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Respostas reutilizáveis inseridas no card “Responder ao cliente” do chamado de SAC.
            </p>
            {!form && (
              <button onClick={novo} className="inline-flex items-center gap-2 bg-capul-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-capul-700">
                <Plus className="w-4 h-4" /> Nova resposta
              </button>
            )}
          </div>

          {form && (
            <div className="bg-white rounded-xl border border-capul-200 p-5 space-y-3">
              <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                <MessageSquareText className="w-4 h-4 text-capul-600" /> {form.id ? 'Editar resposta' : 'Nova resposta'}
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <label className="col-span-2 block">
                  <span className="text-xs text-slate-500">Título</span>
                  <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                    className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600" />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-500">Ordem</span>
                  <input type="number" value={form.ordem} onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) })}
                    className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600" />
                </label>
              </div>
              <label className="block">
                <span className="text-xs text-slate-500">Corpo</span>
                <textarea value={form.corpo} onChange={(e) => setForm({ ...form, corpo: e.target.value })} rows={5}
                  className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600" />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
                Ativa (aparece no seletor)
              </label>
              <div className="flex justify-end gap-2">
                <button onClick={() => setForm(null)} className="inline-flex items-center gap-1.5 bg-white border border-slate-300 text-slate-600 px-4 py-2 rounded-lg text-sm hover:bg-slate-50">
                  <X className="w-4 h-4" /> Cancelar
                </button>
                <button onClick={salvar} disabled={salvando} className="inline-flex items-center gap-2 bg-capul-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-capul-700 disabled:opacity-50">
                  <Save className="w-4 h-4" /> {salvando ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-700 text-sm mb-3">Respostas ({itens.length})</h3>
            {loading ? (
              <p className="text-sm text-slate-400">Carregando…</p>
            ) : itens.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhuma resposta cadastrada.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {itens.map((t) => (
                  <div key={t.id} className="border border-slate-200 rounded-lg p-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm text-slate-700 font-medium flex items-center gap-2">
                        {t.titulo}
                        {!t.ativo && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">inativa</span>}
                      </div>
                      <p className="text-xs text-slate-500 whitespace-pre-wrap line-clamp-2 mt-0.5">{t.corpo}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => editar(t)} className="p-2 text-slate-500 hover:text-capul-600" title="Editar"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => remover(t)} className="p-2 text-slate-400 hover:text-red-500" title="Remover"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
