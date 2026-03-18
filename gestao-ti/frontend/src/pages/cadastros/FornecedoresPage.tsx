import { useEffect, useState, useMemo } from 'react';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { contratoService } from '../../services/contrato.service';
import { Plus, Truck, Pencil, Check, X, ArrowUpDown, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import type { FornecedorConfig } from '../../types';
import { useToast } from '../../components/Toast';

type SortKey = 'codigo' | 'loja' | 'nome' | 'status';
type SortDir = 'asc' | 'desc';

export function FornecedoresPage() {
  const { gestaoTiRole } = useAuth();
  const canManage = gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR_TI';
  const { toast } = useToast();

  const [fornecedores, setFornecedores] = useState<FornecedorConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [loja, setLoja] = useState('');
  const [nome, setNome] = useState('');
  const [saving, setSaving] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [editCodigo, setEditCodigo] = useState('');
  const [editLoja, setEditLoja] = useState('');
  const [editNome, setEditNome] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey>('codigo');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    try { setFornecedores(await contratoService.listarTodosFornecedores()); } catch { /* empty */ }
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
    return [...fornecedores].sort((a, b) => {
      const va = (a[sortKey] || '').toString().toLowerCase();
      const vb = (b[sortKey] || '').toString().toLowerCase();
      const cmp = va.localeCompare(vb);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [fornecedores, sortKey, sortDir]);

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-slate-300" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-capul-600" /> : <ArrowDown className="w-3 h-3 text-capul-600" />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await contratoService.criarFornecedor({ codigo, loja: loja || undefined, nome });
      setCodigo(''); setLoja(''); setNome('');
      setShowForm(false);
      toast('success', 'Fornecedor criado');
      carregar();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao criar fornecedor';
      toast('error', msg);
    }
    setSaving(false);
  }

  function startEdit(f: FornecedorConfig) {
    setEditId(f.id); setEditCodigo(f.codigo); setEditLoja(f.loja || ''); setEditNome(f.nome);
  }

  async function saveEdit() {
    if (!editId) return;
    setEditSaving(true);
    try {
      await contratoService.atualizarFornecedor(editId, { codigo: editCodigo, loja: editLoja || '', nome: editNome });
      toast('success', 'Fornecedor atualizado');
      setEditId(null);
      carregar();
    } catch { toast('error', 'Erro ao atualizar fornecedor'); }
    setEditSaving(false);
  }

  async function handleToggleStatus(f: FornecedorConfig) {
    const novoStatus = f.status === 'ATIVO' ? 'INATIVO' : 'ATIVO';
    try {
      await contratoService.atualizarFornecedor(f.id, { status: novoStatus });
      toast('success', `Fornecedor ${novoStatus === 'ATIVO' ? 'ativado' : 'inativado'}`);
      carregar();
    } catch { toast('error', 'Erro ao atualizar status'); }
  }

  return (
    <>
      <Header title="Fornecedores" />
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-slate-500">Cadastro de fornecedores para contratos (integrado ao ERP Protheus)</p>
          {canManage && (
            <button onClick={() => { setShowForm(!showForm); setEditId(null); }}
              className="flex items-center gap-2 bg-capul-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-capul-700 transition-colors">
              <Plus className="w-4 h-4" /> Novo Fornecedor
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Codigo *</label>
                <input type="text" value={codigo} onChange={(e) => setCodigo(e.target.value)} required maxLength={20}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600" placeholder="F00051" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Loja *</label>
                <input type="text" value={loja} onChange={(e) => setLoja(e.target.value)} required maxLength={10}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600" placeholder="0001" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
                <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={200}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600" placeholder="Microsoft Brasil Ltda" />
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
        ) : fornecedores.length === 0 ? (
          <div className="text-center py-12">
            <Truck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Nenhum fornecedor cadastrado</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-3"><button onClick={() => toggleSort('codigo')} className="flex items-center gap-1 hover:text-slate-700">Codigo <SortIcon col="codigo" /></button></th>
                  <th className="px-6 py-3"><button onClick={() => toggleSort('loja')} className="flex items-center gap-1 hover:text-slate-700">Loja <SortIcon col="loja" /></button></th>
                  <th className="px-6 py-3"><button onClick={() => toggleSort('nome')} className="flex items-center gap-1 hover:text-slate-700">Nome <SortIcon col="nome" /></button></th>
                  <th className="px-6 py-3"><button onClick={() => toggleSort('status')} className="flex items-center gap-1 hover:text-slate-700">Status <SortIcon col="status" /></button></th>
                  {canManage && <th className="px-6 py-3">Acoes</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50">
                    {editId === f.id ? (
                      <>
                        <td className="px-6 py-3">
                          <input value={editCodigo} onChange={(e) => setEditCodigo(e.target.value)} maxLength={20}
                            className="w-full border border-slate-300 rounded px-2 py-1 text-sm" />
                        </td>
                        <td className="px-6 py-3">
                          <input value={editLoja} onChange={(e) => setEditLoja(e.target.value)} maxLength={10}
                            className="w-full border border-slate-300 rounded px-2 py-1 text-sm" />
                        </td>
                        <td className="px-6 py-3">
                          <input value={editNome} onChange={(e) => setEditNome(e.target.value)} maxLength={200}
                            className="w-full border border-slate-300 rounded px-2 py-1 text-sm" />
                        </td>
                        <td className="px-6 py-3">
                          <span className={`text-xs px-2 py-1 rounded-full ${f.status === 'ATIVO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{f.status}</span>
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
                        <td className="px-6 py-4 text-sm font-medium text-slate-700">{f.codigo}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">{f.loja || '-'}</td>
                        <td className="px-6 py-4 text-sm">
                          <button onClick={() => startEdit(f)} className="text-capul-600 hover:underline text-left">{f.nome}</button>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-xs px-2 py-1 rounded-full ${f.status === 'ATIVO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{f.status}</span>
                        </td>
                        {canManage && (
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <button onClick={() => startEdit(f)} className="flex items-center gap-1 text-xs text-capul-600 hover:underline"><Pencil className="w-3.5 h-3.5" /> Editar</button>
                              <button onClick={() => handleToggleStatus(f)} className="text-xs text-capul-600 hover:underline">{f.status === 'ATIVO' ? 'Inativar' : 'Ativar'}</button>
                              <button onClick={async () => {
                                if (!confirm(`Excluir fornecedor "${f.nome}"?`)) return;
                                try { await contratoService.excluirFornecedor(f.id); carregar(); toast('success', 'Fornecedor excluido'); }
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
