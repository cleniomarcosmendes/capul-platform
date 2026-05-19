import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { usuarioService } from '../../services/usuario.service';
import { departamentoService } from '../../services/departamento.service';
import { ArrowLeft, Save, Shield, KeyRound, Clock, AlertTriangle, Lock } from 'lucide-react';
import type { UsuarioDetalhe, ModuloSistema, FilialOption, Departamento, UsuarioCapability } from '../../types';
import { useConfirm } from '../../components/ConfirmDialog';
import { useAuth } from '../../contexts/AuthContext';

// Capability sensível (LGPD) — acesso a PII de sócios. Plano:
// docs/PLANO_FISCAL_CONSULTA_SOCIOS_LGPD_v1.md
const CAP_SOCIO = 'FISCAL_CONSULTA_SOCIOS';

interface PermissaoForm {
  moduloId: string;
  roleModuloId: string;
  habilitado: boolean;
}

// Roles do módulo Fiscal que recebem alertas por e-mail (digest de cruzamento,
// limite SEFAZ, circuit breaker). DestinatariosResolver pula usuário sem email
// silenciosamente — daí a obrigatoriedade contextual aqui.
const ROLES_FISCAIS_COM_EMAIL = ['GESTOR_FISCAL', 'ADMIN_TI'];
const MODULO_FISCAL_CODIGO = 'FISCAL';

export function UsuarioFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdicao = !!id;
  const { configuradorRole } = useAuth();
  const confirm = useConfirm();
  const isAdminConfig = configuradorRole === 'ADMIN';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');
  const [msg, setMsg] = useState('');
  // Capabilities (LGPD) — só gerenciável por ADMIN em usuário existente.
  const [caps, setCaps] = useState<UsuarioCapability[]>([]);
  const [capMotivo, setCapMotivo] = useState('');
  const [capBusy, setCapBusy] = useState(false);

  const [username, setUsername] = useState('');
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cargo, setCargo] = useState('');
  const [tipo, setTipo] = useState<'INDIVIDUAL' | 'PADRAO'>('INDIVIDUAL');
  const [filialPrincipalId, setFilialPrincipalId] = useState('');
  const [departamentoId, setDepartamentoId] = useState('');
  const [filialIds, setFilialIds] = useState<string[]>([]);

  const [filiais, setFiliais] = useState<FilialOption[]>([]);
  const [filialSearch, setFilialSearch] = useState('');
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [modulos, setModulos] = useState<ModuloSistema[]>([]);
  const [permissoes, setPermissoes] = useState<PermissaoForm[]>([]);
  const [permissoesOriginais, setPermissoesOriginais] = useState<{ moduloId: string; roleModuloId: string }[]>([]);
  const [showResetSenha, setShowResetSenha] = useState(false);
  const [novaSenha, setNovaSenha] = useState('');
  const [resetMsg, setResetMsg] = useState('');

  // Timeout de inatividade — preferência por usuário (default 60min se não configurado)
  type TimeoutPref = 30 | 60 | 120 | 240 | 'never';
  const [inactivityTimeout, setInactivityTimeout] = useState<TimeoutPref>(60);
  const [inactivityTimeoutOriginal, setInactivityTimeoutOriginal] = useState<TimeoutPref>(60);

  type TabId = 'dados' | 'acesso' | 'permissoes' | 'sessao';
  const [activeTab, setActiveTab] = useState<TabId>('dados');
  const [tabErrors, setTabErrors] = useState<Set<TabId>>(new Set());

  useEffect(() => {
    carregarDados();
  }, [id, isEdicao]);

  useEffect(() => {
    if (filialPrincipalId) {
      departamentoService.listar(filialPrincipalId).then(setDepartamentos).catch(() => {});
    }
  }, [filialPrincipalId]);

  // Capabilities só fazem sentido em usuário existente e p/ ADMIN
  // (o backend já barra via guard; aqui evita 403 e UI vazia).
  useEffect(() => {
    if (isEdicao && isAdminConfig && id) carregarCaps(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdicao, isAdminConfig]);

  async function carregarCaps(uid: string) {
    try {
      setCaps(await usuarioService.listarCapabilities(uid));
    } catch {
      /* silencioso — seção some se não tiver acesso */
    }
  }

  async function concederCapSocio() {
    if (!id) return;
    if (capMotivo.trim().length < 5) {
      setErro('Informe o motivo da concessão (mín. 5 caracteres) — exigência LGPD.');
      return;
    }
    setCapBusy(true);
    setErro('');
    setMsg('');
    try {
      await usuarioService.concederCapability(id, CAP_SOCIO, capMotivo.trim());
      setCapMotivo('');
      await carregarCaps(id);
      setMsg('Acesso a dados de sócio concedido.');
    } catch (err) {
      setErro(extrairMensagemErro(err));
    } finally {
      setCapBusy(false);
    }
  }

  async function revogarCapSocio() {
    if (!id) return;
    const ok = await confirm({
      title: 'Revogar acesso a dados de sócio?',
      description:
        'O usuário deixará de acessar a Busca por Sócio e o QSA da Consulta Cadastral. A concessão fica registrada para auditoria (LGPD).',
      variant: 'danger',
      confirmLabel: 'Revogar',
    });
    if (!ok) return;
    setCapBusy(true);
    setErro('');
    setMsg('');
    try {
      await usuarioService.revogarCapability(id, CAP_SOCIO);
      await carregarCaps(id);
      setMsg('Acesso a dados de sócio revogado.');
    } catch (err) {
      setErro(extrairMensagemErro(err));
    } finally {
      setCapBusy(false);
    }
  }

  async function carregarDados() {
    try {
      const [filiaisData, modulosData] = await Promise.all([
        usuarioService.listarFiliais(),
        usuarioService.listarModulos(),
      ]);
      setFiliais(filiaisData);
      setModulos(modulosData);

      const permsVazias: PermissaoForm[] = modulosData.map((m) => ({
        moduloId: m.id,
        roleModuloId: m.rolesDisponiveis[0]?.id || '',
        habilitado: false,
      }));

      if (isEdicao) {
        const usuario: UsuarioDetalhe = await usuarioService.buscar(id!);
        setUsername(usuario.username);
        setNome(usuario.nome);
        setEmail(usuario.email || '');
        setTelefone(usuario.telefone || '');
        setCargo(usuario.cargo || '');
        setTipo(usuario.tipo || 'INDIVIDUAL');
        setFilialPrincipalId(usuario.filialPrincipal?.id || '');
        setDepartamentoId(usuario.departamento?.id || '');
        setFilialIds(usuario.filiais.map((f) => f.filial.id));

        const permsExistentes = usuario.permissoes
          .filter((p) => p.status === 'ATIVO')
          .map((p) => ({ moduloId: p.modulo.id, roleModuloId: p.roleModulo.id }));
        setPermissoesOriginais(permsExistentes);

        const permsComDados = permsVazias.map((pv) => {
          const existente = permsExistentes.find((pe) => pe.moduloId === pv.moduloId);
          return existente ? { ...pv, roleModuloId: existente.roleModuloId, habilitado: true } : pv;
        });
        setPermissoes(permsComDados);

        try {
          const prefs = await usuarioService.getPreferencias(id!);
          const raw = prefs?.inactivityTimeoutMin;
          const valor: TimeoutPref =
            raw === 'never' || raw === 30 || raw === 60 || raw === 120 || raw === 240
              ? raw
              : 60;
          setInactivityTimeout(valor);
          setInactivityTimeoutOriginal(valor);
        } catch {
          // fallback silencioso pro default
        }
      } else {
        setPermissoes(permsVazias);
      }
    } catch {
      setErro('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }

  function toggleFilial(fId: string) {
    setFilialIds((prev) => prev.includes(fId) ? prev.filter((f) => f !== fId) : [...prev, fId]);
  }

  function togglePermissao(moduloId: string) {
    setPermissoes((prev) => prev.map((p) => p.moduloId === moduloId ? { ...p, habilitado: !p.habilitado } : p));
  }

  function setPermissaoRole(moduloId: string, roleModuloId: string) {
    setPermissoes((prev) => prev.map((p) => p.moduloId === moduloId ? { ...p, roleModuloId } : p));
  }

  // True quando a combinação atual de permissões inclui uma role fiscal que
  // recebe alertas — usado para forçar email e mostrar feedback visual.
  function exigeEmailFiscal(): { exige: boolean; roleNome: string | null } {
    const moduloFiscal = modulos.find((m) => m.codigo === MODULO_FISCAL_CODIGO);
    if (!moduloFiscal) return { exige: false, roleNome: null };
    const perm = permissoes.find((p) => p.moduloId === moduloFiscal.id && p.habilitado);
    if (!perm) return { exige: false, roleNome: null };
    const role = moduloFiscal.rolesDisponiveis.find((r) => r.id === perm.roleModuloId);
    if (!role || !ROLES_FISCAIS_COM_EMAIL.includes(role.codigo)) {
      return { exige: false, roleNome: null };
    }
    return { exige: true, roleNome: role.nome };
  }

  const emailFiscalCheck = exigeEmailFiscal();
  const emailObrigatorio = emailFiscalCheck.exige;

  // Valida campos obrigatórios e mapeia cada falha pra sua aba. Como as abas
  // escondem campos, não dá pra confiar no `required` nativo do HTML (input
  // oculto não é "focusable" e o browser bloqueia o submit silenciosamente —
  // por isso o <form> usa noValidate e a validação é 100% aqui).
  function validar(): { abas: Set<TabId>; mensagem: string } {
    const abas = new Set<TabId>();
    let mensagem = '';

    if (!username.trim() || !nome.trim() || (!isEdicao && !senha.trim())) {
      abas.add('dados');
      mensagem = 'Preencha os campos obrigatórios em Dados Básicos.';
    }

    const fiscalCheck = exigeEmailFiscal();
    if (fiscalCheck.exige && !email.trim()) {
      abas.add('dados');
      mensagem = `E-mail é obrigatório para a role "${fiscalCheck.roleNome}" no módulo Fiscal — esses usuários recebem alertas críticos (limite SEFAZ, circuit breaker, digest de cruzamento).`;
    }

    if (!departamentoId) {
      abas.add('acesso');
      if (!mensagem) mensagem = 'Selecione o Departamento na aba Acesso.';
    }

    return { abas, mensagem };
  }

  const ORDEM_TABS: TabId[] = ['dados', 'acesso', 'permissoes', 'sessao'];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setMsg('');

    const { abas, mensagem } = validar();
    if (abas.size > 0) {
      setTabErrors(abas);
      const primeira = ORDEM_TABS.find((t) => abas.has(t));
      if (primeira) setActiveTab(primeira);
      setErro(mensagem);
      return;
    }
    setTabErrors(new Set());
    setSaving(true);

    try {
      const permsHabilitadas = permissoes.filter((p) => p.habilitado && p.roleModuloId);

      if (isEdicao) {
        await usuarioService.atualizar(id!, {
          username: username || undefined,
          nome: nome || undefined,
          email: email || undefined,
          telefone: telefone || undefined,
          cargo: cargo || undefined,
          tipo,
          filialPrincipalId: filialPrincipalId || undefined,
          departamentoId: departamentoId || undefined,
          filialIds,
        });

        for (const perm of permsHabilitadas) {
          const original = permissoesOriginais.find((po) => po.moduloId === perm.moduloId);
          if (!original || original.roleModuloId !== perm.roleModuloId) {
            await usuarioService.atribuirPermissao(id!, { moduloId: perm.moduloId, roleModuloId: perm.roleModuloId });
          }
        }

        for (const original of permissoesOriginais) {
          const aindaHabilitada = permsHabilitadas.find((p) => p.moduloId === original.moduloId);
          if (!aindaHabilitada) {
            await usuarioService.revogarPermissao(id!, original.moduloId);
          }
        }

        if (inactivityTimeout !== inactivityTimeoutOriginal) {
          await usuarioService.atualizarPreferencias(id!, { inactivityTimeoutMin: inactivityTimeout });
          setInactivityTimeoutOriginal(inactivityTimeout);
        }

        setMsg('Usuario atualizado com sucesso!');
      } else {
        await usuarioService.criar({
          username,
          nome,
          senha,
          email: email || undefined,
          telefone: telefone || undefined,
          cargo: cargo || undefined,
          tipo,
          filialPrincipalId: filialPrincipalId || undefined,
          departamentoId,
          filialIds: filialIds.length > 0 ? filialIds : undefined,
          permissoes: permsHabilitadas.map((p) => ({ moduloId: p.moduloId, roleModuloId: p.roleModuloId })),
        });
        navigate('/configurador/usuarios');
      }
    } catch (err: any) {
      setErro(extrairMensagemErro(err));
    } finally {
      setSaving(false);
    }
  }

  const inputClass = 'w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent';

  if (loading) {
    return (
      <>
        <Header title={isEdicao ? 'Editar Usuario' : 'Novo Usuario'} />
        <div className="p-6"><p className="text-slate-500">Carregando...</p></div>
      </>
    );
  }

  return (
    <>
      <Header title={isEdicao ? 'Editar Usuario' : 'Novo Usuario'} />
      <div className="p-6 max-w-6xl">
        {/* Barra topo: voltar à esquerda, ações à direita (Salvar salva todas as abas) */}
        <div className="flex items-center justify-between mb-5">
          <button onClick={() => navigate('/configurador/usuarios')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
            <ArrowLeft className="w-4 h-4" />
            Voltar para lista
          </button>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => navigate('/configurador/usuarios')} className="px-5 py-2 text-sm text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-all">
              Cancelar
            </button>
            <button type="submit" form="usuario-form" disabled={saving} className="flex items-center gap-2 bg-emerald-600 text-white font-medium py-2 px-5 rounded-lg text-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
              <Save className="w-4 h-4" />
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>

        {/* Nav de abas — escala com novas seções sem virar "linguiça" */}
        <nav className="flex gap-1 border-b border-slate-200 mb-6">
          {([
            { id: 'dados' as TabId, label: 'Dados' },
            { id: 'acesso' as TabId, label: 'Acesso' },
            { id: 'permissoes' as TabId, label: 'Permissões' },
            ...(isEdicao ? [{ id: 'sessao' as TabId, label: 'Sessão & Segurança' }] : []),
          ]).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`relative px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === t.id
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.label}
              {tabErrors.has(t.id) && (
                <span className="absolute top-1.5 -right-0.5 w-2 h-2 rounded-full bg-red-500" />
              )}
            </button>
          ))}
        </nav>

        <form id="usuario-form" onSubmit={handleSubmit} noValidate className="space-y-6">
          {/* === ABA: DADOS === */}
          {activeTab === 'dados' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="font-semibold text-slate-800 mb-4">Dados Basicos</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Username *</label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo *</label>
                <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} required className={inputClass} />
              </div>
              {!isEdicao && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Senha *</label>
                  <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={8} className={inputClass} />
                  <p className="text-xs text-slate-400 mt-1">Min. 8 caracteres, 1 maiuscula, 1 minuscula, 1 numero</p>
                </div>
              )}
              {isEdicao && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
                  {!showResetSenha ? (
                    <button
                      type="button"
                      onClick={() => { setShowResetSenha(true); setNovaSenha(''); setResetMsg(''); }}
                      className="flex items-center gap-2 text-sm text-amber-600 hover:text-amber-700 border border-amber-300 px-3 py-2 rounded-lg hover:bg-amber-50"
                    >
                      <KeyRound className="w-4 h-4" />
                      Resetar Senha
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="password"
                        value={novaSenha}
                        onChange={(e) => setNovaSenha(e.target.value)}
                        placeholder="Nova senha (min. 8 caracteres)"
                        minLength={8}
                        className={inputClass}
                      />
                      <p className="text-xs text-slate-400">Min. 8 caracteres, 1 maiuscula, 1 minuscula, 1 numero</p>
                      {resetMsg && <p className={`text-xs ${resetMsg.includes('sucesso') ? 'text-green-600' : 'text-red-600'}`}>{resetMsg}</p>}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!novaSenha || novaSenha.length < 8) { setResetMsg('Senha deve ter no minimo 8 caracteres'); return; }
                            if (!/(?=.*[a-z])/.test(novaSenha)) { setResetMsg('Senha deve conter letra minuscula'); return; }
                            if (!/(?=.*[A-Z])/.test(novaSenha)) { setResetMsg('Senha deve conter letra maiuscula'); return; }
                            if (!/(?=.*\d)/.test(novaSenha)) { setResetMsg('Senha deve conter numero'); return; }
                            try {
                              const res = await usuarioService.resetarSenha(id!, novaSenha);
                              setResetMsg(res.message);
                              setNovaSenha('');
                              setTimeout(() => setShowResetSenha(false), 2000);
                            } catch {
                              setResetMsg('Erro ao resetar senha');
                            }
                          }}
                          className="flex items-center gap-1 bg-amber-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-amber-700"
                        >
                          <KeyRound className="w-3.5 h-3.5" /> Confirmar
                        </button>
                        <button type="button" onClick={() => setShowResetSenha(false)} className="text-sm text-slate-500 hover:text-slate-700">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email{emailObrigatorio && <span className="text-red-600"> *</span>}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required={emailObrigatorio}
                  className={inputClass}
                />
                {emailObrigatorio && (
                  <p className="text-xs text-amber-600 mt-1">
                    Obrigatório para a role "{emailFiscalCheck.roleNome}" no Fiscal — usado para alertas (limite SEFAZ, circuit breaker, digest de cruzamento).
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
                <input type="text" value={telefone} onChange={(e) => setTelefone(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cargo</label>
                <input type="text" value={cargo} onChange={(e) => setCargo(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Usuario</label>
                <select value={tipo} onChange={(e) => setTipo(e.target.value as 'INDIVIDUAL' | 'PADRAO')} className={inputClass}>
                  <option value="INDIVIDUAL">Individual</option>
                  <option value="PADRAO">Padrao (Compartilhado)</option>
                </select>
                {tipo === 'PADRAO' && (
                  <p className="text-xs text-amber-600 mt-1">Usuario compartilhado — ao abrir chamado, sera solicitada a matricula do colaborador</p>
                )}
              </div>
            </div>
          </div>

          )}

          {/* === ABA: ACESSO === */}
          {activeTab === 'acesso' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="font-semibold text-slate-800 mb-4">Filial & Departamento</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Filial Principal</label>
                  <select value={filialPrincipalId} onChange={(e) => setFilialPrincipalId(e.target.value)} className={inputClass}>
                    <option value="">Selecione...</option>
                    {filiais.map((f) => (
                      <option key={f.id} value={f.id}>{f.codigo} - {f.nomeFantasia}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Departamento *</label>
                  <select value={departamentoId} onChange={(e) => setDepartamentoId(e.target.value)} required className={inputClass}>
                    <option value="">Selecione...</option>
                    {departamentos.map((d) => (
                      <option key={d.id} value={d.id}>{d.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              {filiais.length > 0 && (() => {
                const termo = filialSearch.trim().toLowerCase();
                const filtradas = termo
                  ? filiais.filter((f) =>
                      `${f.codigo} ${f.nomeFantasia}`.toLowerCase().includes(termo),
                    )
                  : filiais;
                return (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-slate-700">
                        Filiais de Acesso
                        <span className="ml-2 text-xs font-normal text-slate-400">
                          {filialIds.length} de {filiais.length} selecionadas
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          if (filialIds.length === filiais.length) {
                            setFilialIds([]);
                          } else {
                            setFilialIds(filiais.map((f) => f.id));
                          }
                        }}
                        className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                      >
                        {filialIds.length === filiais.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
                      </button>
                    </div>
                    <input
                      type="text"
                      value={filialSearch}
                      onChange={(e) => setFilialSearch(e.target.value)}
                      placeholder="Buscar filial por código ou nome..."
                      className="w-full mb-2 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent"
                    />
                    <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-lg p-1 grid grid-cols-1 sm:grid-cols-2 gap-x-2">
                      {filtradas.map((f) => (
                        <label key={f.id} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                          <input type="checkbox" checked={filialIds.includes(f.id)} onChange={() => toggleFilial(f.id)} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 flex-shrink-0" />
                          <span className="text-sm text-slate-700 truncate">{f.codigo} - {f.nomeFantasia}</span>
                        </label>
                      ))}
                      {filtradas.length === 0 && (
                        <p className="col-span-full text-sm text-slate-400 px-3 py-4 text-center">
                          Nenhuma filial encontrada para "{filialSearch}"
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
          )}

          {/* === ABA: PERMISSÕES === (linhas compactas + scroll: escala com
              N módulos sem virar "linguiça" — queixa 15/05) */}
          {activeTab === 'permissoes' && (
          <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-600" />
                Permissões de Módulos
              </h2>
              <span className="text-xs text-slate-400">
                {permissoes.filter((p) => p.habilitado).length} de {modulos.length} ativos
              </span>
            </div>
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-[28rem] overflow-y-auto">
              {modulos.map((modulo) => {
                const perm = permissoes.find((p) => p.moduloId === modulo.id);
                if (!perm) return null;
                const descricao = perm.habilitado
                  ? modulo.rolesDisponiveis.find((r) => r.id === perm.roleModuloId)?.descricao || ''
                  : '';
                return (
                  <div
                    key={modulo.id}
                    className={`px-3 py-2.5 transition-colors ${perm.habilitado ? 'bg-emerald-50/50' : 'hover:bg-slate-50'}`}
                  >
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                        <input type="checkbox" checked={perm.habilitado} onChange={() => togglePermissao(modulo.id)} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 flex-shrink-0" />
                        <span className="text-sm font-medium text-slate-800 truncate">{modulo.nome}</span>
                        <span className="text-[11px] text-slate-400 flex-shrink-0">{modulo.codigo}</span>
                      </label>
                      {perm.habilitado && modulo.rolesDisponiveis.length > 0 && (
                        <select value={perm.roleModuloId} onChange={(e) => setPermissaoRole(modulo.id, e.target.value)} className="px-2 py-1 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent flex-shrink-0 max-w-[10rem]">
                          {modulo.rolesDisponiveis.map((role) => (
                            <option key={role.id} value={role.id}>{role.nome}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    {descricao && (
                      <p className="text-[11px] text-slate-400 mt-1 ml-6 leading-snug">{descricao}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Capability sensível (LGPD) — só ADMIN, em usuário existente.
              Plano: docs/PLANO_FISCAL_CONSULTA_SOCIOS_LGPD_v1.md */}
          {isEdicao && isAdminConfig && (() => {
            const socioCap = caps.find((c) => c.capability === CAP_SOCIO);
            const ativo = !!socioCap?.ativo;
            return (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h2 className="font-semibold text-slate-800 flex items-center gap-2 mb-1">
                  <Lock className="w-5 h-5 text-rose-600" />
                  Dados sensíveis (LGPD)
                </h2>
                <p className="text-xs text-slate-500 mb-4">
                  Acesso a <strong>dados de sócios (PII)</strong> — tela "Busca por Sócio"
                  e o QSA da Consulta Cadastral. Concessão nominal, independente do papel,
                  com motivo registrado para auditoria.
                </p>
                <div className={`rounded-lg border p-4 ${ativo ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800">Consulta de Sócios</span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {ativo ? 'Concedida' : 'Sem acesso'}
                        </span>
                      </div>
                      {ativo && socioCap && (
                        <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                          Concedida em {new Date(socioCap.concedidoEm).toLocaleString('pt-BR')}
                          {socioCap.motivo ? ` · motivo: ${socioCap.motivo}` : ''}
                        </p>
                      )}
                    </div>
                    {ativo && (
                      <button
                        type="button"
                        onClick={revogarCapSocio}
                        disabled={capBusy}
                        className="px-3 py-1.5 text-xs font-medium rounded-md border border-rose-300 text-rose-700 hover:bg-rose-50 disabled:opacity-50 flex-shrink-0"
                      >
                        Revogar
                      </button>
                    )}
                  </div>
                  {!ativo && (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={capMotivo}
                        onChange={(e) => setCapMotivo(e.target.value)}
                        rows={2}
                        placeholder="Motivo da concessão (obrigatório — LGPD: necessidade de conhecer)"
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={concederCapSocio}
                        disabled={capBusy || capMotivo.trim().length < 5}
                        className="px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Conceder acesso
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
          </div>
          )}

          {/* === ABA: SESSÃO & SEGURANÇA === (só na edição) */}
          {activeTab === 'sessao' && isEdicao && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h2 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-600" />
                Sessão & Segurança
              </h2>
              <p className="text-xs text-slate-400 mb-4">
                Tempo sem interação antes de desconectar automaticamente. Aplica-se a
                todos os módulos (Gestão TI, Inventário, Fiscal).
              </p>
              <div className="max-w-sm">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Timeout de inatividade</label>
                <select
                  value={String(inactivityTimeout)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setInactivityTimeout(v === 'never' ? 'never' : (Number(v) as TimeoutPref));
                  }}
                  className={inputClass}
                >
                  <option value="30">30 minutos</option>
                  <option value="60">60 minutos (padrão)</option>
                  <option value="120">120 minutos (2 horas)</option>
                  <option value="240">240 minutos (4 horas)</option>
                  <option value="never">Manter sempre conectado</option>
                </select>
              </div>
              {inactivityTimeout === 'never' && (
                <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2.5 rounded-lg max-w-lg">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    A sessão deste usuário <strong>não expira por inatividade</strong>. Use apenas
                    em estações pessoais — em PCs compartilhados qualquer pessoa pode acessar o
                    sistema sem login. (O refresh token ainda expira em 7 dias.)
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Feedback */}
          {erro && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">{erro}</div>}
          {msg && <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg border border-green-200">{msg}</div>}
        </form>
      </div>
    </>
  );
}

/**
 * Extrai a mensagem mais útil possível de um erro axios. Ordem:
 *  1. Array de mensagens (validação class-validator) — pega todas, junta com ; para o operador
 *     ver as regras que falharam
 *  2. String direta (ConflictException, BadRequestException com mensagem única)
 *  3. Campo `error` se existir
 *  4. Erro de rede (sem response) — mensagem específica com código do axios
 *  5. HTTP status + texto genérico se tudo acima falhar
 *
 * A lógica anterior usava `message?.[0] || message || fallback`, que para strings caía na
 * primeira letra ("U" em "Username…"). Além disso não distinguia erro de rede de 500.
 */
function extrairMensagemErro(err: any): string {
  const msg = err?.response?.data?.message;
  if (Array.isArray(msg) && msg.length > 0) return msg.join('; ');
  if (typeof msg === 'string' && msg.length > 0) return msg;

  const errorField = err?.response?.data?.error;
  if (typeof errorField === 'string' && errorField.length > 0) return errorField;

  if (!err?.response) {
    return `Sem resposta do servidor (${err?.code || err?.message || 'erro de rede'}). Verifique a conexão ou tente novamente.`;
  }

  const status = err.response.status;
  if (status === 401) return 'Sessão expirada. Faça login novamente.';
  if (status === 403) return 'Você não tem permissão para esta operação.';
  if (status === 409) return 'Conflito: username ou email já existente.';
  if (status >= 500) return `Erro interno do servidor (HTTP ${status}). Cheque os logs do auth-gateway.`;
  return `Erro ao salvar (HTTP ${status}).`;
}
