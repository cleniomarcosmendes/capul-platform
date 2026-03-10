import { useEffect, useState } from 'react';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { coreService } from '../../services/core.service';
import { Plus, Wallet, Pencil, Check, X } from 'lucide-react';
import type { CentroCusto } from '../../types';
import { useToast } from '../../components/Toast';

export function CentrosCustoPage() {
  const { usuario, gestaoTiRole } = useAuth();
  const isAdmin = gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR_TI';
  const { toast } = useToast();

  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [nome, setNome] = useState('');
  const [codigo, setCodigo] = useState('');
  const [saving, setSaving] = useState(false);

  // Inline edit
  const [editId, setEditId] = useState<string | null>(null);
  const [editCodigo, setEditCodigo] = useState('');
  const [editNome, setEditNome] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    try {
      const data = await coreService.listarCentrosCusto(usuario?.filialAtual.id);
      setCentrosCusto(data);
    } catch { /* empty */ }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await coreService.criarCentroCusto({ nome, codigo, filialId: usuario?.filialAtual.id });
      setNome(''); setCodigo('');
      setShowForm(false);
      toast('success', 'Centro de custo criado');
      carregar();
    } catch {
      toast('error', 'Erro ao criar centro de custo');
    }
    setSaving(false);
  }

  function startEdit(cc: CentroCusto) {
    setEditId(cc.id);
    setEditCodigo(cc.codigo);
    setEditNome(cc.nome);
  }

  function cancelEdit() {
    setEditId(null);
  }

  async function saveEdit() {
    if (!editId) return;
    setEditSaving(true);
    try {
      await coreService.atualizarCentroCusto(editId, { codigo: editCodigo, nome: editNome });
      toast('success', 'Centro de custo atualizado');
      setEditId(null);
      carregar();
    } catch {
      toast('error', 'Erro ao atualizar centro de custo');
    }
    setEditSaving(false);
  }

  async function handleToggleStatus(cc: CentroCusto) {
    const novoStatus = cc.status === 'ATIVO' ? 'INATIVO' : 'ATIVO';
    try {
      await coreService.atualizarCentroCusto(cc.id, { status: novoStatus });
      toast('success', `Centro de custo ${novoStatus === 'ATIVO' ? 'ativado' : 'inativado'}`);
      carregar();
    } catch {
      toast('error', 'Erro ao atualizar status');
    }
  }

  return (
    <>
      <Header title="Centros de Custo" />
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-slate-500">
            Centros de custo da filial {usuario?.filialAtual.codigo} - {usuario?.filialAtual.nome}
          </p>
          {isAdmin && (
            <button
              onClick={() => { setShowForm(!showForm); cancelEdit(); }}
              className="flex items-center gap-2 bg-capul-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-capul-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Novo Centro de Custo
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Codigo *</label>
                <input type="text" value={codigo} onChange={(e) => setCodigo(e.target.value)} required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600" placeholder="CC001" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
                <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600" placeholder="Centro de Custo TI" />
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
        ) : centrosCusto.length === 0 ? (
          <div className="text-center py-12">
            <Wallet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Nenhum centro de custo cadastrado</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-3">Codigo</th>
                  <th className="px-6 py-3">Nome</th>
                  <th className="px-6 py-3">Status</th>
                  {isAdmin && <th className="px-6 py-3">Acoes</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {centrosCusto.map((cc) => (
                  <tr key={cc.id} className="hover:bg-slate-50">
                    {editId === cc.id ? (
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
                          <span className={`text-xs px-2 py-1 rounded-full ${cc.status === 'ATIVO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {cc.status}
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
                        <td className="px-6 py-4 text-sm font-medium text-slate-700">{cc.codigo}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{cc.nome}</td>
                        <td className="px-6 py-4">
                          <span className={`text-xs px-2 py-1 rounded-full ${cc.status === 'ATIVO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {cc.status}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <button onClick={() => startEdit(cc)} className="flex items-center gap-1 text-xs text-capul-600 hover:underline">
                                <Pencil className="w-3.5 h-3.5" />
                                Editar
                              </button>
                              <button onClick={() => handleToggleStatus(cc)} className="text-xs text-capul-600 hover:underline">
                                {cc.status === 'ATIVO' ? 'Inativar' : 'Ativar'}
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
