import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { equipeService } from '../../services/equipe.service';
import { coreService } from '../../services/core.service';
import { ArrowLeft, Pencil, UserPlus, Trash2, Star, StarOff, FileText } from 'lucide-react';
import type { EquipeTI, UsuarioCore } from '../../types';
import { useToast } from '../../components/Toast';

export function EquipeDetalhePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { gestaoTiRole } = useAuth();

  const isAdmin = gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR_TI';
  const { toast, confirm } = useToast();

  const [equipe, setEquipe] = useState<EquipeTI | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddMembro, setShowAddMembro] = useState(false);
  const [usuarios, setUsuarios] = useState<UsuarioCore[]>([]);
  const [selectedUsuarioId, setSelectedUsuarioId] = useState('');
  const [isLider, setIsLider] = useState(false);
  const [podeGerirContratos, setPodeGerirContratos] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (id) carregarEquipe();
  }, [id]);

  async function carregarEquipe() {
    setLoading(true);
    try {
      const data = await equipeService.buscar(id!);
      setEquipe(data);
    } catch {
      navigate('/gestao-ti/equipes');
    } finally {
      setLoading(false);
    }
  }

  async function abrirAddMembro() {
    setShowAddMembro(true);
    try {
      const data = await coreService.listarUsuarios();
      const membrosIds = equipe?.membros.map((m) => m.usuarioId) || [];
      setUsuarios(data.filter((u: UsuarioCore) => !membrosIds.includes(u.id)));
    } catch {
      toast('error', 'Erro ao carregar usuarios');
    }
  }

  async function handleAddMembro() {
    if (!selectedUsuarioId) return;
    setAdding(true);
    try {
      await equipeService.adicionarMembro(id!, { usuarioId: selectedUsuarioId, isLider, podeGerirContratos });
      setShowAddMembro(false);
      setSelectedUsuarioId('');
      setIsLider(false);
      setPodeGerirContratos(false);
      carregarEquipe();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast('error', message || 'Erro ao adicionar membro');
    } finally {
      setAdding(false);
    }
  }

  async function toggleLider(membroId: string, currentIsLider: boolean) {
    try {
      await equipeService.atualizarMembro(id!, membroId, { isLider: !currentIsLider });
      carregarEquipe();
    } catch {
      toast('error', 'Erro ao atualizar membro');
    }
  }

  async function toggleContratos(membroId: string, current: boolean) {
    try {
      await equipeService.atualizarMembro(id!, membroId, { podeGerirContratos: !current });
      carregarEquipe();
    } catch {
      toast('error', 'Erro ao atualizar permissao');
    }
  }

  async function removerMembro(membroId: string, nome: string) {
    if (!await confirm('Remover Membro', `Deseja remover ${nome} da equipe?`, { variant: 'danger' })) return;
    try {
      await equipeService.removerMembro(id!, membroId);
      carregarEquipe();
    } catch {
      toast('error', 'Erro ao remover membro');
    }
  }

  if (loading) {
    return (
      <>
        <Header title="Detalhe da Equipe" />
        <div className="p-6 text-center text-slate-500">Carregando...</div>
      </>
    );
  }

  if (!equipe) return null;

  return (
    <>
      <Header title={equipe.nome} />
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/gestao-ti/equipes')}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
          {isAdmin && (
            <button
              onClick={() => navigate(`/gestao-ti/equipes/${id}/editar`)}
              className="flex items-center gap-2 text-sm text-capul-600 hover:text-capul-700"
            >
              <Pencil className="w-4 h-4" />
              Editar
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Info */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: equipe.cor || '#006838' }}
              >
                {equipe.sigla}
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">{equipe.nome}</h3>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    equipe.status === 'ATIVO'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {equipe.status}
                </span>
              </div>
            </div>
            {equipe.descricao && (
              <p className="text-sm text-slate-600 mb-4">{equipe.descricao}</p>
            )}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Sigla:</span>
                <span className="text-slate-700 font-medium">{equipe.sigla}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Chamados externos:</span>
                <span className="text-slate-700">{equipe.aceitaChamadoExterno ? 'Sim' : 'Nao'}</span>
              </div>
              {equipe.emailEquipe && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Email:</span>
                  <span className="text-slate-700">{equipe.emailEquipe}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Ordem:</span>
                <span className="text-slate-700">{equipe.ordem}</span>
              </div>
            </div>
          </div>

          {/* Membros */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h4 className="font-semibold text-slate-700">
                Membros ({equipe.membros.length})
              </h4>
              {isAdmin && (
                <button
                  onClick={abrirAddMembro}
                  className="flex items-center gap-1 text-sm text-capul-600 hover:text-capul-700"
                >
                  <UserPlus className="w-4 h-4" />
                  Adicionar
                </button>
              )}
            </div>

            {showAddMembro && (
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Usuario</label>
                    <select
                      value={selectedUsuarioId}
                      onChange={(e) => setSelectedUsuarioId(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                    >
                      <option value="">Selecione...</option>
                      {usuarios.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nome} ({u.username})
                        </option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-600 pb-2">
                    <input
                      type="checkbox"
                      checked={isLider}
                      onChange={(e) => setIsLider(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    Lider
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-600 pb-2">
                    <input
                      type="checkbox"
                      checked={podeGerirContratos}
                      onChange={(e) => setPodeGerirContratos(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    Contratos
                  </label>
                  <button
                    onClick={handleAddMembro}
                    disabled={!selectedUsuarioId || adding}
                    className="bg-capul-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-capul-700 disabled:opacity-50"
                  >
                    {adding ? '...' : 'Adicionar'}
                  </button>
                  <button
                    onClick={() => setShowAddMembro(false)}
                    className="text-sm text-slate-500 hover:text-slate-700 pb-2"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {equipe.membros.length === 0 ? (
              <div className="px-6 py-8 text-center text-slate-400 text-sm">
                Nenhum membro nesta equipe
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {equipe.membros.map((membro) => (
                  <div key={membro.id} className="px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-600">
                        {membro.usuario.nome.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="text-sm font-medium text-slate-700">
                          {membro.usuario.nome}
                        </span>
                        <span className="text-xs text-slate-400 ml-2">
                          @{membro.usuario.username}
                        </span>
                        {membro.isLider && (
                          <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                            Lider
                          </span>
                        )}
                        {membro.podeGerirContratos && (
                          <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                            Contratos
                          </span>
                        )}
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleLider(membro.id, membro.isLider)}
                          className="p-1.5 text-slate-400 hover:text-amber-500 transition-colors"
                          title={membro.isLider ? 'Remover lider' : 'Tornar lider'}
                        >
                          {membro.isLider ? (
                            <Star className="w-4 h-4 text-amber-500" />
                          ) : (
                            <StarOff className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => toggleContratos(membro.id, membro.podeGerirContratos)}
                          className={`p-1.5 transition-colors ${membro.podeGerirContratos ? 'text-emerald-500 hover:text-emerald-700' : 'text-slate-400 hover:text-emerald-500'}`}
                          title={membro.podeGerirContratos ? 'Remover permissao de contratos' : 'Permitir gerir contratos'}
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => removerMembro(membro.id, membro.usuario.nome)}
                          className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                          title="Remover"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
