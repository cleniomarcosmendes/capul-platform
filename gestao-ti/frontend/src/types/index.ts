export interface ModuloUsuario {
  codigo: string;
  nome: string;
  icone: string;
  cor: string;
  url: string;
  role: string;
  roleNome: string;
}

export interface FilialUsuario {
  id: string;
  codigo: string;
  nome: string;
}

export interface UsuarioLogado {
  id: string;
  username: string;
  nome: string;
  email: string | null;
  departamento: { id: string; nome: string };
  filialAtual: FilialUsuario | null;
  modulos: ModuloUsuario[];
}

export interface EquipeTI {
  id: string;
  nome: string;
  sigla: string;
  descricao: string | null;
  cor: string | null;
  icone: string | null;
  aceitaChamadoExterno: boolean;
  emailEquipe: string | null;
  ordem: number;
  status: 'ATIVO' | 'INATIVO';
  createdAt: string;
  updatedAt: string;
  membros: MembroEquipe[];
}

export interface MembroEquipe {
  id: string;
  isLider: boolean;
  podeGerirContratos: boolean;
  status: 'ATIVO' | 'INATIVO';
  usuarioId: string;
  equipeId: string;
  usuario: UsuarioResumo;
  createdAt: string;
  updatedAt: string;
}

export interface UsuarioResumo {
  id: string;
  username: string;
  nome: string;
  email: string | null;
}

export interface UsuarioCore {
  id: string;
  username: string;
  nome: string;
  email: string | null;
}

export interface Departamento {
  id: string;
  nome: string;
  codigo: string;
  descricao: string | null;
  filialId: string;
  status: string;
}

export interface CentroCusto {
  id: string;
  nome: string;
  codigo: string;
  filialId: string;
  status: string;
}

// === Fase 2 types ===

export type Prioridade = 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAIXA';
export type StatusChamado = 'ABERTO' | 'EM_ATENDIMENTO' | 'PENDENTE' | 'RESOLVIDO' | 'FECHADO' | 'CANCELADO' | 'REABERTO';
export type Visibilidade = 'PUBLICO' | 'PRIVADO';
export type TipoHistorico = 'ABERTURA' | 'ASSUMIDO' | 'COMENTARIO' | 'TRANSFERENCIA_EQUIPE' | 'TRANSFERENCIA_TECNICO' | 'RESOLVIDO' | 'FECHADO' | 'REABERTO' | 'CANCELADO' | 'AVALIADO';
export type StatusOS = 'ABERTA' | 'EM_EXECUCAO' | 'CONCLUIDA' | 'CANCELADA';

// === Fase 2B — Portfólio types ===

export type TipoSoftware = 'ERP' | 'CRM' | 'SEGURANCA' | 'COLABORACAO' | 'INFRAESTRUTURA' | 'OPERACIONAL' | 'OUTROS';
export type Criticidade = 'CRITICO' | 'ALTO' | 'MEDIO' | 'BAIXO';
export type AmbienteSoftware = 'ON_PREMISE' | 'CLOUD' | 'HIBRIDO';
export type StatusSoftware = 'ATIVO' | 'EM_IMPLANTACAO' | 'DESCONTINUADO' | 'HOMOLOGACAO';
export type StatusModulo = 'ATIVO' | 'EM_IMPLANTACAO' | 'DESATIVADO';
export type ModeloLicenca = 'SUBSCRICAO' | 'PERPETUA' | 'POR_USUARIO' | 'POR_ESTACAO' | 'OEM' | 'FREE_OPENSOURCE' | 'SAAS' | 'OUTRO';
export type StatusLicenca = 'ATIVA' | 'INATIVA' | 'VENCIDA';

// === Fase 3 — Contratos types ===

export interface NaturezaContrato {
  id: string;
  codigo: string;
  nome: string;
  status: string;
}

export interface TipoContratoConfig {
  id: string;
  codigo: string;
  nome: string;
  status: string;
}

export interface FornecedorConfig {
  id: string;
  codigo: string;
  loja: string | null;
  nome: string;
  status: string;
}

export interface ProdutoConfig {
  id: string;
  codigo: string;
  descricao: string;
  status: string;
}

export type StatusContrato = 'RASCUNHO' | 'ATIVO' | 'SUSPENSO' | 'VENCIDO' | 'RENOVADO' | 'CANCELADO';
export type ModalidadeRateio = 'PERCENTUAL_CUSTOMIZADO' | 'VALOR_FIXO' | 'PROPORCIONAL_CRITERIO' | 'IGUALITARIO' | 'SEM_RATEIO';
export type ModalidadeValor = 'FIXO' | 'VARIAVEL';
export type StatusParcela = 'PENDENTE' | 'PAGA' | 'ATRASADA' | 'CANCELADA';
export type TipoHistoricoContrato = 'CRIACAO' | 'ATIVACAO' | 'ALTERACAO' | 'SUSPENSAO' | 'RENOVACAO' | 'CANCELAMENTO' | 'VENCIMENTO' | 'RATEIO_ALTERADO' | 'PARCELA_PAGA' | 'OBSERVACAO';

// === Fase 4 — Sustentacao ERP types ===

export type TipoParada = 'PARADA_PROGRAMADA' | 'PARADA_NAO_PROGRAMADA' | 'MANUTENCAO_PREVENTIVA';
export type ImpactoParada = 'TOTAL' | 'PARCIAL';
export type StatusParada = 'EM_ANDAMENTO' | 'FINALIZADA' | 'CANCELADA';

export interface EquipeResumo {
  id: string;
  nome: string;
  sigla: string;
  cor: string | null;
}

export interface FilialResumo {
  id: string;
  codigo: string;
  nomeFantasia: string;
}

export interface CatalogoServico {
  id: string;
  nome: string;
  descricao: string | null;
  equipeId: string;
  equipe: EquipeResumo;
  prioridadePadrao: Prioridade;
  slaPadraoHoras: number | null;
  ordem: number;
  status: 'ATIVO' | 'INATIVO';
  createdAt: string;
  updatedAt: string;
}

export interface SlaDefinicao {
  id: string;
  nome: string;
  prioridade: Prioridade;
  horasResposta: number;
  horasResolucao: number;
  equipeId: string;
  equipe: { id: string; nome: string; sigla: string };
  status: 'ATIVO' | 'INATIVO';
  createdAt: string;
  updatedAt: string;
}

export interface Chamado {
  id: string;
  numero: number;
  titulo: string;
  descricao: string;
  status: StatusChamado;
  visibilidade: Visibilidade;
  prioridade: Prioridade;
  softwareNome: string | null;
  moduloNome: string | null;
  softwareId: string | null;
  softwareModuloId: string | null;
  software: { id: string; nome: string; tipo: TipoSoftware } | null;
  softwareModulo: { id: string; nome: string } | null;
  solicitanteId: string;
  solicitante: UsuarioResumo;
  tecnicoId: string | null;
  tecnico: UsuarioResumo | null;
  equipeAtualId: string;
  equipeAtual: EquipeResumo;
  filialId: string;
  filial: FilialResumo;
  catalogoServicoId: string | null;
  catalogoServico: { id: string; nome: string } | null;
  slaDefinicaoId: string | null;
  slaDefinicao: SlaDefinicao | null;
  dataLimiteSla: string | null;
  dataResolucao: string | null;
  dataFechamento: string | null;
  notaSatisfacao: number | null;
  comentarioSatisfacao: string | null;
  ipMaquina: string | null;
  createdAt: string;
  updatedAt: string;
  historicos?: HistoricoChamado[];
  anexos?: AnexoChamado[];
  projetoId: string | null;
  projeto: { id: string; numero: number; nome: string } | null;
  ativoId: string | null;
  ativo: { id: string; tag: string; nome: string; tipo: TipoAtivo } | null;
  departamentoId: string | null;
  departamento: { id: string; nome: string } | null;
  colaboradores?: ChamadoColaborador[];
  registrosTempo?: { id: string; usuarioId: string; horaInicio: string }[];
}

export interface ChamadoColaborador {
  id: string;
  chamadoId: string;
  usuarioId: string;
  usuario: { id: string; nome: string; username: string };
  createdAt: string;
}

export interface RegistroTempoChamado {
  id: string;
  horaInicio: string;
  horaFim: string | null;
  duracaoMinutos: number | null;
  observacoes: string | null;
  chamadoId: string;
  usuarioId: string;
  usuario: { id: string; nome: string };
  createdAt: string;
  updatedAt: string;
}

export interface HistoricoChamado {
  id: string;
  tipo: TipoHistorico;
  descricao: string;
  publico: boolean;
  chamadoId: string;
  usuarioId: string;
  usuario: { id: string; nome: string; username: string };
  equipeOrigemId: string | null;
  equipeOrigem: EquipeResumo | null;
  equipeDestinoId: string | null;
  equipeDestino: EquipeResumo | null;
  createdAt: string;
}

export interface OrdemServico {
  id: string;
  numero: number;
  titulo: string;
  descricao: string | null;
  status: StatusOS;
  filialId: string;
  filial: FilialResumo;
  solicitanteId: string;
  solicitante: { id: string; nome: string; username: string };
  tecnicos: { id: string; tecnicoId: string; tecnico: { id: string; nome: string; username: string } }[];
  chamados: { id: string; chamadoId: string; chamado: { id: string; numero: number; titulo: string; status: string } }[];
  dataAgendamento: string | null;
  dataInicio: string | null;
  dataFim: string | null;
  observacoes: string | null;
  _count: { chamados: number; tecnicos: number };
  createdAt: string;
  updatedAt: string;
}

export interface DashboardResumo {
  periodo?: { inicio: string; fim: string };
  chamados: {
    abertos: number;
    emAtendimento: number;
    pendentes: number;
    resolvidos: number;
    fechados: number;
  };
  porEquipe: { equipe: EquipeResumo; total: number }[];
  porPrioridade: { prioridade: Prioridade; total: number }[];
  ordensServico: { abertas: number };
  portfolio: {
    totalSoftwares: number;
    totalLicencasAtivas: number;
    licencasVencendo30d: number;
    custoAnualLicencas: number;
  };
  contratos: {
    totalAtivos: number;
    valorTotalComprometido: number;
    vencendo30d: number;
    parcelasPendentes: number;
    parcelasAtrasadas: number;
  };
  sustentacao?: {
    paradasEmAndamento: number;
    totalParadasMes: number;
  };
  projetos?: {
    totalAtivos: number;
    emAndamento: number;
    custoPrevistoTotal: number;
    custoRealizadoTotal: number;
    totalHorasApontadas: number;
    riscosAbertos: number;
    atividades?: {
      pendentes: number;
      emAndamento: number;
      concluidas: number;
    };
  };
  ativos?: {
    totalAtivos: number;
  };
  conhecimento?: {
    totalArtigosPublicados: number;
  };
}

// === Portfólio interfaces ===

export interface Software {
  id: string;
  nome: string;
  fabricante: string | null;
  tipo: TipoSoftware | null;
  criticidade: Criticidade | null;
  versaoAtual: string | null;
  ambiente: AmbienteSoftware | null;
  urlAcesso: string | null;
  equipeResponsavelId: string | null;
  equipeResponsavel: EquipeResumo | null;
  status: StatusSoftware;
  observacoes: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { modulos: number; licencas: number; chamados: number };
  modulos?: SoftwareModulo[];
  filiais?: SoftwareFilialItem[];
  licencas?: SoftwareLicenca[];
}

export interface SoftwareModulo {
  id: string;
  nome: string;
  descricao: string | null;
  status: StatusModulo;
  versao: string | null;
  observacoes: string | null;
  softwareId: string;
  createdAt: string;
  updatedAt: string;
  filiais?: ModuloFilialItem[];
  _count?: { chamados: number };
}

export interface SoftwareFilialItem {
  id: string;
  softwareId: string;
  filialId: string;
  filial: FilialResumo;
  createdAt: string;
}

export interface ModuloFilialItem {
  id: string;
  moduloId: string;
  filialId: string;
  filial: FilialResumo;
  createdAt: string;
}

export interface LicencaUsuario {
  id: string;
  licencaId: string;
  usuarioId: string;
  usuario: { id: string; username: string; nome: string; email: string | null };
  createdAt: string;
}

export interface SoftwareLicenca {
  id: string;
  softwareId: string;
  software: { id: string; nome: string; fabricante: string | null; tipo: TipoSoftware | null };
  contratoId: string | null;
  contrato: { id: string; titulo: string; numero: number } | null;
  modeloLicenca: ModeloLicenca | null;
  quantidade: number | null;
  valorTotal: number | null;
  valorUnitario: number | null;
  dataInicio: string | null;
  dataVencimento: string | null;
  chaveSerial: string | null;
  fornecedor: string | null;
  observacoes: string | null;
  status: StatusLicenca;
  createdAt: string;
  updatedAt: string;
  usuarios?: LicencaUsuario[];
  _count?: { usuarios: number };
}

// === Contrato interfaces ===

export interface Contrato {
  id: string;
  numero: number;
  titulo: string;
  descricao: string | null;
  status: StatusContrato;
  modalidadeValor: ModalidadeValor;
  fornecedor: string;
  numeroContrato: string | null;
  codigoFornecedor: string | null;
  lojaFornecedor: string | null;
  codigoProduto: string | null;
  descricaoProduto: string | null;
  fornecedorId: string | null;
  fornecedorRef: { id: string; codigo: string; loja: string | null; nome: string } | null;
  produtoId: string | null;
  produtoRef: { id: string; codigo: string; descricao: string } | null;
  tipoContratoId: string | null;
  tipoContrato: { id: string; codigo: string; nome: string } | null;
  filialId: string | null;
  filial: { id: string; codigo: string; nomeFantasia: string } | null;
  valorTotal: number;
  valorMensal: number | null;
  dataInicio: string;
  dataFim: string;
  dataAssinatura: string | null;
  dataRenovacao: string | null;
  renovacaoAutomatica: boolean;
  diasAlertaVencimento: number;
  softwareId: string | null;
  software: { id: string; nome: string; fabricante: string | null; tipo?: TipoSoftware } | null;
  equipeId: string | null;
  equipe: { id: string; nome: string; sigla: string } | null;
  contratoOriginalId: string | null;
  contratoOriginal: { id: string; numero: number; titulo: string } | null;
  contratosRenovados: { id: string; numero: number; titulo: string; valorTotal: number; dataInicio: string; dataFim: string; status: StatusContrato }[];
  observacoes: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { parcelas: number; licencas: number; anexos: number };
  parcelas?: ParcelaContrato[];
  rateioTemplate?: RateioTemplate | null;
  historicos?: ContratoHistorico[];
  licencas?: SoftwareLicenca[];
  anexos?: AnexoContrato[];
}

export interface ParcelaContrato {
  id: string;
  numero: number;
  descricao: string | null;
  valor: number;
  dataVencimento: string;
  dataPagamento: string | null;
  status: StatusParcela;
  notaFiscal: string | null;
  observacoes: string | null;
  contratoId: string;
  rateioItens?: ParcelaRateioItem[];
  createdAt: string;
  updatedAt: string;
}

export interface RateioTemplate {
  id: string;
  modalidade: ModalidadeRateio;
  criterio: string | null;
  contratoId: string;
  createdAt: string;
  updatedAt: string;
  itens: RateioTemplateItem[];
}

export interface RateioTemplateItem {
  id: string;
  percentual: number | null;
  valorFixo: number | null;
  parametro: number | null;
  centroCustoId: string;
  centroCusto: { id: string; codigo: string; nome: string };
  naturezaId: string | null;
  natureza: { id: string; codigo: string; nome: string } | null;
  createdAt: string;
}

export interface ParcelaRateioItem {
  id: string;
  percentual: number | null;
  valorCalculado: number;
  centroCustoId: string;
  centroCusto: { id: string; codigo: string; nome: string };
  naturezaId: string | null;
  natureza: { id: string; codigo: string; nome: string } | null;
  parcelaId: string;
  createdAt: string;
}

export interface AnexoContrato {
  id: string;
  nomeOriginal: string;
  nomeArquivo: string;
  mimeType: string;
  tamanho: number;
  contratoId: string;
  createdAt: string;
}

export interface ContratoRenovacaoReg {
  id: string;
  indiceReajuste: string | null;
  percentualReajuste: number | null;
  valorAnterior: number;
  valorNovo: number;
  contratoAnteriorId: string;
  contratoAnterior: { id: string; numero: number; titulo: string; valorTotal: number; status: StatusContrato };
  contratoNovoId: string;
  contratoNovo: { id: string; numero: number; titulo: string; valorTotal: number; status: StatusContrato };
  createdAt: string;
}

export interface ContratoHistorico {
  id: string;
  tipo: TipoHistoricoContrato;
  descricao: string | null;
  dadosJson: string | null;
  contratoId: string;
  usuarioId: string;
  usuario: { id: string; nome: string; username: string };
  createdAt: string;
}

// === Parada interfaces ===

export interface ParadaFilialAfetada {
  id: string;
  filialId: string;
  filial: FilialResumo;
  createdAt: string;
}

export interface ParadaColaborador {
  id: string;
  paradaId: string;
  usuarioId: string;
  usuario: { id: string; nome: string; username: string };
  createdAt: string;
}

export interface MotivoParada {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RegistroParada {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: TipoParada;
  impacto: ImpactoParada;
  status: StatusParada;
  inicio: string;
  fim: string | null;
  duracaoMinutos: number | null;
  observacoes: string | null;
  motivoParadaId: string | null;
  motivoParada: { id: string; nome: string } | null;
  softwareId: string;
  software: { id: string; nome: string; tipo: string; criticidade: string | null };
  softwareModuloId: string | null;
  softwareModulo: { id: string; nome: string } | null;
  chamados: { id: string; chamadoId: string; chamado: { id: string; numero: number; titulo: string; status: string } }[];
  registradoPorId: string;
  registradoPor: { id: string; nome: string; username: string };
  finalizadoPorId: string | null;
  finalizadoPor: { id: string; nome: string; username: string } | null;
  filiaisAfetadas: ParadaFilialAfetada[];
  colaboradores: ParadaColaborador[];
  _count: { filiaisAfetadas: number; chamados: number; colaboradores: number };
  createdAt: string;
  updatedAt: string;
}

export interface DashboardDisponibilidade {
  periodo: { inicio: string; fim: string; totalMinutos: number };
  resumo: {
    paradasEmAndamento: number;
    totalParadasPeriodo: number;
    mttrMinutos: number;
    mttrFormatado: string;
  };
  disponibilidadePorSoftware: {
    software: { id: string; nome: string; tipo: string; criticidade: string | null };
    downtimeMinutos: number;
    downtimeHoras: number;
    uptimePercent: number;
    totalParadas: number;
    paradasTotal: number;
    paradasParcial: number;
  }[];
  paradasPorTipo: { tipo: string; total: number }[];
  paradasPorImpacto: { impacto: string; total: number }[];
  paradasRecentes: RegistroParada[];
}

// === Fase 5 — Projetos types ===

export type TipoProjeto = 'DESENVOLVIMENTO_INTERNO' | 'IMPLANTACAO_TERCEIRO' | 'INFRAESTRUTURA' | 'OUTRO';
export type ModoProjeto = 'SIMPLES' | 'COMPLETO';
export type StatusProjeto = 'PLANEJAMENTO' | 'EM_ANDAMENTO' | 'PAUSADO' | 'CONCLUIDO' | 'CANCELADO';
export type PapelRaci = 'RESPONSAVEL' | 'APROVADOR' | 'CONSULTADO' | 'INFORMADO';
export type StatusFase = 'PENDENTE' | 'EM_ANDAMENTO' | 'APROVADA' | 'REJEITADA';

// === Fase 5B+ — Pendencias de Projeto types ===

export type StatusPendencia = 'ABERTA' | 'EM_ANDAMENTO' | 'AGUARDANDO_VALIDACAO' | 'CONCLUIDA' | 'CANCELADA';
export type PrioridadePendencia = 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE';
export type TipoInteracaoPendencia = 'COMENTARIO' | 'ANEXO' | 'STATUS_ALTERADO' | 'RESPONSAVEL_ALTERADO';

export interface UsuarioChaveProjeto {
  id: string;
  projetoId: string;
  usuarioId: string;
  usuario: { id: string; nome: string; username: string; email: string };
  funcao: string;
  ativo: boolean;
  createdAt: string;
}

export interface PendenciaProjeto {
  id: string;
  numero: number;
  titulo: string;
  descricao: string | null;
  status: StatusPendencia;
  prioridade: PrioridadePendencia;
  dataLimite: string | null;
  projetoId: string;
  faseId: string | null;
  fase: { id: string; nome: string } | null;
  responsavelId: string;
  responsavel: { id: string; nome: string; username: string };
  criadorId: string;
  criador: { id: string; nome: string; username: string };
  interacoes?: InteracaoPendencia[];
  anexos?: AnexoPendenciaItem[];
  _count?: { interacoes: number; anexos: number };
  createdAt: string;
  updatedAt: string;
}

export interface InteracaoPendencia {
  id: string;
  tipo: TipoInteracaoPendencia;
  descricao: string | null;
  publica: boolean;
  pendenciaId: string;
  usuarioId: string;
  usuario: { id: string; nome: string; username: string };
  createdAt: string;
}

export interface AnexoPendenciaItem {
  id: string;
  nomeOriginal: string;
  nomeArquivo: string;
  mimeType: string;
  tamanho: number;
  pendenciaId: string;
  interacaoId: string | null;
  usuarioId: string;
  usuario: { id: string; nome: string };
  createdAt: string;
}

// === Fase 5B — Projetos types adicionais ===

export type StatusCotacao = 'RASCUNHO' | 'SOLICITADA' | 'RECEBIDA' | 'APROVADA' | 'REJEITADA';
export type CategoriaCusto = 'MAO_DE_OBRA' | 'INFRAESTRUTURA' | 'LICENCIAMENTO' | 'CONSULTORIA' | 'TREINAMENTO' | 'VIAGEM' | 'MATERIAL' | 'OUTRO';
export type ProbabilidadeRisco = 'MUITO_BAIXA' | 'BAIXA' | 'MEDIA' | 'ALTA' | 'MUITO_ALTA';
export type ImpactoRisco = 'MUITO_BAIXO' | 'BAIXO' | 'MEDIO' | 'ALTO' | 'MUITO_ALTO';
export type StatusRisco = 'IDENTIFICADO' | 'EM_ANALISE' | 'MITIGANDO' | 'ACEITO' | 'RESOLVIDO';
export type TipoDependencia = 'BLOQUEIO' | 'PREDECESSOR' | 'SUCESSOR' | 'RELACIONADO';
export type TipoAnexo = 'DOCUMENTO' | 'PLANILHA' | 'IMAGEM' | 'LINK' | 'OUTRO';

// === Fase 6A — CMDB + Conhecimento types ===

export type TipoAtivo = 'SERVIDOR' | 'ESTACAO_TRABALHO' | 'NOTEBOOK' | 'IMPRESSORA' | 'SWITCH' | 'ROTEADOR' | 'STORAGE' | 'OUTRO';
export type StatusAtivo = 'ATIVO' | 'INATIVO' | 'EM_MANUTENCAO' | 'DESCARTADO';
export type CategoriaArtigo = 'PROCEDIMENTO' | 'SOLUCAO' | 'FAQ' | 'CONFIGURACAO' | 'OUTRO';
export type StatusArtigo = 'RASCUNHO' | 'PUBLICADO' | 'ARQUIVADO';

export interface CotacaoProjeto {
  id: string;
  fornecedor: string;
  descricao: string | null;
  valor: number;
  moeda: string;
  dataRecebimento: string | null;
  validade: string | null;
  status: StatusCotacao;
  observacoes: string | null;
  projetoId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustoProjeto {
  id: string;
  descricao: string;
  categoria: CategoriaCusto;
  valorPrevisto: number | null;
  valorRealizado: number | null;
  data: string | null;
  observacoes: string | null;
  projetoId: string;
  createdAt: string;
  updatedAt: string;
}

export interface RiscoProjeto {
  id: string;
  titulo: string;
  descricao: string | null;
  probabilidade: ProbabilidadeRisco;
  impacto: ImpactoRisco;
  status: StatusRisco;
  planoMitigacao: string | null;
  responsavelId: string | null;
  responsavel: { id: string; nome: string } | null;
  observacoes: string | null;
  projetoId: string;
  createdAt: string;
  updatedAt: string;
}

export interface DependenciaProjeto {
  id: string;
  tipo: TipoDependencia;
  descricao: string | null;
  projetoOrigemId: string;
  projetoOrigem?: { id: string; numero: number; nome: string; status: StatusProjeto };
  projetoDestinoId: string;
  projetoDestino?: { id: string; numero: number; nome: string; status: StatusProjeto };
  createdAt: string;
}

export interface AnexoProjeto {
  id: string;
  titulo: string;
  url: string;
  tipo: TipoAnexo;
  tamanho: string | null;
  descricao: string | null;
  projetoId: string;
  usuarioId: string;
  usuario: { id: string; nome: string };
  createdAt: string;
}

export interface ApontamentoHoras {
  id: string;
  data: string;
  horas: number;
  descricao: string;
  observacoes: string | null;
  projetoId: string;
  usuarioId: string;
  usuario: { id: string; nome: string };
  faseId: string | null;
  fase: { id: string; nome: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface Projeto {
  id: string;
  numero: number;
  nome: string;
  descricao: string | null;
  tipo: TipoProjeto;
  modo: ModoProjeto;
  status: StatusProjeto;
  nivel: number;
  dataInicio: string | null;
  dataFimPrevista: string | null;
  dataFimReal: string | null;
  custoPrevisto: number | null;
  custoRealizado: number | null;
  observacoes: string | null;
  projetoPaiId: string | null;
  softwareId: string | null;
  software: { id: string; nome: string; tipo: string } | null;
  contratoId: string | null;
  contrato: { id: string; numero: number; titulo: string } | null;
  responsavelId: string;
  responsavel: { id: string; nome: string; username: string };
  subProjetos?: { id: string; numero: number; nome: string; status: StatusProjeto; modo: ModoProjeto; nivel: number }[];
  membros?: MembroProjeto[];
  fases?: FaseProjeto[];
  atividades?: AtividadeProjeto[];
  cotacoes?: CotacaoProjeto[];
  custos?: CustoProjeto[];
  riscos?: RiscoProjeto[];
  dependenciasOrigem?: DependenciaProjeto[];
  dependenciasDestino?: DependenciaProjeto[];
  anexos?: AnexoProjeto[];
  apontamentos?: ApontamentoHoras[];
  chamados?: Chamado[];
  _count: {
    subProjetos: number; membros: number; fases: number; atividades: number;
    cotacoes: number; custos: number; riscos: number; anexos: number;
    apontamentos: number; dependenciasOrigem: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface MembroProjeto {
  id: string;
  papel: PapelRaci;
  observacoes: string | null;
  projetoId: string;
  usuarioId: string;
  usuario: { id: string; nome: string; username: string; email: string | null };
  createdAt: string;
}

export interface FaseProjeto {
  id: string;
  nome: string;
  descricao: string | null;
  ordem: number;
  status: StatusFase;
  dataInicio: string | null;
  dataFimPrevista: string | null;
  dataFimReal: string | null;
  observacoes: string | null;
  projetoId: string;
  createdAt: string;
  updatedAt: string;
}

export type StatusAtividade = 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'CANCELADA';

export interface AtividadeProjeto {
  id: string;
  titulo: string;
  descricao: string | null;
  dataInicio: string | null;
  dataFimPrevista: string | null;
  dataAtividade: string;
  status: StatusAtividade;
  projetoId: string;
  usuarioId: string;
  usuario: { id: string; nome: string };
  faseId: string | null;
  fase: { id: string; nome: string } | null;
  _count?: { registrosTempo: number; comentarios: number };
  registrosTempo?: { id: string; usuarioId: string; horaInicio: string }[];
  createdAt: string;
}

export interface ComentarioTarefa {
  id: string;
  texto: string;
  atividadeId: string;
  usuarioId: string;
  usuario: { id: string; nome: string };
  atividade?: {
    id: string;
    titulo: string;
    projetoId: string;
    projeto: { id: string; numero: number; nome: string };
    fase: { id: string; nome: string } | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface RegistroTempo {
  id: string;
  horaInicio: string;
  horaFim: string | null;
  duracaoMinutos: number | null;
  observacoes: string | null;
  atividadeId: string;
  atividade?: { id: string; titulo: string };
  usuarioId: string;
  usuario: { id: string; nome: string };
  createdAt: string;
  updatedAt: string;
}

export interface CustosConsolidados {
  projeto: { id: string; nome: string; nivel: number };
  custoPrevistoProprio: number;
  custoRealizadoProprio: number;
  custoPrevistoFilhos: number;
  custoRealizadoFilhos: number;
  custoPrevistoTotal: number;
  custoRealizadoTotal: number;
  totalSubProjetos: number;
  custosDetalhados: number;
  totalHoras: number;
  totalApontamentos: number;
}

// === Ativo (CMDB) interfaces ===

export interface Ativo {
  id: string;
  tag: string;
  nome: string;
  descricao: string | null;
  tipo: TipoAtivo;
  status: StatusAtivo;
  fabricante: string | null;
  modelo: string | null;
  numeroSerie: string | null;
  dataAquisicao: string | null;
  dataGarantia: string | null;
  processador: string | null;
  memoriaGB: number | null;
  discoGB: number | null;
  sistemaOperacional: string | null;
  ip: string | null;
  hostname: string | null;
  observacoes: string | null;
  glpiId: string | null;
  filialId: string;
  filial: FilialResumo;
  responsavelId: string | null;
  responsavel: { id: string; nome: string; username: string } | null;
  departamentoId: string | null;
  departamento: { id: string; nome: string } | null;
  ativoPaiId: string | null;
  ativoPai: { id: string; tag: string; nome: string; tipo: TipoAtivo } | null;
  softwares?: AtivoSoftwareItem[];
  componentes?: { id: string; tag: string; nome: string; tipo: TipoAtivo; status: string; fabricante: string | null; modelo: string | null; ip: string | null; hostname: string | null }[];
  _count: { softwares: number; componentes: number; chamados: number };
  createdAt: string;
  updatedAt: string;
}

export interface AtivoSoftwareItem {
  id: string;
  ativoId: string;
  softwareId: string;
  software: { id: string; nome: string; tipo: TipoSoftware; versaoAtual: string | null };
  versaoInstalada: string | null;
  dataInstalacao: string | null;
  observacoes: string | null;
  createdAt: string;
}

// === Conhecimento interfaces ===

export interface ArtigoConhecimento {
  id: string;
  titulo: string;
  conteudo: string;
  resumo: string | null;
  categoria: CategoriaArtigo;
  status: StatusArtigo;
  tags: string | null;
  publica: boolean;
  publicadoEm: string | null;
  softwareId: string | null;
  software: { id: string; nome: string } | null;
  equipeTiId: string | null;
  equipeTi: { id: string; nome: string; sigla: string } | null;
  autorId: string;
  autor: { id: string; nome: string; username: string };
  anexos?: AnexoConhecimento[];
  createdAt: string;
  updatedAt: string;
}

export interface AnexoConhecimento {
  id: string;
  nomeOriginal: string;
  mimeType: string;
  tamanho: number;
  descricao: string | null;
  usuarioId: string;
  usuario: { id: string; nome: string };
  createdAt: string;
}

// === Dashboard Executivo interface ===

export interface DashboardExecutivo {
  periodo?: { inicio: string; fim: string };
  chamados: {
    abertos: number;
    emAtendimento: number;
    pendentes: number;
    fechadosMes: number;
    slaEstourado: number;
    tempoMedioResolucaoHoras: number;
    slaCompliancePercent: number;
  };
  contratos: {
    totalAtivos: number;
    valorComprometido: number;
    vencendo30d: number;
    parcelasAtrasadas: number;
  };
  sustentacao: {
    paradasEmAndamento: number;
    totalParadasMes: number;
    mttrMinutos: number;
    mttrFormatado: string;
  };
  projetos: {
    totalAtivos: number;
    emAndamento: number;
    custoPrevistoTotal: number;
    custoRealizadoTotal: number;
    riscosAbertos: number;
    atividades?: {
      pendentes: number;
      emAndamento: number;
      concluidas: number;
    };
  };
  portfolio: {
    totalSoftwares: number;
    licencasAtivas: number;
    licencasVencendo30d: number;
    custoLicencas: number;
  };
  ativos: {
    totalAtivos: number;
    porTipo: { tipo: TipoAtivo; total: number }[];
    porStatus: { status: StatusAtivo; total: number }[];
  };
  conhecimento: {
    totalArtigosPublicados: number;
  };
}

// === Fase 6B — Notificacoes types ===

export type TipoNotificacao =
  | 'CHAMADO_ATRIBUIDO' | 'CHAMADO_ATUALIZADO' | 'SLA_ESTOURADO'
  | 'LICENCA_VENCENDO' | 'CONTRATO_VENCENDO' | 'PARCELA_ATRASADA'
  | 'PARADA_INICIADA' | 'PROJETO_ATUALIZADO' | 'GERAL';

export interface Notificacao {
  id: string;
  tipo: TipoNotificacao;
  titulo: string;
  mensagem: string;
  lida: boolean;
  dadosJson: string | null;
  usuarioId: string;
  createdAt: string;
}

export interface AnexoChamado {
  id: string;
  nomeOriginal: string;
  mimeType: string;
  tamanho: number;
  descricao: string | null;
  usuarioId: string;
  usuario: { id: string; nome: string };
  createdAt: string;
}

export interface DashboardFinanceiro {
  periodo?: { inicio: string; fim: string };
  contratosPorTipo: { tipoContratoId: string | null; tipoNome: string | null; total: number; valorTotal: number }[];
  contratosPorStatus: { status: StatusContrato; total: number }[];
  despesasPorCentroCusto: { centroCusto: { id: string; codigo: string; nome: string }; valorTotal: number }[];
  contratosVencendo: { id: string; numero: number; titulo: string; fornecedor: string; valorTotal: number; dataFim: string; software: { id: string; nome: string } | null }[];
  parcelasProximas: { id: string; numero: number; valor: number; dataVencimento: string; status: StatusParcela; contrato: { id: string; numero: number; titulo: string; fornecedor: string } }[];
}

// === Dashboard CSAT ===

export interface DashboardCsat {
  periodo?: { inicio: string; fim: string };
  totalFechados: number;
  totalAvaliados: number;
  taxaResposta: number;
  csatMedio: number;
  distribuicaoNotas: { nota: number; total: number }[];
  porTecnico: { tecnico: { id: string; nome: string }; media: number; total: number }[];
  porEquipe: { equipe: { id: string; nome: string; sigla: string }; media: number; total: number }[];
  porCategoria: { servico: { id: string; nome: string } | null; media: number; total: number }[];
  evolucaoMensal: { mes: string; media: number; total: number }[];
  chamadosNotaBaixa: {
    id: string;
    numero: number;
    titulo: string;
    notaSatisfacao: number;
    comentarioSatisfacao: string | null;
    status: StatusChamado;
    createdAt: string;
    solicitante: { id: string; nome: string };
    tecnico: { id: string; nome: string } | null;
    equipeAtual: { id: string; nome: string; sigla: string };
    catalogoServico: { id: string; nome: string } | null;
  }[];
}
