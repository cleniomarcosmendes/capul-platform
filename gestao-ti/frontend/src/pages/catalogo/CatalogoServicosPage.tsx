import { useEffect, useState } from 'react';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { catalogoService } from '../../services/catalogo.service';
import { equipeService } from '../../services/equipe.service';
import { Plus, X, Power } from 'lucide-react';
import type { CatalogoServico, EquipeTI, Prioridade } from '../../types';

const prioridadeLabels: Record<Prioridade, string> = {
  CRITICA: 'Critica', ALTA: 'Alta', MEDIA: 'Media', BAIXA: 'Baixa',
};

export function CatalogoServicosPage() {
  const { gestaoTiRole } = useAuth();
  const isAdmin = ['ADMIN', 'GESTOR_TI'].includes(gestaoTiRole || '');

  const [items, setItems] = useState<CatalogoServico[]>([]);
  const [equipes, setEquipes] = useState<EquipeTI[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEquipe, setFilterEquipe] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<CatalogoServico | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [equipeId, setEquipeId] = useState('');
  const [prioridadePadrao, setPrioridadePadrao] = useState<Prioridade>('MEDIA');
  const [slaPadraoHoras, setSlaPadraoHoras] = useState('');
  const [ordem, setOrdem] = useState('0');

  function loadItems() {
    setLoading(true);
    catalogoService.listar(filterEquipe || undefined)
      .then(setItems).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => { loadItems(); }, [filterEquipe]);
  useEffect(() => { equipeService.listar('ATIVO').then(setEquipes).catch(() => {}); }, []);

  function openEdit(item: CatalogoServico) {
    setEditItem(item);
    setNome(item.nome);
    setDescricao(item.descricao || '');
    setEquipeId(item.equipeId);
    setPrioridadePadrao(item.prioridadePadrao);
    setSlaPadraoHoras(item.slaPadraoHoras?.toString() || '');
    setOrdem(item.ordem.toString());
    setShowForm(true);
  }

  function resetForm() {
    setShowForm(false);
    setEditItem(null);
    setNome(''); setDescricao(''); setEquipeId(''); setPrioridadePadrao('MEDIA'); setSlaPadraoHoras(''); setOrdem('0');
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        nome,
        descricao: descricao || undefined,
        equipeId,
        prioridadePadrao,
        slaPadraoHoras: slaPadraoHoras ? parseInt(slaPadraoHoras) : undefined,
        ordem: parseInt(ordem) || 0,
      };
      if (editItem) {
        await catalogoService.atualizar(editItem.id, payload);
      } else {
        await catalogoService.criar(payload);
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

  async function toggleStatus(item: CatalogoServico) {
    const newStatus = item.status === 'ATIVO' ? 'INATIVO' : 'ATIVO';
    await catalogoService.atualizarStatus(item.id, newStatus);
    loadItems();
  }

  return (
    <>
      <Header title="Catalogo de Servicos" />
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
              {showForm ? 'Cancelar' : 'Novo Servico'}
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 mb-6 space-y-4">
            <h4 className="font-medium text-slate-700">{editItem ? 'Editar Servico' : 'Novo Servico'}</h4>
            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
                <input value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={100}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
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

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Descricao</label>
              <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} maxLength={500}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Prioridade Padrao</label>
                <select value={prioridadePadrao} onChange={(e) => setPrioridadePadrao(e.target.value as Prioridade)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                  {Object.entries(prioridadeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">SLA Padrao (horas)</label>
                <input type="number" value={slaPadraoHoras} onChange={(e) => setSlaPadraoHoras(e.target.value)} min={1}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Opcional" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ordem</label>
                <input type="number" value={ordem} onChange={(e) => setOrdem(e.target.value)} min={0}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>

            <button type="submit" disabled={saving}
              className="bg-capul-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-capul-700 disabled:opacity-50">
              {saving ? 'Salvando...' : editItem ? 'Atualizar' : 'Criar Servico'}
            </button>
          </form>
        )}

        {loading ? (
          <p className="text-slate-500">Carregando...</p>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-slate-400">Nenhum servico cadastrado</div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Nome</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Equipe</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Prioridade Padrao</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">SLA (h)</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Ordem</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  {isAdmin && <th className="px-4 py-3"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-medium text-slate-800">{item.nome}</span>
                        {item.descricao && <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px]">{item.descricao}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.equipe.cor || '#006838' }} />
                        <span className="text-slate-600">{item.equipe.sigla}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{prioridadeLabels[item.prioridadePadrao]}</td>
                    <td className="px-4 py-3 text-slate-600">{item.slaPadraoHoras || '-'}</td>
                    <td className="px-4 py-3 text-slate-500">{item.ordem}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${item.status === 'ATIVO' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {item.status}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(item)} className="text-xs text-capul-600 hover:underline">Editar</button>
                          <button onClick={() => toggleStatus(item)} title={item.status === 'ATIVO' ? 'Desativar' : 'Ativar'}>
                            <Power className={`w-4 h-4 ${item.status === 'ATIVO' ? 'text-green-500' : 'text-slate-400'}`} />
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
