import { useEffect, useState } from 'react';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { departamentoService } from '../../services/departamento.service';
import { filialService } from '../../services/filial.service';
import { Plus, Building, Pencil } from 'lucide-react';
import type { Departamento, FilialOption, TipoDepartamento } from '../../types';

export function DepartamentosPage() {
  const { configuradorRole } = useAuth();
  const canEdit = configuradorRole === 'ADMIN' || configuradorRole === 'GESTOR';

  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [filiais, setFiliais] = useState<FilialOption[]>([]);
  const [filialId, setFilialId] = useState('');
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tipo, setTipo] = useState<TipoDepartamento>('ADMINISTRATIVO');
  const [saving, setSaving] = useState(false);

  const tipoLabels: Record<TipoDepartamento, string> = {
    ADMINISTRATIVO: 'Administrativo',
    COMERCIAL: 'Comercial',
    OPERACIONAL: 'Operacional',
    TECNOLOGIA: 'Tecnologia',
  };

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
      const data = await departamentoService.listar(filialId);
      setDepartamentos(data);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }

  function iniciarEdicao(depto: Departamento) {
    setEditingId(depto.id);
    setNome(depto.nome);
    setDescricao(depto.descricao || '');
    setTipo(depto.tipo || 'ADMINISTRATIVO');
    setShowForm(true);
  }

  function iniciarNovo() {
    setEditingId(null);
    setNome('');
    setDescricao('');
    setTipo('ADMINISTRATIVO');
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await departamentoService.atualizar(editingId, { nome, descricao, tipo });
      } else {
        await departamentoService.criar({ nome, descricao, tipo, filialId });
      }
      setNome('');
      setDescricao('');
      setShowForm(false);
      setEditingId(null);
      carregar();
    } catch {
      alert('Erro ao salvar departamento');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(depto: Departamento) {
    const novoStatus = depto.status === 'ATIVO' ? 'INATIVO' : 'ATIVO';
    try {
      await departamentoService.atualizar(depto.id, { status: novoStatus } as Partial<Departamento>);
      setDepartamentos((prev) => prev.map((d) => d.id === depto.id ? { ...d, status: novoStatus } : d));
    } catch {
      // silencioso
    }
  }

  const filialSelecionada = filiais.find((f) => f.id === filialId);

  return (
    <>
      <Header title="Departamentos" />
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
              Novo Departamento
            </button>
          )}
        </div>

        {showForm && canEdit && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
            <h4 className="text-sm font-semibold text-slate-800 mb-4">
              {editingId ? 'Editar Departamento' : 'Novo Departamento'}
              {filialSelecionada && <span className="font-normal text-slate-500"> — {filialSelecionada.codigo} - {filialSelecionada.nomeFantasia}</span>}
            </h4>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
                <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600" placeholder="Tecnologia da Informacao" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo *</label>
                <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoDepartamento)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600">
                  {(Object.keys(tipoLabels) as TipoDepartamento[]).map((t) => (
                    <option key={t} value={t}>{tipoLabels[t]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descricao</label>
                <input type="text" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600" placeholder="Departamento de TI" />
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
        ) : departamentos.length === 0 ? (
          <div className="text-center py-12">
            <Building className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Nenhum departamento cadastrado nesta filial</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-3">Nome</th>
                  <th className="px-6 py-3">Tipo</th>
                  <th className="px-6 py-3">Descricao</th>
                  <th className="px-6 py-3">Status</th>
                  {canEdit && <th className="px-6 py-3">Acoes</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {departamentos.map((depto) => (
                  <tr key={depto.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-medium">
                      {canEdit ? (
                        <button onClick={() => iniciarEdicao(depto)} className="text-emerald-600 hover:underline text-left">{depto.nome}</button>
                      ) : (
                        <span className="text-slate-700">{depto.nome}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{tipoLabels[depto.tipo] || depto.tipo}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{depto.descricao || '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2 py-1 rounded-full ${depto.status === 'ATIVO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{depto.status}</span>
                    </td>
                    {canEdit && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button onClick={() => iniciarEdicao(depto)} className="flex items-center gap-1 text-xs text-emerald-600 hover:underline">
                            <Pencil className="w-3.5 h-3.5" /> Editar
                          </button>
                          <button onClick={() => toggleStatus(depto)} className="text-xs text-emerald-600 hover:underline">
                            {depto.status === 'ATIVO' ? 'Inativar' : 'Ativar'}
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
