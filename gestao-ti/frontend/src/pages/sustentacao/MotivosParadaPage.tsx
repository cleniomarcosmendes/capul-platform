import { useEffect, useState } from 'react';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { paradaService } from '../../services/parada.service';
import { Plus, AlertTriangle, Pencil, Trash2 } from 'lucide-react';
import type { MotivoParada } from '../../types';
import { useToast } from '../../components/Toast';

export function MotivosParadaPage() {
  const { gestaoTiRole } = useAuth();
  const canManage = gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR_TI';
  const { toast, confirm } = useToast();

  const [motivos, setMotivos] = useState<MotivoParada[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    setLoading(true);
    try {
      const data = await paradaService.listarMotivos();
      setMotivos(data);
    } catch {
      // erro tratado pelo interceptor
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(m: MotivoParada) {
    setEditingId(m.id);
    setNome(m.nome);
    setDescricao(m.descricao || '');
    setShowForm(true);
  }

  function handleCancel() {
    setShowForm(false);
    setEditingId(null);
    setNome('');
    setDescricao('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await paradaService.atualizarMotivo(editingId, {
          nome: nome.trim(),
          descricao: descricao.trim() || undefined,
        });
        toast('success', 'Motivo atualizado');
      } else {
        await paradaService.criarMotivo({
          nome: nome.trim(),
          descricao: descricao.trim() || undefined,
        });
        toast('success', 'Motivo criado');
      }
      handleCancel();
      carregar();
    } catch {
      toast('error', 'Erro ao salvar motivo');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(m: MotivoParada) {
    try {
      await paradaService.atualizarMotivo(m.id, { ativo: !m.ativo });
      carregar();
    } catch {
      toast('error', 'Erro ao atualizar status');
    }
  }

  return (
    <>
      <Header title="Motivos de Parada" />
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-slate-500">
            Cadastro de motivos para classificacao de paradas
          </p>
          {canManage && (
            <button
              onClick={() => { handleCancel(); setShowForm(!showForm); }}
              className="flex items-center gap-2 bg-capul-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-capul-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Novo Motivo
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
            <h4 className="text-sm font-semibold text-slate-700 mb-4">
              {editingId ? 'Editar Motivo' : 'Novo Motivo'}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600"
                  placeholder="Ex: Falha de Hardware"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descricao</label>
                <input
                  type="text"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600"
                  placeholder="Descricao opcional"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="bg-capul-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-capul-700 disabled:opacity-50"
              >
                {saving ? 'Salvando...' : editingId ? 'Salvar Alteracoes' : 'Salvar'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="text-center py-12 text-slate-500">Carregando...</div>
        ) : motivos.length === 0 ? (
          <div className="text-center py-12">
            <AlertTriangle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Nenhum motivo cadastrado</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-3">Nome</th>
                  <th className="px-6 py-3">Descricao</th>
                  <th className="px-6 py-3">Status</th>
                  {canManage && <th className="px-6 py-3">Acoes</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {motivos.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-medium text-slate-700">{m.nome}</td>
                    <td className="px-6 py-4 text-sm text-slate-500">{m.descricao || '-'}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          m.ativo
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {m.ativo ? 'ATIVO' : 'INATIVO'}
                      </span>
                    </td>
                    {canManage && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleEdit(m)}
                            className="text-slate-400 hover:text-capul-600 transition-colors"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(m)}
                            className="text-xs text-capul-600 hover:underline"
                          >
                            {m.ativo ? 'Inativar' : 'Ativar'}
                          </button>
                          <button onClick={async () => {
                            if (!await confirm('Excluir Motivo', `Excluir motivo "${m.nome}"?`, { variant: 'danger' })) return;
                            try { await paradaService.excluirMotivo(m.id); carregar(); toast('success', 'Motivo excluido'); }
                            catch (err: unknown) { toast('error', (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao excluir'); }
                          }} className="flex items-center gap-1 text-xs text-red-600 hover:underline">
                            <Trash2 className="w-3.5 h-3.5" /> Excluir
                          </button>
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
