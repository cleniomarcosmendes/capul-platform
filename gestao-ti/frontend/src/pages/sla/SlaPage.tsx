import { useEffect, useState } from 'react';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { slaService } from '../../services/sla.service';
import { equipeService } from '../../services/equipe.service';
import { Plus, X, Pencil, Trash2 } from 'lucide-react';
import type { SlaDefinicao, EquipeTI, Prioridade } from '../../types';
import { useToast } from '../../components/Toast';

const prioridadeLabels: Record<Prioridade, string> = {
  CRITICA: 'Critica', ALTA: 'Alta', MEDIA: 'Media', BAIXA: 'Baixa',
};

export function SlaPage() {
  const { gestaoTiRole } = useAuth();
  const isAdmin = ['ADMIN', 'GESTOR_TI'].includes(gestaoTiRole || '');
  const { toast } = useToast();

  const [items, setItems] = useState<SlaDefinicao[]>([]);
  const [equipes, setEquipes] = useState<EquipeTI[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEquipe, setFilterEquipe] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<SlaDefinicao | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [nome, setNome] = useState('');
  const [prioridade, setPrioridade] = useState<Prioridade>('MEDIA');
  const [horasResposta, setHorasResposta] = useState('');
  const [horasResolucao, setHorasResolucao] = useState('');
  const [equipeId, setEquipeId] = useState('');

  function loadItems() {
    setLoading(true);
    slaService.listar(filterEquipe || undefined)
      .then(setItems).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => { loadItems(); }, [filterEquipe]);
  useEffect(() => { equipeService.listar('ATIVO').then(setEquipes).catch(() => {}); }, []);

  function openEdit(item: SlaDefinicao) {
    setEditItem(item);
    setNome(item.nome);
    setPrioridade(item.prioridade);
    setHorasResposta(item.horasResposta.toString());
    setHorasResolucao(item.horasResolucao.toString());
    setEquipeId(item.equipeId);
    setShowForm(true);
  }

  function resetForm() {
    setShowForm(false);
    setEditItem(null);
    setNome(''); setPrioridade('MEDIA'); setHorasResposta(''); setHorasResolucao(''); setEquipeId('');
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        nome,
        prioridade,
        horasResposta: parseInt(horasResposta),
        horasResolucao: parseInt(horasResolucao),
        equipeId,
      };
      if (editItem) {
        await slaService.atualizar(editItem.id, payload);
      } else {
        await slaService.criar(payload);
      }
      resetForm();
      loadItems();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(item: SlaDefinicao) {
    const newStatus = item.status === 'ATIVO' ? 'INATIVO' : 'ATIVO';
    await slaService.atualizarStatus(item.id, newStatus);
    loadItems();
  }

  return (
    <>
      <Header title="SLA - Acordo de Nivel de Servico" />
      <div className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <select
            value={filterEquipe}
            onChange={(e) => setFilterEquipe(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">Todas as Equipes</option>
            {equipes.map((e) => <option key={e.id} value={e.id}>{e.sigla} - {e.nome}</option>)}
          </select>

          {isAdmin && (
            <button
              onClick={() => { if (showForm) resetForm(); else setShowForm(true); }}
              className="flex items-center gap-2 bg-capul-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-capul-700 transition-colors"
            >
              {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showForm ? 'Cancelar' : 'Novo SLA'}
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 mb-6 space-y-4">
            <h4 className="font-medium text-slate-700">{editItem ? 'Editar SLA' : 'Novo SLA'}</h4>
            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
                <input value={nome} onChange={(e) => setNome(e.target.value)} required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Ex: SLA Critico Infra" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Equipe *</label>
                <select value={equipeId} onChange={(e) => setEquipeId(e.target.value)} required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="">Selecione</option>
                  {equipes.map((e) => <option key={e.id} value={e.id}>{e.sigla} - {e.nome}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Prioridade *</label>
                <select value={prioridade} onChange={(e) => setPrioridade(e.target.value as Prioridade)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                  {Object.entries(prioridadeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Horas Resposta *</label>
                <input type="number" value={horasResposta} onChange={(e) => setHorasResposta(e.target.value)} required min={1}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Horas Resolucao *</label>
                <input type="number" value={horasResolucao} onChange={(e) => setHorasResolucao(e.target.value)} required min={1}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>

            <button type="submit" disabled={saving}
              className="bg-capul-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-capul-700 disabled:opacity-50">
              {saving ? 'Salvando...' : editItem ? 'Atualizar' : 'Criar SLA'}
            </button>
          </form>
        )}

        {loading ? (
          <p className="text-slate-500">Carregando...</p>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-slate-400">Nenhum SLA cadastrado</div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Nome</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Equipe</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Prioridade</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Resposta (h)</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Resolucao (h)</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  {isAdmin && <th className="px-4 py-3"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <button onClick={() => openEdit(item)} className="font-medium text-capul-600 hover:underline text-left">{item.nome}</button>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{item.equipe.sigla} - {item.equipe.nome}</td>
                    <td className="px-4 py-3 text-slate-600">{prioridadeLabels[item.prioridade]}</td>
                    <td className="px-4 py-3 text-slate-600">{item.horasResposta}h</td>
                    <td className="px-4 py-3 text-slate-600">{item.horasResolucao}h</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${item.status === 'ATIVO' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {item.status}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button onClick={() => openEdit(item)} className="flex items-center gap-1 text-xs text-capul-600 hover:underline">
                            <Pencil className="w-3.5 h-3.5" />
                            Editar
                          </button>
                          <button onClick={() => toggleStatus(item)} className="text-xs text-capul-600 hover:underline">
                            {item.status === 'ATIVO' ? 'Inativar' : 'Ativar'}
                          </button>
                          <button onClick={async () => {
                            if (!confirm(`Excluir SLA "${item.nome}"?`)) return;
                            try { await slaService.excluir(item.id); loadItems(); toast('success', 'SLA excluido'); }
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
