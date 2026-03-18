import { useEffect, useState } from 'react';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { centroCustoService } from '../../services/centro-custo.service';
import { filialService } from '../../services/filial.service';
import { Plus, Wallet, Pencil, Trash2 } from 'lucide-react';
import type { CentroCusto, FilialOption } from '../../types';

export function CentrosCustoPage() {
  const { configuradorRole } = useAuth();
  const canEdit = configuradorRole === 'ADMIN' || configuradorRole === 'GESTOR';

  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);
  const [filiais, setFiliais] = useState<FilialOption[]>([]);
  const [filialId, setFilialId] = useState('');
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    filialService.listar().then((data) => {
      setFiliais(data);
      if (data.length > 0) setFilialId(data[0].id);
    });
  }, []);

  useEffect(() => {
    if (filialId) carregar();
  }, [filialId]);

  async function carregar() {
    setLoading(true);
    try {
      const data = await centroCustoService.listar(filialId);
      setCentrosCusto(data);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }

  function iniciarEdicao(cc: CentroCusto) {
    setEditingId(cc.id);
    setCodigo(cc.codigo);
    setNome(cc.nome);
    setDescricao(cc.descricao || '');
    setShowForm(true);
  }

  function iniciarNovo() {
    setEditingId(null);
    setCodigo('');
    setNome('');
    setDescricao('');
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await centroCustoService.atualizar(editingId, { codigo, nome, descricao });
      } else {
        await centroCustoService.criar({ codigo, nome, descricao, filialId });
      }
      setCodigo('');
      setNome('');
      setDescricao('');
      setShowForm(false);
      setEditingId(null);
      carregar();
    } catch {
      alert('Erro ao salvar centro de custo');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(cc: CentroCusto) {
    const novoStatus = cc.status === 'ATIVO' ? 'INATIVO' : 'ATIVO';
    try {
      await centroCustoService.atualizar(cc.id, { status: novoStatus } as Partial<CentroCusto>);
      setCentrosCusto((prev) => prev.map((c) => c.id === cc.id ? { ...c, status: novoStatus } : c));
    } catch {
      // silencioso
    }
  }

  const filialSelecionada = filiais.find((f) => f.id === filialId);

  return (
    <>
      <Header title="Centros de Custo" />
      <div className="p-6">
        {/* Filtro Filial */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-700">Filial:</label>
            <select
              value={filialId}
              onChange={(e) => setFilialId(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              {filiais.map((f) => (
                <option key={f.id} value={f.id}>{f.codigo} - {f.nomeFantasia}</option>
              ))}
            </select>
          </div>
          {canEdit && (
            <button
              onClick={iniciarNovo}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Novo Centro de Custo
            </button>
          )}
        </div>

        {showForm && canEdit && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
            <h4 className="text-sm font-semibold text-slate-800 mb-4">
              {editingId ? 'Editar Centro de Custo' : 'Novo Centro de Custo'}
              {filialSelecionada && <span className="font-normal text-slate-500"> — {filialSelecionada.codigo} - {filialSelecionada.nomeFantasia}</span>}
            </h4>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Codigo *</label>
                <input type="text" value={codigo} onChange={(e) => setCodigo(e.target.value)} required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600" placeholder="CC001" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
                <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600" placeholder="Centro de Custo TI" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descricao</label>
                <input type="text" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600" />
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
        ) : centrosCusto.length === 0 ? (
          <div className="text-center py-12">
            <Wallet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Nenhum centro de custo cadastrado nesta filial</p>
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
                  {canEdit && <th className="px-6 py-3">Acoes</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {centrosCusto.map((cc) => (
                  <tr key={cc.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-medium text-slate-700">{cc.codigo}</td>
                    <td className="px-6 py-4 text-sm">
                      {canEdit ? (
                        <button onClick={() => iniciarEdicao(cc)} className="text-emerald-600 hover:underline text-left">{cc.nome}</button>
                      ) : (
                        <span className="text-slate-600">{cc.nome}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{cc.descricao || '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2 py-1 rounded-full ${cc.status === 'ATIVO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{cc.status}</span>
                    </td>
                    {canEdit && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button onClick={() => iniciarEdicao(cc)} className="flex items-center gap-1 text-xs text-emerald-600 hover:underline">
                            <Pencil className="w-3.5 h-3.5" /> Editar
                          </button>
                          <button onClick={() => toggleStatus(cc)} className="text-xs text-emerald-600 hover:underline">
                            {cc.status === 'ATIVO' ? 'Inativar' : 'Ativar'}
                          </button>
                          <button onClick={async () => {
                            if (!confirm(`Excluir centro de custo "${cc.nome}"?`)) return;
                            try { await centroCustoService.excluir(cc.id); carregar(); }
                            catch (err: unknown) { alert((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao excluir'); }
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
