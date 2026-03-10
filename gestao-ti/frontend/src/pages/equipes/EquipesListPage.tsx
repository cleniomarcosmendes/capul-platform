import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { equipeService } from '../../services/equipe.service';
import { Plus, Pencil, Users } from 'lucide-react';
import type { EquipeTI } from '../../types';
import { useToast } from '../../components/Toast';

export function EquipesListPage() {
  const navigate = useNavigate();
  const { gestaoTiRole } = useAuth();
  const [equipes, setEquipes] = useState<EquipeTI[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<string>('');

  const isAdmin = gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR_TI';
  const { toast } = useToast();

  useEffect(() => {
    carregarEquipes();
  }, [filtroStatus]);

  async function carregarEquipes() {
    setLoading(true);
    try {
      const data = await equipeService.listar(filtroStatus || undefined);
      setEquipes(data);
    } catch {
      // erro tratado pelo interceptor
    } finally {
      setLoading(false);
    }
  }

  async function toggleStatus(equipe: EquipeTI) {
    const novoStatus = equipe.status === 'ATIVO' ? 'INATIVO' : 'ATIVO';
    try {
      await equipeService.atualizarStatus(equipe.id, novoStatus);
      carregarEquipes();
    } catch {
      toast('error', 'Erro ao alterar status');
    }
  }

  return (
    <>
      <Header title="Equipes de T.I." />
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-capul-600"
            >
              <option value="">Todos</option>
              <option value="ATIVO">Ativos</option>
              <option value="INATIVO">Inativos</option>
            </select>
          </div>
          {isAdmin && (
            <button
              onClick={() => navigate('/gestao-ti/equipes/nova')}
              className="flex items-center gap-2 bg-capul-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-capul-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nova Equipe
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500">Carregando...</div>
        ) : equipes.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Nenhuma equipe cadastrada</p>
            {isAdmin && (
              <button
                onClick={() => navigate('/gestao-ti/equipes/nova')}
                className="mt-4 text-capul-600 text-sm font-medium hover:underline"
              >
                Criar primeira equipe
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-3">Equipe</th>
                  <th className="px-6 py-3">Sigla</th>
                  <th className="px-6 py-3">Membros</th>
                  <th className="px-6 py-3">Chamados Externos</th>
                  <th className="px-6 py-3">Status</th>
                  {isAdmin && <th className="px-6 py-3">Acoes</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {equipes.map((equipe) => (
                  <tr
                    key={equipe.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: equipe.cor || '#006838' }}
                        />
                        <button onClick={() => navigate(`/gestao-ti/equipes/${equipe.id}`)} className="font-medium text-capul-600 hover:underline text-left">{equipe.nome}</button>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{equipe.sigla}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {equipe.membros.length}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          equipe.aceitaChamadoExterno
                            ? 'bg-green-100 text-green-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {equipe.aceitaChamadoExterno ? 'Sim' : 'Nao'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          equipe.status === 'ATIVO'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {equipe.status}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => navigate(`/gestao-ti/equipes/${equipe.id}/editar`)}
                            className="flex items-center gap-1 text-xs text-capul-600 hover:underline"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Editar
                          </button>
                          <button
                            onClick={() => toggleStatus(equipe)}
                            className="text-xs text-capul-600 hover:underline"
                          >
                            {equipe.status === 'ATIVO' ? 'Inativar' : 'Ativar'}
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
