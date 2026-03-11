import { useEffect, useState } from 'react';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { contratoService } from '../../services/contrato.service';
import { Plus, Package, Pencil, Check, X } from 'lucide-react';
import type { ProdutoConfig } from '../../types';
import { useToast } from '../../components/Toast';

export function ProdutosPage() {
  const { gestaoTiRole } = useAuth();
  const canManage = gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR_TI';
  const { toast } = useToast();

  const [produtos, setProdutos] = useState<ProdutoConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [saving, setSaving] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [editCodigo, setEditCodigo] = useState('');
  const [editDescricao, setEditDescricao] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    try { setProdutos(await contratoService.listarTodosProdutos()); } catch { /* empty */ }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await contratoService.criarProduto({ codigo, descricao });
      setCodigo(''); setDescricao('');
      setShowForm(false);
      toast('success', 'Produto criado');
      carregar();
    } catch { toast('error', 'Erro ao criar produto'); }
    setSaving(false);
  }

  function startEdit(p: ProdutoConfig) {
    setEditId(p.id); setEditCodigo(p.codigo); setEditDescricao(p.descricao);
  }

  async function saveEdit() {
    if (!editId) return;
    setEditSaving(true);
    try {
      await contratoService.atualizarProduto(editId, { codigo: editCodigo, descricao: editDescricao });
      toast('success', 'Produto atualizado');
      setEditId(null);
      carregar();
    } catch { toast('error', 'Erro ao atualizar produto'); }
    setEditSaving(false);
  }

  async function handleToggleStatus(p: ProdutoConfig) {
    const novoStatus = p.status === 'ATIVO' ? 'INATIVO' : 'ATIVO';
    try {
      await contratoService.atualizarProduto(p.id, { status: novoStatus });
      toast('success', `Produto ${novoStatus === 'ATIVO' ? 'ativado' : 'inativado'}`);
      carregar();
    } catch { toast('error', 'Erro ao atualizar status'); }
  }

  return (
    <>
      <Header title="Produtos" />
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-slate-500">Cadastro de produtos/servicos para contratos (integrado ao ERP Protheus)</p>
          {canManage && (
            <button onClick={() => { setShowForm(!showForm); setEditId(null); }}
              className="flex items-center gap-2 bg-capul-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-capul-700 transition-colors">
              <Plus className="w-4 h-4" /> Novo Produto
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Codigo *</label>
                <input type="text" value={codigo} onChange={(e) => setCodigo(e.target.value)} required maxLength={15}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600" placeholder="SRV00001" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descricao *</label>
                <input type="text" value={descricao} onChange={(e) => setDescricao(e.target.value)} required maxLength={50}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600" placeholder="Servico de Licenciamento" />
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
        ) : produtos.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Nenhum produto cadastrado</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-3">Codigo</th>
                  <th className="px-6 py-3">Descricao</th>
                  <th className="px-6 py-3">Status</th>
                  {canManage && <th className="px-6 py-3">Acoes</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {produtos.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    {editId === p.id ? (
                      <>
                        <td className="px-6 py-3">
                          <input value={editCodigo} onChange={(e) => setEditCodigo(e.target.value)} maxLength={15}
                            className="w-full border border-slate-300 rounded px-2 py-1 text-sm" />
                        </td>
                        <td className="px-6 py-3">
                          <input value={editDescricao} onChange={(e) => setEditDescricao(e.target.value)} maxLength={50}
                            className="w-full border border-slate-300 rounded px-2 py-1 text-sm" />
                        </td>
                        <td className="px-6 py-3">
                          <span className={`text-xs px-2 py-1 rounded-full ${p.status === 'ATIVO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{p.status}</span>
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
                        <td className="px-6 py-4 text-sm font-medium text-slate-700">{p.codigo}</td>
                        <td className="px-6 py-4 text-sm">
                          <button onClick={() => startEdit(p)} className="text-capul-600 hover:underline text-left">{p.descricao}</button>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-xs px-2 py-1 rounded-full ${p.status === 'ATIVO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{p.status}</span>
                        </td>
                        {canManage && (
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <button onClick={() => startEdit(p)} className="flex items-center gap-1 text-xs text-capul-600 hover:underline"><Pencil className="w-3.5 h-3.5" /> Editar</button>
                              <button onClick={() => handleToggleStatus(p)} className="text-xs text-capul-600 hover:underline">{p.status === 'ATIVO' ? 'Inativar' : 'Ativar'}</button>
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
