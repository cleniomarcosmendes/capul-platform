import { useEffect, useState, useMemo } from 'react';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { licencaService } from '../../services/licenca.service';
import { Plus, Tag, Pencil, Check, X, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { CategoriaLicenca } from '../../types';
import { useToast } from '../../components/Toast';

type SortKey = 'codigo' | 'nome' | 'descricao' | 'status';
type SortDir = 'asc' | 'desc';

export function CategoriaLicencaPage() {
  const { gestaoTiRole } = useAuth();
  const canManage = gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR_TI';
  const { toast, confirm } = useToast();

  const [categorias, setCategorias] = useState<CategoriaLicenca[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [saving, setSaving] = useState(false);

  // Inline edit
  const [editId, setEditId] = useState<string | null>(null);
  const [editCodigo, setEditCodigo] = useState('');
  const [editNome, setEditNome] = useState('');
  const [editDescricao, setEditDescricao] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey>('codigo');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sorted = useMemo(() => {
    return [...categorias].sort((a, b) => {
      const va = (a[sortKey] || '').toString().toLowerCase();
      const vb = (b[sortKey] || '').toString().toLowerCase();
      const cmp = va.localeCompare(vb);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [categorias, sortKey, sortDir]);

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-slate-300" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-capul-600" /> : <ArrowDown className="w-3 h-3 text-capul-600" />;
  }

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    try {
      const data = await licencaService.listarCategorias();
      setCategorias(data);
    } catch { /* empty */ }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await licencaService.criarCategoria({ codigo, nome, descricao: descricao || undefined });
      setCodigo(''); setNome(''); setDescricao('');
      setShowForm(false);
      toast('success', 'Categoria de licenca criada');
      carregar();
    } catch {
      toast('error', 'Erro ao criar categoria de licenca');
    }
    setSaving(false);
  }

  function startEdit(cat: CategoriaLicenca) {
    setEditId(cat.id);
    setEditCodigo(cat.codigo);
    setEditNome(cat.nome);
    setEditDescricao(cat.descricao || '');
  }

  function cancelEdit() {
    setEditId(null);
  }

  async function saveEdit() {
    if (!editId) return;
    setEditSaving(true);
    try {
      await licencaService.atualizarCategoria(editId, { codigo: editCodigo, nome: editNome, descricao: editDescricao || undefined });
      toast('success', 'Categoria de licenca atualizada');
      setEditId(null);
      carregar();
    } catch {
      toast('error', 'Erro ao atualizar categoria de licenca');
    }
    setEditSaving(false);
  }

  async function handleToggleStatus(cat: CategoriaLicenca) {
    const novoStatus = cat.status === 'ATIVO' ? 'INATIVO' : 'ATIVO';
    try {
      await licencaService.atualizarCategoria(cat.id, { status: novoStatus });
      toast('success', `Categoria ${novoStatus === 'ATIVO' ? 'ativada' : 'inativada'}`);
      carregar();
    } catch {
      toast('error', 'Erro ao atualizar status');
    }
  }

  return (
    <>
      <Header title="Categorias de Licenca" />
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-slate-500">
            Cadastro de categorias para classificacao de licencas
          </p>
          {canManage && (
            <button
              onClick={() => { setShowForm(!showForm); cancelEdit(); }}
              className="flex items-center gap-2 bg-capul-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-capul-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nova Categoria
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Codigo *</label>
                <input type="text" value={codigo} onChange={(e) => setCodigo(e.target.value)} required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600" placeholder="CERT_DIGITAL" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
                <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600" placeholder="Certificado Digital" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descricao</label>
                <input type="text" value={descricao} onChange={(e) => setDescricao(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600" placeholder="Certificados digitais e-CPF, e-CNPJ, etc." />
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
        ) : categorias.length === 0 ? (
          <div className="text-center py-12">
            <Tag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Nenhuma categoria de licenca cadastrada</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-3"><button onClick={() => toggleSort('codigo')} className="flex items-center gap-1 hover:text-slate-700">Codigo <SortIcon col="codigo" /></button></th>
                  <th className="px-6 py-3"><button onClick={() => toggleSort('nome')} className="flex items-center gap-1 hover:text-slate-700">Nome <SortIcon col="nome" /></button></th>
                  <th className="px-6 py-3"><button onClick={() => toggleSort('descricao')} className="flex items-center gap-1 hover:text-slate-700">Descricao <SortIcon col="descricao" /></button></th>
                  <th className="px-6 py-3"><button onClick={() => toggleSort('status')} className="flex items-center gap-1 hover:text-slate-700">Status <SortIcon col="status" /></button></th>
                  {canManage && <th className="px-6 py-3">Acoes</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map((cat) => (
                  <tr key={cat.id} className="hover:bg-slate-50">
                    {editId === cat.id ? (
                      <>
                        <td className="px-6 py-3">
                          <input value={editCodigo} onChange={(e) => setEditCodigo(e.target.value)}
                            className="w-full border border-slate-300 rounded px-2 py-1 text-sm" />
                        </td>
                        <td className="px-6 py-3">
                          <input value={editNome} onChange={(e) => setEditNome(e.target.value)}
                            className="w-full border border-slate-300 rounded px-2 py-1 text-sm" />
                        </td>
                        <td className="px-6 py-3">
                          <input value={editDescricao} onChange={(e) => setEditDescricao(e.target.value)}
                            className="w-full border border-slate-300 rounded px-2 py-1 text-sm" />
                        </td>
                        <td className="px-6 py-3">
                          <span className={`text-xs px-2 py-1 rounded-full ${cat.status === 'ATIVO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {cat.status}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={saveEdit} disabled={editSaving} className="text-green-600 hover:text-green-800" title="Salvar">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={cancelEdit} className="text-slate-400 hover:text-slate-600" title="Cancelar">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4 text-sm font-medium text-slate-700">{cat.codigo}</td>
                        <td className="px-6 py-4 text-sm">
                          <button onClick={() => startEdit(cat)} className="text-capul-600 hover:underline text-left">{cat.nome}</button>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">{cat.descricao || '-'}</td>
                        <td className="px-6 py-4">
                          <span className={`text-xs px-2 py-1 rounded-full ${cat.status === 'ATIVO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {cat.status}
                          </span>
                        </td>
                        {canManage && (
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <button onClick={() => startEdit(cat)} className="flex items-center gap-1 text-xs text-capul-600 hover:underline">
                                <Pencil className="w-3.5 h-3.5" />
                                Editar
                              </button>
                              <button onClick={() => handleToggleStatus(cat)} className="text-xs text-capul-600 hover:underline">
                                {cat.status === 'ATIVO' ? 'Inativar' : 'Ativar'}
                              </button>
                              <button onClick={async () => {
                                if (!await confirm('Excluir Categoria', `Excluir categoria "${cat.nome}"?`, { variant: 'danger' })) return;
                                try { await licencaService.excluirCategoria(cat.id); carregar(); toast('success', 'Categoria excluida'); }
                                catch (err: unknown) { toast('error',(err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao excluir'); }
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
