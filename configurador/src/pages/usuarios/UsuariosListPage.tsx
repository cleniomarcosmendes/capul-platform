import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { usuarioService } from '../../services/usuario.service';
import { filialService } from '../../services/filial.service';
import { Plus, Pencil, UserCheck, UserX, Search } from 'lucide-react';
import type { UsuarioListItem, FilialOption } from '../../types';

export function UsuariosListPage() {
  const navigate = useNavigate();
  const { configuradorRole } = useAuth();
  const canEdit = configuradorRole === 'ADMIN' || configuradorRole === 'GESTOR';

  const [usuarios, setUsuarios] = useState<UsuarioListItem[]>([]);
  const [filiais, setFiliais] = useState<FilialOption[]>([]);
  const [filialId, setFilialId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    filialService.listar().then(setFiliais);
  }, []);

  useEffect(() => {
    carregar();
  }, [filialId]);

  async function carregar() {
    setLoading(true);
    try {
      const data = await usuarioService.listar(filialId || undefined);
      setUsuarios(data);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleStatus(user: UsuarioListItem) {
    const novoStatus = user.status === 'ATIVO' ? 'INATIVO' : 'ATIVO';
    setToggling(user.id);
    try {
      await usuarioService.atualizarStatus(user.id, novoStatus);
      setUsuarios((prev) => prev.map((u) => u.id === user.id ? { ...u, status: novoStatus } : u));
    } catch {
      // silencioso
    } finally {
      setToggling(null);
    }
  }

  const filtrados = usuarios.filter((u) => {
    const termo = busca.toLowerCase();
    return (
      u.nome.toLowerCase().includes(termo) ||
      u.username.toLowerCase().includes(termo) ||
      (u.email && u.email.toLowerCase().includes(termo))
    );
  });

  return (
    <>
      <Header title="Usuarios" />
      <div className="p-6">
        {/* Filtros */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar por nome, username ou email..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm w-80 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent"
              />
            </div>
            <select
              value={filialId}
              onChange={(e) => setFilialId(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <option value="">Todas as filiais</option>
              {filiais.map((f) => (
                <option key={f.id} value={f.id}>{f.codigo} - {f.nomeFantasia}</option>
              ))}
            </select>
          </div>
          {canEdit && (
            <button
              onClick={() => navigate('/configurador/usuarios/novo')}
              className="flex items-center gap-2 bg-emerald-600 text-white font-medium py-2.5 px-4 rounded-lg text-sm hover:bg-emerald-700 transition-all"
            >
              <Plus className="w-4 h-4" />
              Novo Usuario
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500">Carregando...</div>
        ) : filtrados.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
            <p className="text-slate-400">{busca ? 'Nenhum usuario encontrado' : 'Nenhum usuario cadastrado'}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Usuario</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Cargo</th>
                    <th className="text-center px-4 py-3 font-medium text-slate-600">Tipo</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Filial</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Modulos</th>
                    <th className="text-center px-4 py-3 font-medium text-slate-600">Status</th>
                    {canEdit && <th className="text-right px-4 py-3 font-medium text-slate-600">Acoes</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtrados.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{user.nome}</p>
                        <p className="text-xs text-slate-400">@{user.username}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{user.email || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{user.cargo || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        {user.tipo === 'PADRAO' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">Padrao</span>
                        ) : (
                          <span className="text-xs text-slate-400">Individual</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {user.filialPrincipal ? `${user.filialPrincipal.codigo} - ${user.filialPrincipal.nomeFantasia}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {user.permissoes.length === 0 ? (
                            <span className="text-xs text-slate-400">Nenhum</span>
                          ) : (
                            user.permissoes.map((p) => (
                              <span key={p.modulo.codigo} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700">
                                {p.modulo.nome}
                                <span className="ml-1 text-emerald-500">({p.roleModulo.nome})</span>
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${user.status === 'ATIVO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {user.status}
                        </span>
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => navigate(`/configurador/usuarios/${user.id}`)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-emerald-600 transition-all" title="Editar">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleStatus(user)}
                              disabled={toggling === user.id}
                              className={`p-1.5 rounded-lg transition-all disabled:opacity-50 ${user.status === 'ATIVO' ? 'hover:bg-red-50 text-slate-500 hover:text-red-600' : 'hover:bg-green-50 text-slate-500 hover:text-green-600'}`}
                              title={user.status === 'ATIVO' ? 'Inativar' : 'Ativar'}
                            >
                              {user.status === 'ATIVO' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
