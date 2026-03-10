import { useEffect, useState } from 'react';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { coreService } from '../../services/core.service';
import { Plus, Building2, Pencil, Check, X } from 'lucide-react';
import type { Departamento } from '../../types';
import { useToast } from '../../components/Toast';

export function DepartamentosPage() {
  const { usuario, gestaoTiRole } = useAuth();
  const isAdmin = gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR_TI';
  const { toast } = useToast();

  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [nome, setNome] = useState('');
  const [codigo, setCodigo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [saving, setSaving] = useState(false);

  // Inline edit
  const [editId, setEditId] = useState<string | null>(null);
  const [editCodigo, setEditCodigo] = useState('');
  const [editNome, setEditNome] = useState('');
  const [editDescricao, setEditDescricao] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    try {
      const data = await coreService.listarDepartamentos(usuario?.filialAtual.id);
      setDepartamentos(data);
    } catch { /* empty */ }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await coreService.criarDepartamento({ nome, codigo, descricao: descricao || undefined, filialId: usuario?.filialAtual.id });
      setNome(''); setCodigo(''); setDescricao('');
      setShowForm(false);
      toast('success', 'Departamento criado');
      carregar();
    } catch {
      toast('error', 'Erro ao criar departamento');
    }
    setSaving(false);
  }

  function startEdit(depto: Departamento) {
    setEditId(depto.id);
    setEditCodigo(depto.codigo || '');
    setEditNome(depto.nome);
    setEditDescricao(depto.descricao || '');
  }

  function cancelEdit() {
    setEditId(null);
  }

  async function saveEdit() {
    if (!editId) return;
    setEditSaving(true);
    try {
      await coreService.atualizarDepartamento(editId, { codigo: editCodigo, nome: editNome, descricao: editDescricao || undefined });
      toast('success', 'Departamento atualizado');
      setEditId(null);
      carregar();
    } catch {
      toast('error', 'Erro ao atualizar departamento');
    }
    setEditSaving(false);
  }

  async function handleToggleStatus(depto: Departamento) {
    const novoStatus = depto.status === 'ATIVO' ? 'INATIVO' : 'ATIVO';
    try {
      await coreService.atualizarDepartamento(depto.id, { status: novoStatus });
      toast('success', `Departamento ${novoStatus === 'ATIVO' ? 'ativado' : 'inativado'}`);
      carregar();
    } catch {
      toast('error', 'Erro ao atualizar status');
    }
  }

  return (
    <>
      <Header title="Departamentos" />
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-slate-500">
            Departamentos da filial {usuario?.filialAtual.codigo} - {usuario?.filialAtual.nome}
          </p>
          {isAdmin && (
            <button
              onClick={() => { setShowForm(!showForm); cancelEdit(); }}
              className="flex items-center gap-2 bg-capul-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-capul-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Novo Departamento
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Codigo *</label>
                <input type="text" value={codigo} onChange={(e) => setCodigo(e.target.value)} required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600" placeholder="TI" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
                <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600" placeholder="Tecnologia da Informacao" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descricao</label>
                <input type="text" value={descricao} onChange={(e) => setDescricao(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600" placeholder="Descricao do departamento" />
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
        ) : departamentos.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Nenhum departamento cadastrado</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-3">Codigo</th>
                  <th className="px-6 py-3">Nome</th>
                  <th className="px-6 py-3">Descricao</th>
                  <th className="px-6 py-3">Status</th>
                  {isAdmin && <th className="px-6 py-3">Acoes</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {departamentos.map((depto) => (
                  <tr key={depto.id} className="hover:bg-slate-50">
                    {editId === depto.id ? (
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
                          <span className={`text-xs px-2 py-1 rounded-full ${depto.status === 'ATIVO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {depto.status}
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
                        <td className="px-6 py-4 text-sm font-medium text-slate-700">{depto.codigo || '-'}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{depto.nome}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">{depto.descricao || '-'}</td>
                        <td className="px-6 py-4">
                          <span className={`text-xs px-2 py-1 rounded-full ${depto.status === 'ATIVO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {depto.status}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <button onClick={() => startEdit(depto)} className="flex items-center gap-1 text-xs text-capul-600 hover:underline">
                                <Pencil className="w-3.5 h-3.5" />
                                Editar
                              </button>
                              <button onClick={() => handleToggleStatus(depto)} className="text-xs text-capul-600 hover:underline">
                                {depto.status === 'ATIVO' ? 'Inativar' : 'Ativar'}
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
