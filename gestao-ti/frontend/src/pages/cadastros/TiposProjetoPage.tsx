import { useEffect, useState, useMemo } from 'react';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { compraService } from '../../services/compra.service';
import { Plus, FolderKanban, Pencil, Check, X, ArrowUpDown, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import type { TipoProjetoConfig } from '../../types';
import { useToast } from '../../components/Toast';

type SortKey = 'codigo' | 'descricao' | 'status';
type SortDir = 'asc' | 'desc';

export function TiposProjetoPage() {
  const { gestaoTiRole } = useAuth();
  const canManage = gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR_TI';
  const { toast } = useToast();

  const [tipos, setTipos] = useState<TipoProjetoConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [saving, setSaving] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [editCodigo, setEditCodigo] = useState('');
  const [editDescricao, setEditDescricao] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey>('codigo');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    try { setTipos(await compraService.listarTiposProjeto()); } catch { /* empty */ }
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

  const sorted = useMemo(() => {
    return [...tipos].sort((a, b) => {
      const va = (a[sortKey] || '').toString().toLowerCase();
      const vb = (b[sortKey] || '').toString().toLowerCase();
      const cmp = va.localeCompare(vb);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [tipos, sortKey, sortDir]);

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-slate-300" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-capul-600" /> : <ArrowDown className="w-3 h-3 text-capul-600" />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await compraService.criarTipoProjeto({ codigo, descricao });
      setCodigo(''); setDescricao('');
      setShowForm(false);
      toast('success', 'Tipo de projeto criado');
      carregar();
    } catch { toast('error', 'Erro ao criar tipo de projeto'); }
    setSaving(false);
  }

  function startEdit(t: TipoProjetoConfig) {
    setEditId(t.id); setEditCodigo(t.codigo); setEditDescricao(t.descricao);
  }

  async function saveEdit() {
    if (!editId) return;
    setEditSaving(true);
    try {
      await compraService.atualizarTipoProjeto(editId, { codigo: editCodigo, descricao: editDescricao });
      toast('success', 'Tipo de projeto atualizado');
      setEditId(null);
      carregar();
    } catch { toast('error', 'Erro ao atualizar'); }
    setEditSaving(false);
  }

  async function handleToggleStatus(t: TipoProjetoConfig) {
    const novoStatus = t.status === 'ATIVO' ? 'INATIVO' : 'ATIVO';
    try {
      await compraService.atualizarTipoProjeto(t.id, { status: novoStatus });
      toast('success', `Tipo ${novoStatus === 'ATIVO' ? 'ativado' : 'inativado'}`);
      carregar();
    } catch { toast('error', 'Erro ao atualizar status'); }
  }

  return (
    <>
      <Header title="Tipos de Projeto" />
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-slate-500">Classificacao de tipos de projeto (Desenvolvimento Interno, Implantacao, Infraestrutura, etc.)</p>
          {canManage && (
            <button onClick={() => { setShowForm(!showForm); setEditId(null); }}
              className="flex items-center gap-2 bg-capul-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-capul-700 transition-colors">
              <Plus className="w-4 h-4" /> Novo Tipo
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Codigo *</label>
                <input type="text" value={codigo} onChange={(e) => setCodigo(e.target.value)} required maxLength={30}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600" placeholder="DESENV_INT" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descricao *</label>
                <input type="text" value={descricao} onChange={(e) => setDescricao(e.target.value)} required maxLength={100}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600" placeholder="Desenvolvimento Interno" />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving}
                className="bg-capul-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-capul-700 disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="text-center py-12 text-slate-500">Carregando...</div>
        ) : tipos.length === 0 ? (
          <div className="text-center py-12">
            <FolderKanban className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Nenhum tipo de projeto cadastrado</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-3"><button onClick={() => toggleSort('codigo')} className="flex items-center gap-1 hover:text-slate-700">Codigo <SortIcon col="codigo" /></button></th>
                  <th className="px-6 py-3"><button onClick={() => toggleSort('descricao')} className="flex items-center gap-1 hover:text-slate-700">Descricao <SortIcon col="descricao" /></button></th>
                  <th className="px-6 py-3"><button onClick={() => toggleSort('status')} className="flex items-center gap-1 hover:text-slate-700">Status <SortIcon col="status" /></button></th>
                  {canManage && <th className="px-6 py-3">Acoes</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    {editId === t.id ? (
                      <>
                        <td className="px-6 py-3">
                          <input value={editCodigo} onChange={(e) => setEditCodigo(e.target.value)} maxLength={30}
                            className="w-full border border-slate-300 rounded px-2 py-1 text-sm" />
                        </td>
                        <td className="px-6 py-3">
                          <input value={editDescricao} onChange={(e) => setEditDescricao(e.target.value)} maxLength={100}
                            className="w-full border border-slate-300 rounded px-2 py-1 text-sm" />
                        </td>
                        <td className="px-6 py-3">
                          <span className={`text-xs px-2 py-1 rounded-full ${t.status === 'ATIVO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{t.status}</span>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={saveEdit} disabled={editSaving} className="text-green-600 hover:text-green-800" title="Salvar"><Check className="w-4 h-4" /></button>
                            <button onClick={() => setEditId(null)} className="text-slate-400 hover:text-slate-600" title="Cancelar"><X className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4 text-sm font-medium text-slate-700">{t.codigo}</td>
                        <td className="px-6 py-4 text-sm">
                          <button onClick={() => startEdit(t)} className="text-capul-600 hover:underline text-left">{t.descricao}</button>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-xs px-2 py-1 rounded-full ${t.status === 'ATIVO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{t.status}</span>
                        </td>
                        {canManage && (
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <button onClick={() => startEdit(t)} className="flex items-center gap-1 text-xs text-capul-600 hover:underline"><Pencil className="w-3.5 h-3.5" /> Editar</button>
                              <button onClick={() => handleToggleStatus(t)} className="text-xs text-capul-600 hover:underline">{t.status === 'ATIVO' ? 'Inativar' : 'Ativar'}</button>
                              <button onClick={async () => {
                                if (!confirm(`Excluir tipo "${t.descricao}"?`)) return;
                                try { await compraService.excluirTipoProjeto(t.id); carregar(); toast('success', 'Tipo excluido'); }
                                catch (err: unknown) { toast('error', (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao excluir'); }
                              }} className="flex items-center gap-1 text-xs text-red-600 hover:underline">
                                <Trash2 className="w-3.5 h-3.5" /> Excluir
                              </button>
                            </div>
                          </td>
                        )}
                      </>
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
