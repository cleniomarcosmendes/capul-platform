import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Shield } from 'lucide-react';
import { usuarioService } from '../services/usuario.service';
import type {
  UsuarioDetalhe,
  ModuloSistema,
  FilialOption,
} from '../types';

interface PermissaoForm {
  moduloId: string;
  roleModuloId: string;
  habilitado: boolean;
}

export default function UsuarioFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdicao = !!id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');
  const [msg, setMsg] = useState('');

  // Dados do formulario
  const [username, setUsername] = useState('');
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cargo, setCargo] = useState('');
  const [filialPrincipalId, setFilialPrincipalId] = useState('');
  const [filialIds, setFilialIds] = useState<string[]>([]);

  // Opcoes carregadas
  const [filiais, setFiliais] = useState<FilialOption[]>([]);
  const [modulos, setModulos] = useState<ModuloSistema[]>([]);
  const [permissoes, setPermissoes] = useState<PermissaoForm[]>([]);

  // Estado original das permissoes (para diff na edicao)
  const [permissoesOriginais, setPermissoesOriginais] = useState<
    { moduloId: string; roleModuloId: string }[]
  >([]);

  useEffect(() => {
    async function carregarDados() {
      try {
        const [filiaisData, modulosData] = await Promise.all([
          usuarioService.listarFiliais(),
          usuarioService.listarModulos(),
        ]);
        setFiliais(filiaisData);
        setModulos(modulosData);

        // Inicializa permissoes vazias
        const permsVazias: PermissaoForm[] = modulosData.map((m) => ({
          moduloId: m.id,
          roleModuloId: m.rolesDisponiveis[0]?.id || '',
          habilitado: false,
        }));

        if (isEdicao) {
          const usuario: UsuarioDetalhe = await usuarioService.buscar(id);
          setUsername(usuario.username);
          setNome(usuario.nome);
          setEmail(usuario.email || '');
          setTelefone(usuario.telefone || '');
          setCargo(usuario.cargo || '');
          setFilialPrincipalId(usuario.filialPrincipal?.id || '');
          setFilialIds(usuario.filiais.map((f) => f.filial.id));

          // Mapeia permissoes existentes
          const permsExistentes = usuario.permissoes
            .filter((p) => p.status === 'ATIVO')
            .map((p) => ({
              moduloId: p.modulo.id,
              roleModuloId: p.roleModulo.id,
            }));
          setPermissoesOriginais(permsExistentes);

          const permsComDados = permsVazias.map((pv) => {
            const existente = permsExistentes.find(
              (pe) => pe.moduloId === pv.moduloId,
            );
            if (existente) {
              return {
                ...pv,
                roleModuloId: existente.roleModuloId,
                habilitado: true,
              };
            }
            return pv;
          });
          setPermissoes(permsComDados);
        } else {
          setPermissoes(permsVazias);
        }
      } catch {
        setErro('Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    }
    carregarDados();
  }, [id, isEdicao]);

  function toggleFilial(filialId: string) {
    setFilialIds((prev) =>
      prev.includes(filialId)
        ? prev.filter((f) => f !== filialId)
        : [...prev, filialId],
    );
  }

  function togglePermissao(moduloId: string) {
    setPermissoes((prev) =>
      prev.map((p) =>
        p.moduloId === moduloId ? { ...p, habilitado: !p.habilitado } : p,
      ),
    );
  }

  function setPermissaoRole(moduloId: string, roleModuloId: string) {
    setPermissoes((prev) =>
      prev.map((p) =>
        p.moduloId === moduloId ? { ...p, roleModuloId } : p,
      ),
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setMsg('');
    setSaving(true);

    try {
      const permsHabilitadas = permissoes.filter((p) => p.habilitado && p.roleModuloId);

      if (isEdicao) {
        // Atualizar dados basicos
        await usuarioService.atualizar(id, {
          username: username || undefined,
          nome: nome || undefined,
          email: email || undefined,
          telefone: telefone || undefined,
          cargo: cargo || undefined,
          filialPrincipalId: filialPrincipalId || undefined,
        });

        // Diff permissoes: adicionar novas / atualizar existentes
        for (const perm of permsHabilitadas) {
          const original = permissoesOriginais.find(
            (po) => po.moduloId === perm.moduloId,
          );
          // Adicionar se nao existia ou se role mudou
          if (!original || original.roleModuloId !== perm.roleModuloId) {
            await usuarioService.atribuirPermissao(id, {
              moduloId: perm.moduloId,
              roleModuloId: perm.roleModuloId,
            });
          }
        }

        // Revogar permissoes desmarcadas
        for (const original of permissoesOriginais) {
          const aindaHabilitada = permsHabilitadas.find(
            (p) => p.moduloId === original.moduloId,
          );
          if (!aindaHabilitada) {
            await usuarioService.revogarPermissao(id, original.moduloId);
          }
        }

        setMsg('Usuario atualizado com sucesso!');
      } else {
        // Criar novo
        await usuarioService.criar({
          username,
          nome,
          senha,
          email: email || undefined,
          telefone: telefone || undefined,
          cargo: cargo || undefined,
          filialPrincipalId: filialPrincipalId || undefined,
          filialIds: filialIds.length > 0 ? filialIds : undefined,
          permissoes: permsHabilitadas.map((p) => ({
            moduloId: p.moduloId,
            roleModuloId: p.roleModuloId,
          })),
        });
        navigate('/usuarios');
      }
    } catch (err: any) {
      setErro(
        err?.response?.data?.message?.[0] ||
          err?.response?.data?.message ||
          'Erro ao salvar usuario',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-capul-50">
        <header className="bg-white border-b border-slate-200 shadow-sm">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
            <button
              onClick={() => navigate('/usuarios')}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-all"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="font-semibold text-slate-800">
              {isEdicao ? 'Editar Usuario' : 'Novo Usuario'}
            </h1>
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-4 py-8">
          <p className="text-slate-500">Carregando...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-capul-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate('/usuarios')}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-all"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-semibold text-slate-800">
            {isEdicao ? 'Editar Usuario' : 'Novo Usuario'}
          </h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Secao 1: Dados Basicos */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="font-semibold text-slate-800 mb-4">
              Dados Basicos
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm
                    focus:outline-none focus:ring-2 focus:ring-capul-600 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm
                    focus:outline-none focus:ring-2 focus:ring-capul-600 focus:border-transparent"
                />
              </div>
              {!isEdicao && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Senha *
                  </label>
                  <input
                    type="password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm
                      focus:outline-none focus:ring-2 focus:ring-capul-600 focus:border-transparent"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm
                    focus:outline-none focus:ring-2 focus:ring-capul-600 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Telefone
                </label>
                <input
                  type="text"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm
                    focus:outline-none focus:ring-2 focus:ring-capul-600 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Cargo
                </label>
                <input
                  type="text"
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm
                    focus:outline-none focus:ring-2 focus:ring-capul-600 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Secao 2: Filial */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="font-semibold text-slate-800 mb-4">Filial</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Filial Principal
                </label>
                <select
                  value={filialPrincipalId}
                  onChange={(e) => setFilialPrincipalId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm
                    focus:outline-none focus:ring-2 focus:ring-capul-600 focus:border-transparent"
                >
                  <option value="">Selecione...</option>
                  {filiais.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.codigo} - {f.nomeFantasia}
                    </option>
                  ))}
                </select>
              </div>

              {!isEdicao && filiais.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Filiais de Acesso
                  </label>
                  <div className="space-y-2">
                    {filiais.map((f) => (
                      <label
                        key={f.id}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={filialIds.includes(f.id)}
                          onChange={() => toggleFilial(f.id)}
                          className="w-4 h-4 rounded border-slate-300 text-capul-600 focus:ring-capul-600"
                        />
                        <span className="text-sm text-slate-700">
                          {f.codigo} - {f.nomeFantasia}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {isEdicao && filialIds.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Filiais Vinculadas
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {filialIds.map((fId) => {
                      const f = filiais.find((fl) => fl.id === fId);
                      return f ? (
                        <span
                          key={fId}
                          className="inline-flex px-3 py-1 rounded-full text-xs bg-slate-100 text-slate-700"
                        >
                          {f.codigo} - {f.nomeFantasia}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Secao 3: Permissoes */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Shield size={18} className="text-capul-600" />
              Permissoes de Modulos
            </h2>
            <div className="space-y-3">
              {modulos.map((modulo) => {
                const perm = permissoes.find(
                  (p) => p.moduloId === modulo.id,
                );
                if (!perm) return null;

                return (
                  <div
                    key={modulo.id}
                    className={`border rounded-xl p-4 transition-all ${
                      perm.habilitado
                        ? 'border-capul-300 bg-capul-50/50'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-3 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={perm.habilitado}
                          onChange={() => togglePermissao(modulo.id)}
                          className="w-4 h-4 rounded border-slate-300 text-capul-600 focus:ring-capul-600"
                        />
                        <div>
                          <p className="text-sm font-medium text-slate-800">
                            {modulo.nome}
                          </p>
                          <p className="text-xs text-slate-400">
                            {modulo.codigo}
                          </p>
                        </div>
                      </label>
                      {perm.habilitado && modulo.rolesDisponiveis.length > 0 && (
                        <select
                          value={perm.roleModuloId}
                          onChange={(e) =>
                            setPermissaoRole(modulo.id, e.target.value)
                          }
                          className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm
                            focus:outline-none focus:ring-2 focus:ring-capul-600 focus:border-transparent"
                        >
                          {modulo.rolesDisponiveis.map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.nome}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    {perm.habilitado && modulo.rolesDisponiveis.length > 0 && (
                      <p className="text-xs text-slate-400 mt-2 ml-7">
                        {modulo.rolesDisponiveis.find(
                          (r) => r.id === perm.roleModuloId,
                        )?.descricao || ''}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Feedback */}
          {erro && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
              {erro}
            </div>
          )}
          {msg && (
            <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg border border-green-200">
              {msg}
            </div>
          )}

          {/* Botoes */}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-capul-600 text-white font-medium py-2.5 px-6 rounded-lg text-sm
                hover:bg-capul-700 focus:outline-none focus:ring-2 focus:ring-capul-600 focus:ring-offset-2
                disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Save size={16} />
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/usuarios')}
              className="px-6 py-2.5 text-sm text-slate-600 hover:text-slate-800
                rounded-lg hover:bg-slate-100 transition-all"
            >
              Cancelar
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
