import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { chamadoService } from '../../services/chamado.service';
import { protheusService } from '../../services/protheus.service';
import { equipeService } from '../../services/equipe.service';
import { catalogoService } from '../../services/catalogo.service';
import { softwareService } from '../../services/software.service';
import { projetoService } from '../../services/projeto.service';
import { paradaService } from '../../services/parada.service';
import { ordemServicoService } from '../../services/ordem-servico.service';
import { ativoService } from '../../services/ativo.service';
import { coreService } from '../../services/core.service';
import { ArrowLeft, FolderKanban, Paperclip, X, CheckCircle, Users2 } from 'lucide-react';
import type { Equipe, CatalogoServico, Visibilidade, Prioridade, Software, SoftwareModulo, Projeto, Departamento, Ativo, UsuarioCore } from '../../types';
import { isWorkspaceModulo } from '../../lib/workspace-modulo';

const ROLES_TI_SET = new Set(['ADMIN', 'GESTOR', 'SUPORTE']);
function isUsuarioTI(u: UsuarioCore): boolean {
  return (u.permissoes ?? []).some((p) => isWorkspaceModulo(p.modulo.codigo) && ROLES_TI_SET.has(p.roleModulo.codigo));
}

export function ChamadoCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projetoIdParam = searchParams.get('projetoId');
  const paradaIdParam = searchParams.get('paradaId');
  const osIdParam = searchParams.get('osId');
  const duplicarDeParam = searchParams.get('duplicarDe');
  const { usuario, gestaoTiRole } = useAuth();
  const isUsuarioFinal = gestaoTiRole === 'USUARIO_FINAL';
  // Visibilidade PRIVADO restrita à equipe de TI (ADMIN/GESTOR_TI/SUPORTE_TI —
  // espelha ROLES_TI do backend em common/constants/roles.constant.ts).
  // Demais roles (USUARIO_FINAL, DESENVOLVEDOR, MANUTENCAO, INFRAESTRUTURA,
  // USUARIO_CHAVE, TERCEIRIZADO) sempre criam chamado PUBLICO — solicitante
  // tem direito de acompanhar resoluções.
  const podeEscolherVisibilidade = ['ADMIN', 'GESTOR', 'SUPORTE'].includes(gestaoTiRole ?? '');
  const [projetoVinculado, setProjetoVinculado] = useState<Projeto | null>(null);

  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [catalogos, setCatalogos] = useState<CatalogoServico[]>([]);
  const [softwaresList, setSoftwaresList] = useState<Software[]>([]);
  const [modulosList, setModulosList] = useState<SoftwareModulo[]>([]);
  const [filiais, setFiliais] = useState<{ id: string; codigo: string; nomeFantasia: string }[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [equipeAtualId, setEquipeAtualId] = useState('');
  // C2.7 UX 24/05 — select encadeado: user escolhe primeiro o depto destino
  // (workspace que vai resolver), depois a equipe daquele depto. Filtra
  // client-side a partir de `equipes` (já vem com `departamento` do backend).
  const [deptoDestinoId, setDeptoDestinoId] = useState('');
  const [visibilidade, setVisibilidade] = useState<Visibilidade>('PUBLICO');
  const [prioridade, setPrioridade] = useState<Prioridade>('MEDIA');
  const [softwareId, setSoftwareId] = useState('');
  const [softwareModuloId, setSoftwareModuloId] = useState('');
  const [softwareNome, setSoftwareNome] = useState('');
  const [moduloNome, setModuloNome] = useState('');
  const [catalogoServicoId, setCatalogoServicoId] = useState('');

  // Filial/Departamento para tecnicos
  const [filialId, setFilialId] = useState('');
  const [departamentoId, setDepartamentoId] = useState('');

  // Ativo vinculado
  const [ativosList, setAtivosList] = useState<Ativo[]>([]);
  const [ativoId, setAtivoId] = useState('');

  // IP da maquina
  const [ipMaquina, setIpMaquina] = useState('');

  // Usuario padrao — identificacao por matricula + senha (portal RH).
  // A conta logada e generica; a senha prova quem esta abrindo o chamado.
  const isUsuarioPadrao = usuario?.tipo === 'PADRAO';
  const [matriculaColaborador, setMatriculaColaborador] = useState('');
  const [senhaColaborador, setSenhaColaborador] = useState('');
  const [nomeColaborador, setNomeColaborador] = useState('');
  const [buscandoNome, setBuscandoNome] = useState(false); // lookup do nome pela matricula
  const [validando, setValidando] = useState(false);
  const [credOk, setCredOk] = useState(false); // loginPortal confirmou matricula+senha
  const [protheusForaFallback, setProtheusForaFallback] = useState(false); // Protheus fora -> libera prosseguir
  const [nomeEditavel, setNomeEditavel] = useState(false);

  const [dirty, setDirty] = useState(false);
  const { ConfirmDialog, guardedNavigate } = useUnsavedChanges(dirty);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successRedirectUrl, setSuccessRedirectUrl] = useState('');

  const [erroValidacao, setErroValidacao] = useState(''); // senha/matricula invalida
  const [mensagemFallback, setMensagemFallback] = useState('');
  const nomeColaboradorRef = useRef<HTMLInputElement>(null);

  // So a SENHA mudou: invalida a validacao anterior (mantem o nome ja resolvido
  // pela matricula). Forca revalidar a senha antes de enviar.
  function resetValidacaoSenha() {
    setCredOk(false);
    setProtheusForaFallback(false);
    setErroValidacao('');
  }

  // A MATRICULA mudou: reseta tudo (nome + senha) — e outra pessoa.
  function resetMatricula() {
    resetValidacaoSenha();
    setNomeColaborador('');
    setNomeEditavel(false);
    setMensagemFallback('');
  }

  // Usuario PADRAO so pode enviar apos validar a SENHA (ou apos o fallback de
  // Protheus fora). credOk = senha conferida; protheusForaFallback = nao deu
  // pra validar agora mas liberamos prosseguir (backend revalida).
  const padraoLiberado = !isUsuarioPadrao || credOk || protheusForaFallback;

  // Quando o input do nome libera (Protheus offline ou matrícula inválida),
  // foca automaticamente — é o "posicionar para o usuário" pedido em UX.
  useEffect(() => {
    if (nomeEditavel && nomeColaboradorRef.current) {
      nomeColaboradorRef.current.focus();
    }
  }, [nomeEditavel]);

  // Passo 1 (nome-primeiro): ao sair da matricula, busca o NOME no portal RH
  // (infoPortal). O usuario confere que é ele ANTES de digitar a senha.
  // Nao encontrado / Protheus fora → libera digitar o nome manualmente.
  async function buscarNome() {
    const mat = matriculaColaborador.trim();
    if (!mat) return;
    setBuscandoNome(true);
    setNomeColaborador('');
    setNomeEditavel(false);
    setMensagemFallback('');
    try {
      const r = await protheusService.buscarColaborador(mat);
      if (r.encontrado && r.nome) {
        setNomeColaborador(r.nome);
      } else {
        setNomeEditavel(true);
        setMensagemFallback('Matricula nao encontrada no portal RH. Confira o numero ou digite o nome.');
      }
    } finally {
      setBuscandoNome(false);
    }
  }

  // Passo 2: valida a SENHA da matricula no portal RH (loginPortal). O nome ja
  // foi resolvido no passo 1 — aqui so confirmamos a identidade pela senha.
  async function validarColaborador() {
    const mat = matriculaColaborador.trim();
    const sen = senhaColaborador;
    if (!mat || !sen) return;
    setValidando(true);
    setCredOk(false);
    setProtheusForaFallback(false);
    setErroValidacao('');
    try {
      const r = await protheusService.validarColaborador(mat, sen);
      if (r.valida) {
        setCredOk(true);
        // Garante o nome caso o passo 1 nao tenha trazido (ex.: pulou o blur).
        if (r.nome && !nomeColaborador) setNomeColaborador(r.nome);
      } else if (r.motivo === 'CREDENCIAIS_INVALIDAS') {
        setErroValidacao('Senha invalida para esta matricula.');
      } else {
        // INDISPONIVEL — Protheus fora: nao trava o atendimento.
        setProtheusForaFallback(true);
        if (!nomeColaborador) setNomeEditavel(true);
        setMensagemFallback('Protheus indisponivel no momento — nao foi possivel validar a senha. Voce pode prosseguir; o T.I. confirmara a identidade.');
      }
    } finally {
      setValidando(false);
    }
  }


  // Em copia (usuarios nao-TI que recebem notificacoes e podem comentar)
  const [usuariosNaoTI, setUsuariosNaoTI] = useState<UsuarioCore[]>([]);
  const [copiasIds, setCopiasIds] = useState<string[]>([]);
  const [copiaBusca, setCopiaBusca] = useState('');
  const [copiaDropdownOpen, setCopiaDropdownOpen] = useState(false);

  // Anexos
  const [arquivos, setArquivos] = useState<File[]>([]);

  useEffect(() => {
    // Visibilidade pública/privada é resolvida no servidor (GET /equipes/abertura):
    // equipe privada só vem pra staff do próprio depto. Sem filtro client-side.
    equipeService.listarSelecionaveis('ATIVO').then(setEquipes).catch(() => {});
    softwareService.listar({ status: 'ATIVO' }).then(setSoftwaresList).catch(() => {});
    if (projetoIdParam) {
      projetoService.buscar(projetoIdParam).then(setProjetoVinculado).catch(() => {});
    }
    // Carregar filiais e ativos para tecnicos
    if (!isUsuarioFinal) {
      const isStaff = gestaoTiRole && ['ADMIN', 'GESTOR'].includes(gestaoTiRole);
      if (isStaff) {
        coreService.listarFiliais().then(setFiliais).catch(() => {});
      } else if (usuario?.filiais?.length) {
        setFiliais(usuario.filiais.map((f) => ({ id: f.id, codigo: f.codigo, nomeFantasia: f.nome })));
      }
      ativoService.listar({ status: 'ATIVO' }).then(setAtivosList).catch(() => {});
    }
  }, [isUsuarioFinal]);

  // Pre-preencher filial/depto do usuario logado
  useEffect(() => {
    if (!isUsuarioFinal && usuario) {
      setFilialId(usuario.filialAtual?.id || '');
      setDepartamentoId(usuario.departamento.id);
    }
  }, [isUsuarioFinal, usuario]);

  // Duplicar chamado: carregar dados do chamado original
  useEffect(() => {
    if (!duplicarDeParam) return;
    chamadoService.buscar(duplicarDeParam).then((c) => {
      setTitulo(c.titulo);
      setDescricao(c.descricao || '');
      setEquipeAtualId(c.equipeAtualId);
      // Pré-popula depto destino quando edita/duplica chamado existente
      setDeptoDestinoId(c.departamento?.id ?? '');
      setPrioridade(c.prioridade as Prioridade);
      setVisibilidade(c.visibilidade as Visibilidade);
      if (c.softwareId) setSoftwareId(c.softwareId);
      if (c.softwareModuloId) setSoftwareModuloId(c.softwareModuloId);
      if (c.softwareNome) setSoftwareNome(c.softwareNome);
      if (c.moduloNome) setModuloNome(c.moduloNome);
      if (c.catalogoServicoId) setCatalogoServicoId(c.catalogoServicoId);
      if (c.ativoId) setAtivoId(c.ativoId);
      if (c.ipMaquina) setIpMaquina(c.ipMaquina);
    }).catch(() => {});
  }, [duplicarDeParam]);

  // Recarregar departamentos quando filial muda
  useEffect(() => {
    if (!isUsuarioFinal && filialId) {
      coreService.listarDepartamentos(filialId).then(setDepartamentos).catch(() => setDepartamentos([]));
    }
  }, [isUsuarioFinal, filialId]);

  // Carregar usuarios elegiveis a serem postos em copia (filtra TI fora)
  useEffect(() => {
    coreService.listarUsuarios().then((users) => {
      setUsuariosNaoTI(users.filter((u) => u.id !== usuario?.id && !isUsuarioTI(u)));
    }).catch(() => setUsuariosNaoTI([]));
  }, [usuario?.id]);

  useEffect(() => {
    if (softwareId) {
      softwareService.listarModulos(softwareId).then((mods) => {
        setModulosList(mods.filter((m) => m.status === 'ATIVO'));
      }).catch(() => setModulosList([]));
      const sw = softwaresList.find((s) => s.id === softwareId);
      if (sw) setSoftwareNome(sw.nome);
    } else {
      setModulosList([]);
      setSoftwareNome('');
    }
    setSoftwareModuloId('');
    setModuloNome('');
  }, [softwareId]);

  useEffect(() => {
    if (equipeAtualId) {
      catalogoService.listar(equipeAtualId, 'ATIVO').then(setCatalogos).catch(() => setCatalogos([]));
    } else {
      setCatalogos([]);
    }
    setCatalogoServicoId('');
  }, [equipeAtualId]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      const novos = Array.from(e.target.files);
      setArquivos((prev) => [...prev, ...novos]);
    }
    e.target.value = '';
  }

  function removeFile(index: number) {
    setArquivos((prev) => prev.filter((_, i) => i !== index));
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // PADRAO: exige validar matricula+senha antes de enviar (ou fallback de
    // Protheus fora). Reforco de UX — o backend revalida de qualquer forma.
    if (isUsuarioPadrao && !padraoLiberado) {
      setError('Valide sua matricula e senha antes de abrir o chamado.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const chamado = await chamadoService.criar({
        titulo,
        descricao,
        equipeAtualId,
        visibilidade: podeEscolherVisibilidade ? visibilidade : 'PUBLICO',
        prioridade,
        softwareId: softwareId || undefined,
        softwareModuloId: softwareModuloId || undefined,
        softwareNome: softwareNome || undefined,
        moduloNome: moduloNome || undefined,
        catalogoServicoId: catalogoServicoId || undefined,
        projetoId: projetoIdParam || undefined,
        filialId: (!isUsuarioFinal && filialId && filialId !== usuario?.filialAtual?.id) ? filialId : undefined,
        departamentoId: (!isUsuarioFinal && departamentoId && departamentoId !== usuario?.departamento.id) ? departamentoId : undefined,
        ipMaquina: ipMaquina || undefined,
        ativoId: ativoId || undefined,
        matriculaColaborador: isUsuarioPadrao && matriculaColaborador ? matriculaColaborador.trim() : undefined,
        nomeColaborador: isUsuarioPadrao && nomeColaborador ? nomeColaborador.trim() : undefined,
        senhaColaborador: isUsuarioPadrao && matriculaColaborador && senhaColaborador ? senhaColaborador : undefined,
        copiasUsuariosIds: copiasIds.length > 0 ? copiasIds : undefined,
      });

      // Upload dos anexos
      if (arquivos.length > 0) {
        await Promise.all(arquivos.map((file) => chamadoService.uploadAnexo(chamado.id, file)));
      }

      // Vincular a parada ou OS se veio do contexto
      if (paradaIdParam) {
        await paradaService.vincularChamado(paradaIdParam, chamado.id).catch(() => {});
      }
      if (osIdParam) {
        await ordemServicoService.vincularChamado(osIdParam, chamado.id).catch(() => {});
      }

      setDirty(false);
      setSuccessRedirectUrl(paradaIdParam ? `/gestao-ti/paradas/${paradaIdParam}` : osIdParam ? `/gestao-ti/ordens-servico` : `/gestao-ti/chamados/${chamado.id}`);
      setShowSuccessModal(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Erro ao criar chamado');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {ConfirmDialog}

      {showSuccessModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8 text-center animate-[fadeIn_0.2s_ease-out]">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Chamado Registrado!</h3>
            <p className="text-sm text-slate-600 mb-6">
              Seu chamado foi registrado com sucesso! A equipe responsavel sera notificada e atendera sua solicitacao assim que possivel.
            </p>
            <button
              onClick={() => navigate(successRedirectUrl)}
              className="bg-capul-600 text-white px-8 py-2.5 rounded-lg text-sm font-medium hover:bg-capul-700 transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      )}

      <Header title="Novo Chamado" />
      <div className="p-6 max-w-3xl" onChange={() => setDirty(true)}>
        <button
          onClick={() => guardedNavigate('/gestao-ti/chamados')}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        {projetoVinculado && (
          <div className="bg-capul-50 border border-capul-200 text-capul-700 px-4 py-3 rounded-lg mb-4 text-sm flex items-center gap-2">
            <FolderKanban className="w-4 h-4" />
            Vinculado ao Projeto #{projetoVinculado.numero} — {projetoVinculado.nome}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {isUsuarioPadrao && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
              <div>
                <p className="text-sm font-medium text-amber-800">Identificacao do Colaborador</p>
                <p className="text-xs text-amber-700/80 mt-0.5">
                  Digite sua matricula para conferir seu nome e, em seguida, valide com a senha do portal RH.
                </p>
              </div>
              {/* Passo 1 — matricula -> nome */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Matricula *</label>
                  <input
                    value={matriculaColaborador}
                    onChange={(e) => {
                      // Matricula = somente numeros (definicao do projeto, sem letra).
                      setMatriculaColaborador(e.target.value.replace(/\D/g, ''));
                      resetMatricula();
                    }}
                    onBlur={buscarNome}
                    placeholder="Ex: 001047"
                    inputMode="numeric"
                    autoComplete="off"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    required
                    maxLength={10}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Nome do Colaborador {nomeEditavel && '*'}
                  </label>
                  <input
                    ref={nomeColaboradorRef}
                    value={nomeColaborador}
                    onChange={(e) => setNomeColaborador(e.target.value)}
                    readOnly={!nomeEditavel}
                    required={nomeEditavel}
                    maxLength={100}
                    placeholder={buscandoNome ? 'Buscando...' : nomeEditavel ? 'Digite o nome' : 'Preenchido pela matricula'}
                    className={`w-full border border-slate-300 rounded-lg px-3 py-2 text-sm ${!nomeEditavel ? 'bg-slate-50 text-slate-700' : ''}`}
                  />
                </div>
              </div>
              {/* Passo 2 — senha -> validar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Senha *</label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={senhaColaborador}
                      onChange={(e) => { setSenhaColaborador(e.target.value); resetValidacaoSenha(); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); validarColaborador(); } }}
                      placeholder="Senha do portal RH"
                      autoComplete="off"
                      className={`flex-1 border rounded-lg px-3 py-2 text-sm ${
                        credOk ? 'border-green-400 bg-green-50' : 'border-slate-300'
                      }`}
                      required
                      maxLength={60}
                    />
                    <button
                      type="button"
                      onClick={validarColaborador}
                      disabled={validando || credOk || !matriculaColaborador.trim() || !senhaColaborador}
                      className="shrink-0 px-3 py-2 rounded-lg text-sm font-medium border border-amber-300 bg-white text-amber-800 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {validando ? 'Validando...' : credOk ? 'Validado' : 'Validar'}
                    </button>
                  </div>
                </div>
                <div className="flex items-end pb-1">
                  {erroValidacao && <p className="text-xs text-red-600 font-medium">{erroValidacao}</p>}
                  {credOk && (
                    <p className="text-xs text-green-700 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Senha confirmada.
                    </p>
                  )}
                </div>
              </div>

              {mensagemFallback && (
                <p className="text-xs text-amber-700 italic">{mensagemFallback}</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Assunto *</label>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
              maxLength={200}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Resuma em poucas palavras sua solicitacao. Ex: Impressora nao imprime, Liberar acesso ao sistema..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Detalhe sua necessidade *</label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              required
              rows={5}
              maxLength={5000}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Explique o que esta acontecendo, o que voce precisa e qual o impacto no seu trabalho..."
            />
            <div className="mt-1 flex justify-end">
              <span
                className={`text-xs ${
                  descricao.length >= 4900
                    ? 'text-red-600 font-semibold'
                    : descricao.length >= 4500
                    ? 'text-amber-600'
                    : 'text-slate-400'
                }`}
              >
                {descricao.length.toLocaleString('pt-BR')} / 5.000 caracteres
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(() => {
              // Lista única de deptos a partir das equipes ativas (workspace
              // que atende). Equipes sem depto cadastrado caem em "(Outros)".
              const deptosMap = new Map<string, string>();
              for (const eq of equipes) {
                const id = eq.departamento?.id ?? '__sem__';
                const nome = eq.departamento?.nome ?? '(Sem departamento)';
                if (!deptosMap.has(id)) deptosMap.set(id, nome);
              }
              const deptosOpcoes = Array.from(deptosMap.entries())
                .sort((a, b) => a[1].localeCompare(b[1]));
              const equipesFiltradas = deptoDestinoId
                ? equipes.filter((e) => (e.departamento?.id ?? '__sem__') === deptoDestinoId)
                : [];
              return (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Departamento Destino *</label>
                    <select
                      value={deptoDestinoId}
                      onChange={(e) => {
                        setDeptoDestinoId(e.target.value);
                        // ao trocar de depto, limpa equipe pra obrigar nova escolha
                        setEquipeAtualId('');
                      }}
                      required
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                    >
                      <option value="">Selecione o departamento</option>
                      {deptosOpcoes.map(([id, nome]) => (
                        <option key={id} value={id}>{nome}</option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 mt-1">Workspace que vai atender o chamado</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Equipe Destino *</label>
                    <select
                      value={equipeAtualId}
                      onChange={(e) => setEquipeAtualId(e.target.value)}
                      required
                      disabled={!deptoDestinoId}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white disabled:bg-slate-50 disabled:text-slate-400"
                    >
                      <option value="">{deptoDestinoId ? 'Selecione a equipe' : 'Escolha o departamento antes'}</option>
                      {equipesFiltradas.map((e) => (
                        <option key={e.id} value={e.id}>{e.sigla} - {e.nome}</option>
                      ))}
                    </select>
                    {(() => {
                      const equipeSel = equipes.find((e) => e.id === equipeAtualId);
                      if (!equipeSel?.descricao) return null;
                      return (
                        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-xs font-semibold text-blue-700 mb-1">{equipeSel.sigla} — {equipeSel.nome}</p>
                          <p className="text-xs text-blue-600 whitespace-pre-wrap">{equipeSel.descricao}</p>
                        </div>
                      );
                    })()}
                  </div>
                </>
              );
            })()}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Prioridade</label>
              <select
                value={prioridade}
                onChange={(e) => setPrioridade(e.target.value as Prioridade)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="BAIXA">Baixa</option>
                <option value="MEDIA">Média</option>
                <option value="ALTA">Alta</option>
                <option value="CRITICA">Crítica</option>
              </select>
            </div>
          </div>

          {podeEscolherVisibilidade && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Visibilidade</label>
              <select
                value={visibilidade}
                onChange={(e) => setVisibilidade(e.target.value as Visibilidade)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="PUBLICO">Publico (solicitante acompanha)</option>
                <option value="PRIVADO">Privado (somente equipe TI)</option>
              </select>
            </div>
          )}

          {/* Filial e Departamento — somente para tecnicos */}
          {!isUsuarioFinal && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
              <p className="text-xs text-slate-500">Altere caso esteja abrindo em nome de outro setor/filial</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Filial do solicitante</label>
                  <select
                    value={filialId}
                    onChange={(e) => {
                      setFilialId(e.target.value);
                      setDepartamentoId('');
                    }}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Selecione</option>
                    {filiais.map((f) => (
                      <option key={f.id} value={f.id}>{f.codigo} - {f.nomeFantasia}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Departamento do solicitante</label>
                  <select
                    value={departamentoId}
                    onChange={(e) => setDepartamentoId(e.target.value)}
                    disabled={!filialId}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white disabled:opacity-50"
                  >
                    <option value="">Selecione</option>
                    {(() => {
                      const tipos = [...new Map(departamentos.filter((d) => d.tipoDepartamento).map((d) => [d.tipoDepartamentoId, d.tipoDepartamento])).values()]
                        .sort((a, b) => a.ordem - b.ordem);
                      return tipos.map((tipo) => {
                        const deptosDoTipo = departamentos.filter((d) => d.tipoDepartamentoId === tipo.id);
                        if (deptosDoTipo.length === 0) return null;
                        return (
                          <optgroup key={tipo.id} label={tipo.nome}>
                            {deptosDoTipo.map((d) => (
                              <option key={d.id} value={d.id}>{d.nome}</option>
                            ))}
                          </optgroup>
                        );
                      });
                    })()}
                  </select>
                </div>
              </div>
            </div>
          )}

          {!isUsuarioFinal && ativosList.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ativo / Equipamento</label>
              <select
                value={ativoId}
                onChange={(e) => setAtivoId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">Nenhum</option>
                {ativosList.map((a) => (
                  <option key={a.id} value={a.id}>
                    [{a.tag}] {a.nome} {a.tipo !== 'OUTRO' ? `(${a.tipo.replace(/_/g, ' ')})` : ''} {a.ip ? `- ${a.ip}` : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">Vincular o equipamento relacionado ao chamado</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">IP da Maquina (acesso remoto)</label>
            <input
              value={ipMaquina}
              onChange={(e) => setIpMaquina(e.target.value)}
              maxLength={45}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Ex: 192.168.1.100"
            />
            <p className="text-xs text-slate-400 mt-1">Informe o IP da sua maquina para acesso remoto (ex: 192.168.1.100)</p>
          </div>

          {catalogos.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Servico do Catalogo</label>
              <select
                value={catalogoServicoId}
                onChange={(e) => setCatalogoServicoId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">Nenhum (chamado generico)</option>
                {catalogos.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Software (opcional)</label>
              <select
                value={softwareId}
                onChange={(e) => setSoftwareId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">Nenhum</option>
                {softwaresList.map((s) => (
                  <option key={s.id} value={s.id}>{s.nome}{s.fabricante ? ` (${s.fabricante})` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Modulo (opcional)</label>
              <select
                value={softwareModuloId}
                onChange={(e) => {
                  setSoftwareModuloId(e.target.value);
                  const mod = modulosList.find((m) => m.id === e.target.value);
                  setModuloNome(mod?.nome || '');
                }}
                disabled={!softwareId || modulosList.length === 0}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white disabled:opacity-50"
              >
                <option value="">Nenhum</option>
                {modulosList.map((m) => (
                  <option key={m.id} value={m.id}>{m.nome}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Em cópia */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Em cópia (opcional)</label>
            <p className="text-xs text-slate-500 mb-2">
              Pessoas adicionadas em cópia recebem notificações e podem comentar. Equipe T.I. não pode ser colocada em cópia.
            </p>
            {/* Chips dos selecionados */}
            {copiasIds.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {copiasIds.map((cid) => {
                  const u = usuariosNaoTI.find((x) => x.id === cid);
                  if (!u) return null;
                  return (
                    <span key={cid} className="inline-flex items-center gap-1 bg-capul-100 text-capul-700 text-xs px-2 py-1 rounded-full">
                      <Users2 className="w-3 h-3" />
                      {u.nome}
                      <button type="button" onClick={() => setCopiasIds(copiasIds.filter((i) => i !== cid))}
                        className="ml-1 text-capul-500 hover:text-capul-700">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            {/* Autocomplete */}
            <div className="relative">
              <input
                type="text"
                value={copiaBusca}
                onChange={(e) => { setCopiaBusca(e.target.value); setCopiaDropdownOpen(true); }}
                onFocus={() => setCopiaDropdownOpen(true)}
                onBlur={() => setTimeout(() => setCopiaDropdownOpen(false), 200)}
                placeholder="Buscar usuário para adicionar em cópia..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600"
              />
              {copiaDropdownOpen && (() => {
                const termo = copiaBusca.trim().toLowerCase();
                const disponiveis = usuariosNaoTI
                  .filter((u) => !copiasIds.includes(u.id))
                  .filter((u) => !termo || u.nome.toLowerCase().includes(termo) || u.username.toLowerCase().includes(termo))
                  .slice(0, 15);
                if (disponiveis.length === 0) return (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 p-3 text-sm text-slate-500">
                    {termo ? 'Nenhum usuário encontrado' : 'Comece a digitar para buscar'}
                  </div>
                );
                return (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                    {disponiveis.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setCopiasIds([...copiasIds, u.id]);
                          setCopiaBusca('');
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between"
                      >
                        <span className="text-slate-700">{u.nome}</span>
                        <span className="text-xs text-slate-400">{u.username}</span>
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Anexos */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Anexos (opcional)</label>
            <div
              className="border border-dashed border-slate-300 rounded-lg p-4 transition-colors"
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-capul-400', 'bg-capul-50'); }}
              onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-capul-400', 'bg-capul-50'); }}
              onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-capul-400', 'bg-capul-50'); if (e.dataTransfer.files.length > 0) { const fakeEvent = { target: { files: e.dataTransfer.files } } as unknown as React.ChangeEvent<HTMLInputElement>; handleFileChange(fakeEvent); } }}
            >
              <label className="flex items-center gap-2 text-sm text-capul-600 hover:text-capul-700 cursor-pointer w-fit">
                <Paperclip className="w-4 h-4" />
                Selecionar ou arrastar arquivos
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,.rar,.7z"
                />
              </label>
              <p className="text-xs text-slate-400 mt-1">Max 10MB por arquivo. Imagens, PDF, documentos, planilhas, ZIP. Arraste arquivos para ca.</p>
              {arquivos.length > 0 && (
                <div className="mt-3 space-y-2">
                  {arquivos.map((file, i) => (
                    <div key={i} className="flex items-center justify-between bg-slate-50 rounded px-3 py-2 text-sm">
                      <span className="text-slate-700 truncate">{file.name} <span className="text-slate-400">({formatFileSize(file.size)})</span></span>
                      <button type="button" onClick={() => removeFile(i)} className="text-slate-400 hover:text-red-500">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving || validando || !padraoLiberado}
              title={!padraoLiberado ? 'Valide sua matricula e senha primeiro' : undefined}
              className="bg-capul-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-capul-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving
                ? 'Criando...'
                : validando
                  ? 'Validando...'
                  : 'Abrir Chamado'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
