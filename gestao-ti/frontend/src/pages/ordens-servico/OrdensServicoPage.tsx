import { useEffect, useState } from 'react';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { ordemServicoService } from '../../services/ordem-servico.service';
import { coreService } from '../../services/core.service';
import { Plus, X } from 'lucide-react';
import type { OrdemServico, StatusOS, UsuarioCore } from '../../types';

const statusLabels: Record<StatusOS, string> = {
  ABERTA: 'Aberta', EM_EXECUCAO: 'Em Execucao', CONCLUIDA: 'Concluida', CANCELADA: 'Cancelada',
};
const statusColors: Record<StatusOS, string> = {
  ABERTA: 'bg-blue-100 text-blue-700', EM_EXECUCAO: 'bg-yellow-100 text-yellow-700',
  CONCLUIDA: 'bg-green-100 text-green-700', CANCELADA: 'bg-red-100 text-red-600',
};

export function OrdensServicoPage() {
  const { usuario, gestaoTiRole } = useAuth();
  const isTecnico = ['ADMIN', 'GESTOR_TI', 'TECNICO'].includes(gestaoTiRole || '');

  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<StatusOS | ''>('');

  const [showForm, setShowForm] = useState(false);
  const [tecnicos, setTecnicos] = useState<UsuarioCore[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tecnicoId, setTecnicoId] = useState('');
  const [dataAgendamento, setDataAgendamento] = useState('');
  const [chamadoId, setChamadoId] = useState('');
  const [observacoes, setObservacoes] = useState('');

  // Edit mode
  const [editId, setEditId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<StatusOS>('ABERTA');
  const [editObs, setEditObs] = useState('');

  function loadOrdens() {
    setLoading(true);
    ordemServicoService
      .listar(filterStatus || undefined)
      .then(setOrdens)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadOrdens(); }, [filterStatus]);

  useEffect(() => {
    if (showForm && tecnicos.length === 0) {
      coreService.listarUsuarios().then(setTecnicos).catch(() => {});
    }
  }, [showForm, tecnicos.length]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await ordemServicoService.criar({
        titulo,
        descricao: descricao || undefined,
        filialId: usuario!.filialAtual.id,
        tecnicoId,
        dataAgendamento: dataAgendamento || undefined,
        chamadoId: chamadoId || undefined,
        observacoes: observacoes || undefined,
      });
      setShowForm(false);
      setTitulo(''); setDescricao(''); setTecnicoId(''); setDataAgendamento(''); setChamadoId(''); setObservacoes('');
      loadOrdens();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Erro ao criar OS');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateStatus(id: string) {
    try {
      await ordemServicoService.atualizar(id, { status: editStatus, observacoes: editObs || undefined });
      setEditId(null);
      loadOrdens();
    } catch {
      // ignore
    }
  }

  return (
    <>
      <Header title="Ordens de Servico" />
      <div className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as StatusOS | '')}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">Todos os Status</option>
            {Object.entries(statusLabels).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          {isTecnico && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 bg-capul-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-capul-700 transition-colors"
            >
              {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showForm ? 'Cancelar' : 'Nova OS'}
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="bg-white rounded-xl border border-slate-200 p-6 mb-6 space-y-4">
            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Titulo *</label>
                <input value={titulo} onChange={(e) => setTitulo(e.target.value)} required maxLength={200}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tecnico Responsavel *</label>
                <select value={tecnicoId} onChange={(e) => setTecnicoId(e.target.value)} required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="">Selecione</option>
                  {tecnicos.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Descricao</label>
              <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data Agendamento</label>
                <input type="datetime-local" value={dataAgendamento} onChange={(e) => setDataAgendamento(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ID Chamado Vinculado</label>
                <input value={chamadoId} onChange={(e) => setChamadoId(e.target.value)} placeholder="(opcional)"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Observacoes</label>
              <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>

            <button type="submit" disabled={saving}
              className="bg-capul-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-capul-700 disabled:opacity-50">
              {saving ? 'Criando...' : 'Criar OS'}
            </button>
          </form>
        )}

        {loading ? (
          <p className="text-slate-500">Carregando...</p>
        ) : ordens.length === 0 ? (
          <div className="text-center py-12 text-slate-400">Nenhuma ordem de servico encontrada</div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">#</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Titulo</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Tecnico</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Chamado</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Agendamento</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Data</th>
                  {isTecnico && <th className="px-4 py-3"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ordens.map((os) => (
                  <tr key={os.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-500 font-mono">#{os.numero}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 max-w-[200px] truncate">{os.titulo}</td>
                    <td className="px-4 py-3">
                      {editId === os.id ? (
                        <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as StatusOS)}
                          className="border border-slate-300 rounded px-2 py-1 text-xs bg-white">
                          {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      ) : (
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[os.status]}`}>
                          {statusLabels[os.status]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{os.tecnico.nome}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {os.chamado ? `#${os.chamado.numero}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {os.dataAgendamento ? new Date(os.dataAgendamento).toLocaleString('pt-BR') : '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {new Date(os.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    {isTecnico && (
                      <td className="px-4 py-3">
                        {editId === os.id ? (
                          <div className="flex gap-1">
                            <button onClick={() => handleUpdateStatus(os.id)} className="text-xs text-green-600 hover:underline">Salvar</button>
                            <button onClick={() => setEditId(null)} className="text-xs text-slate-500 hover:underline">X</button>
                          </div>
                        ) : (
                          <button onClick={() => { setEditId(os.id); setEditStatus(os.status); setEditObs(os.observacoes || ''); }}
                            className="text-xs text-capul-600 hover:underline">Editar</button>
                        )}
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
