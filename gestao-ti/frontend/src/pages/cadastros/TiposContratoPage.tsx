import { useEffect, useState } from 'react';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { contratoService } from '../../services/contrato.service';
import { Plus, Layers, Pencil, Check, X, Trash2 } from 'lucide-react';
import type { TipoContratoConfig } from '../../types';
import { useToast } from '../../components/Toast';

export function TiposContratoPage() {
  const { gestaoTiRole } = useAuth();
  const canManage = gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR_TI';
  const { toast } = useToast();

  const [tipos, setTipos] = useState<TipoContratoConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
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
      const data = await contratoService.listarTodosTiposContrato();
      setTipos(data);
    } catch { /* empty */ }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await contratoService.criarTipoContrato({ codigo, nome });
      setCodigo(''); setNome('');
      setShowForm(false);
      toast('success', 'Tipo de contrato criado');
      carregar();
    } catch {
      toast('error', 'Erro ao criar tipo de contrato');
    }
    setSaving(false);
  }

  function startEdit(tipo: TipoContratoConfig) {
    setEditId(tipo.id);
    setEditCodigo(tipo.codigo);
    setEditNome(tipo.nome);
  }

  function cancelEdit() {
    setEditId(null);
  }

  async function saveEdit() {
    if (!editId) return;
    setEditSaving(true);
    try {
      await contratoService.atualizarTipoContrato(editId, { codigo: editCodigo, nome: editNome });
      toast('success', 'Tipo de contrato atualizado');
      setEditId(null);
      carregar();
    } catch {
      toast('error', 'Erro ao atualizar tipo de contrato');
    }
    setEditSaving(false);
  }

  async function handleToggleStatus(tipo: TipoContratoConfig) {
    const novoStatus = tipo.status === 'ATIVO' ? 'INATIVO' : 'ATIVO';
    try {
      await contratoService.atualizarTipoContrato(tipo.id, { status: novoStatus });
      toast('success', `Tipo ${novoStatus === 'ATIVO' ? 'ativado' : 'inativado'}`);
      carregar();
    } catch {
      toast('error', 'Erro ao atualizar status');
    }
  }

  return (
    <>
      <Header title="Tipos de Contrato" />
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-slate-500">
            Cadastro de tipos para classificacao de contratos
          </p>
          {canManage && (
            <button
              onClick={() => { setShowForm(!showForm); cancelEdit(); }}
              className="flex items-center gap-2 bg-capul-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-capul-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Novo Tipo
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Codigo *</label>
                <input type="text" value={codigo} onChange={(e) => setCodigo(e.target.value)} required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600" placeholder="LIC" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
                <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600" placeholder="Licenciamento" />
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
            <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Nenhum tipo de contrato cadastrado</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-3">Codigo</th>
                  <th className="px-6 py-3">Nome</th>
                  <th className="px-6 py-3">Status</th>
                  {canManage && <th className="px-6 py-3">Acoes</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tipos.map((tipo) => (
                  <tr key={tipo.id} className="hover:bg-slate-50">
                    {editId === tipo.id ? (
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
                          <span className={`text-xs px-2 py-1 rounded-full ${tipo.status === 'ATIVO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {tipo.status}
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
                        <td className="px-6 py-4 text-sm font-medium text-slate-700">{tipo.codigo}</td>
                        <td className="px-6 py-4 text-sm">
                          <button onClick={() => startEdit(tipo)} className="text-capul-600 hover:underline text-left">{tipo.nome}</button>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-xs px-2 py-1 rounded-full ${tipo.status === 'ATIVO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {tipo.status}
                          </span>
                        </td>
                        {canManage && (
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <button onClick={() => startEdit(tipo)} className="flex items-center gap-1 text-xs text-capul-600 hover:underline">
                                <Pencil className="w-3.5 h-3.5" />
                                Editar
                              </button>
                              <button onClick={() => handleToggleStatus(tipo)} className="text-xs text-capul-600 hover:underline">
                                {tipo.status === 'ATIVO' ? 'Inativar' : 'Ativar'}
                              </button>
                              <button onClick={async () => {
                                if (!confirm(`Excluir tipo "${tipo.nome}"?`)) return;
                                try { await contratoService.excluirTipoContrato(tipo.id); carregar(); toast('success', 'Tipo excluido'); }
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
