import { useEffect, useState, useMemo } from 'react';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import { extractApiError } from '../../utils/errors';
import { tipoDepartamentoService } from '../../services/tipo-departamento.service';
import { Plus, Pencil, Trash2, Layers, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { TipoDepartamento } from '../../types';

type SortKey = 'ordem' | 'nome' | 'status';
type SortDir = 'asc' | 'desc';

export function TiposDepartamentoPage() {
  const { configuradorRole } = useAuth();
  const canEdit = configuradorRole === 'ADMIN';
  const toast = useToast();
  const confirm = useConfirm();

  const [tipos, setTipos] = useState<TipoDepartamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [ordem, setOrdem] = useState(0);
  const [saving, setSaving] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey>('ordem');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    try {
      const data = await tipoDepartamentoService.listar();
      setTipos(data);
    } catch { /* */ }
    setLoading(false);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-slate-300" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-emerald-600" /> : <ArrowDown className="w-3 h-3 text-emerald-600" />;
  }

  const sorted = useMemo(() => {
    return [...tipos].sort((a, b) => {
      if (sortKey === 'ordem') {
        const cmp = (a.ordem || 0) - (b.ordem || 0);
        return sortDir === 'asc' ? cmp : -cmp;
      }
      const va = (a[sortKey] || '').toString().toLowerCase();
      const vb = (b[sortKey] || '').toString().toLowerCase();
      const cmp = va.localeCompare(vb);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [tipos, sortKey, sortDir]);

  function iniciarNovo() {
    setEditingId(null);
    setNome('');
    setDescricao('');
    setOrdem(tipos.length + 1);
    setShowForm(true);
  }

  function iniciarEdicao(tipo: TipoDepartamento) {
    setEditingId(tipo.id);
    setNome(tipo.nome);
    setDescricao(tipo.descricao || '');
    setOrdem(tipo.ordem);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await tipoDepartamentoService.atualizar(editingId, { nome, descricao, ordem });
      } else {
        await tipoDepartamentoService.criar({ nome, descricao, ordem });
      }
      setShowForm(false);
      setEditingId(null);
      toast.success(editingId ? 'Tipo atualizado' : 'Tipo criado');
      carregar();
    } catch (err) {
      toast.error('Erro ao salvar tipo de departamento', extractApiError(err));
    }
    setSaving(false);
  }

  async function handleExcluir(tipo: TipoDepartamento) {
    if ((tipo._count?.departamentos || 0) > 0) {
      toast.warning(
        'Nao e possivel excluir',
        `Existem ${tipo._count?.departamentos} departamento(s) vinculado(s) a este tipo.`,
      );
      return;
    }
    const ok = await confirm({
      title: `Excluir tipo "${tipo.nome}"?`,
      description: 'Esta acao nao pode ser desfeita.',
      variant: 'danger',
      confirmLabel: 'Excluir',
    });
    if (!ok) return;
    try {
      await tipoDepartamentoService.excluir(tipo.id);
      toast.success('Tipo excluido');
      carregar();
    } catch (err) {
      toast.error('Erro ao excluir', extractApiError(err));
    }
  }

  async function toggleStatus(tipo: TipoDepartamento) {
    const novoStatus = tipo.status === 'ATIVO' ? 'INATIVO' : 'ATIVO';
    try {
      await tipoDepartamentoService.atualizar(tipo.id, { status: novoStatus } as Partial<TipoDepartamento>);
      setTipos((prev) => prev.map((t) => t.id === tipo.id ? { ...t, status: novoStatus } : t));
    } catch { /* */ }
  }

  return (
    <>
      <Header title="Tipos de Departamento" />
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-slate-500">Categorias para agrupar departamentos</p>
          {canEdit && (
            <button onClick={iniciarNovo} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors">
              <Plus className="w-4 h-4" /> Novo Tipo
            </button>
          )}
        </div>

        {showForm && canEdit && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
            <h4 className="text-sm font-semibold text-slate-800 mb-4">{editingId ? 'Editar Tipo' : 'Novo Tipo'}</h4>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
                <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600" placeholder="Ex: Logistica" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descricao</label>
                <input type="text" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600" placeholder="Departamentos de logistica" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ordem</label>
                <input type="number" value={ordem} onChange={(e) => setOrdem(Number(e.target.value))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600" />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar'}</button>
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="text-center py-12 text-slate-500">Carregando...</div>
        ) : tipos.length === 0 ? (
          <div className="text-center py-12">
            <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Nenhum tipo cadastrado</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-3"><button onClick={() => toggleSort('ordem')} className="flex items-center gap-1 hover:text-slate-700">Ordem <SortIcon col="ordem" /></button></th>
                  <th className="px-6 py-3"><button onClick={() => toggleSort('nome')} className="flex items-center gap-1 hover:text-slate-700">Nome <SortIcon col="nome" /></button></th>
                  <th className="px-6 py-3">Descricao</th>
                  <th className="px-6 py-3">Deptos</th>
                  <th className="px-6 py-3"><button onClick={() => toggleSort('status')} className="flex items-center gap-1 hover:text-slate-700">Status <SortIcon col="status" /></button></th>
                  {canEdit && <th className="px-6 py-3">Acoes</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map((tipo) => (
                  <tr key={tipo.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm text-slate-500">{tipo.ordem}</td>
                    <td className="px-6 py-4 text-sm font-medium">
                      {canEdit ? (
                        <button onClick={() => iniciarEdicao(tipo)} className="text-emerald-600 hover:underline text-left">{tipo.nome}</button>
                      ) : (
                        <span className="text-slate-700">{tipo.nome}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{tipo.descricao || '—'}</td>
                    <td className="px-6 py-4 text-sm text-slate-500">{tipo._count?.departamentos || 0}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2 py-1 rounded-full ${tipo.status === 'ATIVO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{tipo.status}</span>
                    </td>
                    {canEdit && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button onClick={() => iniciarEdicao(tipo)} className="flex items-center gap-1 text-xs text-emerald-600 hover:underline"><Pencil className="w-3.5 h-3.5" /> Editar</button>
                          <button onClick={() => toggleStatus(tipo)} className="text-xs text-emerald-600 hover:underline">{tipo.status === 'ATIVO' ? 'Inativar' : 'Ativar'}</button>
                          <button onClick={() => handleExcluir(tipo)} className="flex items-center gap-1 text-xs text-red-500 hover:underline"><Trash2 className="w-3.5 h-3.5" /> Excluir</button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
