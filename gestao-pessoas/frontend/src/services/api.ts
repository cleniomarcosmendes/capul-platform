import axios from 'axios';

/**
 * Três instâncias, como nos outros módulos: o token é o mesmo (JWT unificado da
 * plataforma), guardado em `localStorage` pelo Hub e compartilhado por serem a
 * mesma origem.
 */
export const authApi = axios.create({ baseURL: '/api/v1/auth', timeout: 30_000 });
export const coreApi = axios.create({ baseURL: '/api/v1/core', timeout: 30_000 });
export const rhApi = axios.create({ baseURL: '/api/v1/gestao-pessoas', timeout: 30_000 });

for (const instancia of [authApi, coreApi, rhApi]) {
  instancia.interceptors.request.use((config) => {
    const token = localStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
  instancia.interceptors.response.use(
    (r) => r,
    (erro) => {
      if (erro.response?.status === 401) {
        localStorage.removeItem('accessToken');
        window.location.href = '/';
      }
      return Promise.reject(erro);
    },
  );
}

/** true quando o backend recusou por PERMISSÃO — repetir não resolve. */
export function ehFaltaDePermissao(erro: unknown): boolean {
  return (erro as { response?: { status?: number } }).response?.status === 403;
}

/** Mensagem que o backend mandou — nunca "erro desconhecido" quando há texto. */
export function mensagemDoErro(erro: unknown, padrao = 'Não foi possível concluir.'): string {
  const resposta = (erro as { response?: { data?: { message?: string | string[] } } }).response;
  const m = resposta?.data?.message;
  if (Array.isArray(m)) return m.join(' ');
  return m || padrao;
}

// ---------------------------------------------------------------------------
// Contratos — redeclarados aqui porque a plataforma não tem geração de client
// (ver o dossiê de arquitetura, §4.7). Mudou no backend, muda aqui.
// ---------------------------------------------------------------------------

export type StatusAvaliacao = 'PENDENTE' | 'EM_ANDAMENTO' | 'ENVIADA' | 'CANCELADA';

export interface ItemDaFila {
  id: string;
  avaliadoId: string;
  nome: string;
  matricula: string;
  cargo: string | null;
  centroCusto: string | null;
  aplicacao: string;
  /** A fila NÃO é de um ciclo só — podem existir dois abertos ao mesmo tempo. */
  ciclo: { id: string; nome: string; prazo: string; status: string };
  status: StatusAvaliacao;
  enviadaEm: string | null;
  perguntasTotal: number;
  perguntasRespondidas: number;
  /** true quando é a avaliação do próprio usuário — aparece, mas não abre. */
  restrita: boolean;
  motivoRestricao?: string;
}

export interface Alternativa {
  id: string;
  descricao: string;
}
export interface Pergunta {
  id: string;
  enunciado: string;
  alternativas: Alternativa[];
  alternativaEscolhidaId: string | null;
}
export interface GrupoDePerguntas {
  id: string;
  titulo: string;
  perguntas: Pergunta[];
}
export interface Questionario {
  id: string;
  status: StatusAvaliacao;
  observacaoAvaliador: string | null;
  /** ⚠️ De QUAL ciclo é esta avaliação, e até quando. Com dois ciclos abertos a
   *  mesma pessoa aparece duas vezes na fila, com cartões idênticos. */
  ciclo: { id: string; nome: string; prazo: string };
  aplicacao: string;
  avaliado: { nome: string; matricula: string; cargo: string | null };
  perguntasTotal: number;
  perguntasRespondidas: number;
  grupos: GrupoDePerguntas[];
}

export const avaliacoes = {
  minhas: () => rhApi.get<ItemDaFila[]>('/avaliacoes/minhas').then((r) => r.data),
  abrir: (id: string) => rhApi.get<Questionario>(`/avaliacoes/${id}`).then((r) => r.data),
  responder: (id: string, perguntaId: string, alternativaId: string) =>
    rhApi.post(`/avaliacoes/${id}/respostas`, { perguntaId, alternativaId }).then((r) => r.data),
  enviar: (id: string, observacao?: string) =>
    rhApi.post<{ notaAvaliacao: number }>(`/avaliacoes/${id}/enviar`, { observacao }).then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Telas do RH — ciclos, aplicações, designação, painel e resultados.
// ---------------------------------------------------------------------------

export type StatusCiclo = 'RASCUNHO' | 'ABERTO' | 'EM_APURACAO' | 'ENCERRADO' | 'CANCELADO';

export interface Conceito {
  id: string;
  descricao: string;
  limiteInferior: string | number;
  limiteSuperior: string | number;
  cor: string | null;
  ordem: number;
}

export interface CicloDaLista {
  id: string;
  nome: string;
  status: StatusCiclo;
  periodoInicio: string;
  periodoFim: string;
  dataBase: string;
  janelaTreinamentoMeses: number;
  incluirAfastados: boolean;
  valeParaMerito: boolean;
  /** Preenchidos conforme o ciclo anda — a tela usa para dizer desde quando. */
  abertoEm: string | null;
  encerradoEm: string | null;
  reabertoEm: string | null;
  motivoReabertura: string | null;
  _count: { aplicacoes: number; avaliacoes: number };
  /** Não enviadas — é o que `encerrar` exige que seja zero. */
  avaliacoesPendentes: number;
}

/**
 * ⚠️ `_count` NÃO é omitido: a base do ciclo (quantas avaliações ele tem) é o
 * que qualifica a média da tela de Resultados. Ver §3.1.8 do ESTADO.
 */
export interface CicloDetalhado extends Omit<CicloDaLista, 'avaliacoesPendentes'> {
  conceitos: Conceito[];
  aplicacoes: {
    id: string;
    nome: string;
    pesoAvaliacao: string | number;
    modeloVersao: { versao: number; modelo: { nome: string; finalidade: string } };
    criterios: { criterioId: string; peso: string | number; criterio: { nome: string; codigo: string } }[];
    centrosCusto: { id: string; filial: string | null; centroCusto: string }[];
  }[];
}

export interface NovoCiclo {
  nome: string;
  periodoInicio: string;
  periodoFim: string;
  dataBase: string;
  janelaTreinamentoMeses?: number;
  incluirAfastados?: boolean;
  valeParaMerito?: boolean;
  conceitos: { descricao: string; limiteInferior: number; limiteSuperior: number; cor?: string; ordem: number }[];
}

export const ciclos = {
  listar: () => rhApi.get<CicloDaLista[]>('/ciclos').then((r) => r.data),
  obter: (id: string) => rhApi.get<CicloDetalhado>(`/ciclos/${id}`).then((r) => r.data),
  criar: (dados: NovoCiclo) => rhApi.post<CicloDaLista>('/ciclos', dados).then((r) => r.data),
  abrir: (id: string) => rhApi.post(`/ciclos/${id}/abrir`).then((r) => r.data),
  /**
   * ⭐ `confirmarPendentes` é o contrato de 08/09, o mesmo do RDV na Logística:
   * a API recusa e diz QUANTAS faltam; a tela pergunta e reenvia com motivo, e
   * as pendentes viram CANCELADA com esse motivo escrito.
   */
  encerrar: (id: string, opcoes?: { confirmarPendentes?: boolean; motivo?: string }) =>
    rhApi.post(`/ciclos/${id}/encerrar`, opcoes ?? {}).then((r) => r.data),
  /** Reabrir exige motivo — como o reabrir de avaliação. */
  reabrir: (id: string, motivo: string) =>
    rhApi.post(`/ciclos/${id}/reabrir`, { motivo }).then((r) => r.data),
};

export interface VersaoDeModelo {
  id: string;
  versao: number;
  publicadoEm: string | null;
  pontuacaoMaxima: number | null;
  grupos: number;
  perguntas: number;
}
export interface ModeloDoCatalogo {
  id: string;
  nome: string;
  descricao: string | null;
  finalidade: 'PRODUCAO' | 'DEMONSTRACAO';
  ativo: boolean;
  versoes: VersaoDeModelo[];
}
export interface CriterioDoCatalogo {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  origem: 'CALCULADO' | 'INFORMADO';
  tipoValor: string;
  codigoCalculo: string | null;
  unidade: string | null;
  ativo: boolean;
  faixas: number;
  utilizavel: boolean;
  motivoIndisponivel: string | null;
}
export interface CentroCustoDoCatalogo {
  filial: string;
  centroCusto: string;
  descricao: string | null;
  pessoas: number;
}
export interface ColaboradorDaBusca {
  id: string;
  matricula: string;
  nome: string;
  filial: string;
  centroCusto: string | null;
  centroCustoDescricao: string | null;
  cargoDescricao: string | null;
}

export const catalogo = {
  modelos: () => rhApi.get<ModeloDoCatalogo[]>('/catalogo/modelos').then((r) => r.data),
  criterios: () => rhApi.get<CriterioDoCatalogo[]>('/catalogo/criterios').then((r) => r.data),
  centrosCusto: () => rhApi.get<CentroCustoDoCatalogo[]>('/catalogo/centros-custo').then((r) => r.data),
  colaboradores: (busca?: string) =>
    rhApi.get<ColaboradorDaBusca[]>('/catalogo/colaboradores', { params: { busca } }).then((r) => r.data),
};

export interface AplicacaoDoCiclo {
  id: string;
  nome: string;
  ordem: number;
  pesoAvaliacao: string | number;
  criterios: { criterioId: string; peso: string | number; criterio: CriterioDoCatalogo }[];
  /** Registro do ATALHO usado, não o público. Quem decide é `publico`. */
  centrosCusto: { id: string; filial: string | null; centroCusto: string }[];
  /** O público NOMINAL, com a quebra de onde cada pedaço veio. */
  publico: {
    total: number;
    origens: { origem: string; referencia: string | null; provisorio: boolean; pessoas: number }[];
    /** true quando alguma referência se declara provisória. */
    provisorio: boolean;
  };
  _count: { avaliacoes: number; publico: number };
}

export interface NovaAplicacao {
  cicloId: string;
  modeloVersaoId: string;
  nome: string;
  pesoAvaliacao: number;
  ordem?: number;
  criterios?: { criterioId: string; peso: number; ordem?: number }[];
  centrosCusto?: { filial?: string | null; centroCusto: string }[];
}

export const aplicacoes = {
  doCiclo: (cicloId: string) =>
    rhApi.get<AplicacaoDoCiclo[]>(`/aplicacoes/ciclo/${cicloId}`).then((r) => r.data),
  criar: (dados: NovaAplicacao) => rhApi.post('/aplicacoes', dados).then((r) => r.data),
};

export type MotivoExclusao =
  | 'DESLIGADO'
  | 'AFASTADO'
  | 'CARGO_SEM_AVALIADOR'
  | 'MANUAL_RH'
  | 'FORA_DO_CENTRO_CUSTO'
  | string;

export interface LinhaDaDesignacao {
  colaboradorId: string;
  matricula: string;
  nome: string;
  centroCusto: string | null;
  filial: string;
  elegivel: boolean;
  motivo: MotivoExclusao | null;
  justificativa: string | null;
  decididoManualmente: boolean;
  /** null = ninguém designado — a pendência que faz a pessoa sumir do ciclo. */
  avaliadorId: string | null;
  avaliadorNome: string | null;
  avaliacaoStatus: StatusAvaliacao | null;
  /** A linha de quem está olhando — marcada, nunca filtrada (§3.1). */
  restrita?: boolean;
  motivoRestricao?: string;
  /**
   * ⭐ O que o "Excluir" desta linha vai fazer, derivado no BACKEND. A tela
   * apenas MOSTRA a frase — não a monta. Regra montada na tela envelhece
   * separada da regra que decide (§3.1.16).
   */
  efeitoDoExcluir: {
    acao: 'CANCELAR' | 'NADA_A_FAZER' | 'RECUSAR';
    frase: string | null;
  };
}

export const designacao = {
  listar: (aplicacaoId: string) =>
    rhApi.get<LinhaDaDesignacao[]>(`/designacao/aplicacao/${aplicacaoId}`).then((r) => r.data),
  decidir: (cicloId: string, colaboradorId: string, decisao: 'INCLUIR' | 'EXCLUIR', justificativa: string) =>
    rhApi
      .post(`/designacao/ciclo/${cicloId}/decisao`, { colaboradorId, decisao, justificativa })
      .then((r) => r.data),
  // O backend grava origem MANUAL — não existe designação automática por
  // centro de custo hoje, porque o cadastro não tem quem é o superior de quem.
  designar: (
    aplicacaoId: string,
    avaliadoId: string,
    avaliadorId: string,
    confirmarTrocaDeAvaliador = false,
  ) =>
    rhApi
      .post(`/designacao/aplicacao/${aplicacaoId}/designar`, {
        avaliadoId,
        avaliadorId,
        confirmarTrocaDeAvaliador,
      })
      .then((r) => r.data),
  /**
   * ⭐ O que o botão vai fazer com CADA um dos selecionados, calculado pelo
   * BACKEND — pela mesma função que o `designar` usa para decidir. A tela não
   * recalcula quantos serão substituídos (§3.1.22).
   */
  previaDaDesignacao: (aplicacaoId: string, avaliadoIds: string[], avaliadorId: string) =>
    rhApi
      .post<PreviaDaDesignacao>(`/designacao/aplicacao/${aplicacaoId}/designar/previa`, {
        avaliadoIds,
        avaliadorId,
      })
      .then((r) => r.data),
};

export type AcaoDaDesignacao =
  | 'CRIAR'
  | 'SUBSTITUIR'
  | 'NADA_A_FAZER'
  /** Substituiria o avaliador de avaliação já respondida — permitido, com aviso. */
  | 'EXIGE_CONFIRMACAO'
  | 'RECUSAR';

export interface PreviaDaDesignacao {
  avaliadorNome: string | null;
  total: number;
  criar: number;
  substituir: number;
  nadaAFazer: number;
  recusar: number;
  /**
   * ⭐ O quinto balde. São cinco ações; por um tempo só quatro tinham contador e
   * `EXIGE_CONFIRMACAO` só existia dentro da frase de `avisoDeRespondidas` — o
   * resumo dizia "0 ganham · 0 SUBSTITUÍDO" e o botão aplicava 1.
   * Invariante (com teste no backend):
   * `criar + substituir + nadaAFazer + recusar + exigeConfirmacao === total`.
   */
  exigeConfirmacao: number;
  /** A explicação do grupo, escrita UMA vez pelo backend. `null` quando não há. */
  avisoDeRespondidas: string | null;
  linhas: {
    colaboradorId: string;
    nome: string;
    matricula: string;
    acao: AcaoDaDesignacao;
    avaliadorAtual: string | null;
    /** Estado em uma linha ("ENVIADA por JOÃO"), para a lista não repetir a frase. */
    estadoAtual: string | null;
    frase: string | null;
  }[];
}

export interface ProgressoDaAplicacao {
  aplicacaoId: string;
  nome: string;
  designados: number;
  enviadas: number;
  emAndamento: number;
  pendentes: number;
  canceladas: number;
  semDesignacao: number;
}
export interface FilaDoAvaliador {
  avaliadorId: string;
  nome: string;
  matricula: string;
  total: number;
  enviadas: number;
  aFazer: number;
}
export interface PessoaForaDoCiclo {
  colaboradorId: string;
  matricula: string;
  nome: string;
  filial: string;
  centroCusto: string | null;
  centroCustoDescricao: string | null;
}

export interface PainelDoCiclo {
  ciclo: { id: string; nome: string; status: StatusCiclo; periodoInicio: string; periodoFim: string; dataBase: string };
  designados: number;
  enviadas: number;
  aFazer: number;
  semDesignacao: number;
  /** De onde vem o "sem designação" — evita a subtração errada entre as telas. */
  semDesignacaoPorOrigem: { jaTemNoCadastro: number; nemNoCadastro: number };
  /**
   * ⚠️ Existe no backend desde 06/09 e NÃO era renderizado — o contrato do
   * cliente não tinha o campo, então a contagem "quem o ciclo não enxerga"
   * chegava e era descartada em silêncio.
   */
  foraDeTodasAsAplicacoes: { total: number; pessoas: PessoaForaDoCiclo[] };
  aplicacoes: ProgressoDaAplicacao[];
  avaliadores: FilaDoAvaliador[];
}

export interface AlertaAgregado {
  criterioCodigo: string;
  criterioNome: string;
  motivo: 'SEM_FAIXA' | 'SEM_VALOR_INFORMADO' | 'SEM_DADO_CADASTRAL';
  escopo: 'CONFIGURACAO' | 'INDIVIDUAL';
  pessoas: number;
  valores: string[];
  resumo: string;
}
export interface Conferencia {
  avaliacoesApuradas: number;
  semNotaDeAvaliacao: number;
  alertas: AlertaAgregado[];
}

export interface ProximoPassoDoCiclo {
  /** ⚠️ `ACOMPANHAR` é o único que NÃO manda fazer nada — diz de quem é a vez. */
  codigo:
    | 'MONTAR_APLICACAO'
    | 'MONTAR_PUBLICO'
    | 'DESIGNAR'
    | 'ABRIR'
    | 'ACOMPANHAR'
    | 'APURAR'
    | 'ENCERRAR';
  /** Frase pronta, com o número dentro — a tela NÃO monta texto (a regra é do backend). */
  rotulo: string;
  aba: 'aplicacoes' | 'designacao' | 'painel' | null;
}

/** A linha de estado do cabeçalho do ciclo. */
/**
 * ⭐ RELATÓRIO, não cópia do ciclo. `status` e `encerradoEm` saíram daqui em
 * 08/09: são atributos gravados na linha do ciclo, e o dono deles é
 * `ciclos.obter`. Aqui ficam só as contagens e o que é derivado agora.
 */
export interface ResumoDoCiclo {
  aplicacoes: number;
  /** TODAS as linhas de público montadas, inclusive as já tiradas do ciclo. */
  noPublico: number;
  /**
   * ⭐ Quantas dessas o RH tirou do ciclo. Sem este termo o cabeçalho não fecha:
   * designados + sem avaliador não somam `noPublico`, e quem lê procura o erro.
   */
  foraDoCiclo: number;
  designados: number;
  semDesignacao: number;
  enviadas: number;
  aFazer: number;
  apuradas: number;
  /** `null` quando não há passo óbvio — e aí a tela não mostra nada. */
  proximoPasso: ProximoPassoDoCiclo | null;
  /**
   * ⭐ O que falta para ABRIR, só em RASCUNHO (`null` nos outros estados).
   * ⚠️ Vem da MESMA função que a API roda no clique de abrir — a tela não tem
   * versão própria da regra, senão diria "pode abrir" e a API recusaria.
   */
  pendenciasParaAbrir: string[] | null;
  /** Quantas vezes o ciclo já foi reaberto — a tabela guarda só a última. */
  reaberturas: number;
  ultimaReabertura: { em: string; por: string | null; motivo: string | null } | null;
}

export interface PreviaDaAbertura {
  /** Vazio = a abertura passa. Mesma função que a API roda no clique. */
  problemas: string[];
  totalAplicacoes: number;
  noPublico: number;
  /** Avaliações que já existem e serão liberadas — abrir NÃO cria nenhuma. */
  designados: number;
  semAvaliador: number;
  /** No público e fora pela régua do ciclo — o caso de borda da contagem. */
  barradosPelaRegua: number;
  aplicacoesProvisorias: number;
}

export const painel = {
  previaDaAbertura: (cicloId: string) =>
    rhApi
      .get<PreviaDaAbertura>(`/painel/ciclo/${cicloId}/previa-da-abertura`)
      .then((r) => r.data),
  resumo: (cicloId: string) =>
    rhApi.get<ResumoDoCiclo>(`/painel/ciclo/${cicloId}/resumo`).then((r) => r.data),
  doCiclo: (cicloId: string) => rhApi.get<PainelDoCiclo>(`/painel/ciclo/${cicloId}`).then((r) => r.data),
  pendencias: (cicloId: string) =>
    rhApi.get<Conferencia>(`/painel/ciclo/${cicloId}/pendencias`).then((r) => r.data),
};

export interface LinhaDeResultado {
  id: string;
  avaliacaoId: string;
  avaliadoId: string;
  nome: string;
  matricula: string;
  cargo: string | null;
  centroCusto: string | null;
  filial: string | null;
  aplicacao: string;
  notaAvaliacao: number;
  notaCriterios: number | null;
  notaFinal: number;
  conceito: string | null;
  houveRenormalizacao: boolean;
  calculadoEm: string;
  restrita?: boolean;
  motivoRestricao?: string;
}

export interface MemoriaDeCalculo {
  id: string;
  ciclo: { nome: string; dataBase: string };
  aplicacao: string;
  avaliado: { nome: string; matricula: string; cargo: string | null; centroCusto: string | null };
  avaliador: { nome: string; matricula: string };
  enviadaEm: string | null;
  observacaoAvaliador: string | null;
  notaAvaliacao: number;
  pesoAvaliacao: number;
  notaCriterios: number | null;
  notaFinal: number;
  conceito: string | null;
  houveRenormalizacao: boolean;
  calculadoEm: string;
  porGrupo: { grupoId: string; titulo: string; nota: number; peso: number; ordem: number }[];
  criterios: {
    criterioId: string;
    nome: string;
    valorBruto: number | null;
    valorTexto: string | null;
    /** Texto da faixa em que o valor caiu — o RÓTULO, separado da pontuação. */
    faixaRotulo: string | null;
    unidade: string | null;
    tipoValor: string | null;
    pontuacao: number | null;
    peso: number;
    semDado: boolean;
  }[];
}

export const resultados = {
  doCiclo: (cicloId: string) =>
    rhApi.get<LinhaDeResultado[]>(`/resultados/ciclo/${cicloId}`).then((r) => r.data),
  memoria: (id: string) => rhApi.get<MemoriaDeCalculo>(`/resultados/${id}`).then((r) => r.data),
};

export const apuracao = {
  doCiclo: (cicloId: string) =>
    rhApi.post<Conferencia>('/apuracao', { tipo: 'CICLO', cicloId }).then((r) => r.data),
};

// ---------------------------------------------------------------------------
// CADASTRO DE QUEM AVALIA QUEM — `rh.designacao_padrao`.
// Da PLATAFORMA, não do ciclo: cada ciclo copia daqui.
// ---------------------------------------------------------------------------

export interface PessoaSemAvaliador {
  colaboradorId: string;
  matricula: string;
  nome: string;
  filial: string;
  centroCusto: string | null;
  centroCustoDescricao: string | null;
  cargo: string | null;
}

export interface PendenciasDoCadastro {
  semAvaliador: {
    total: number;
    grupos: { chave: string; descricao: string | null; pessoas: PessoaSemAvaliador[] }[];
  };
  naoRevisadas: {
    total: number;
    avaliadores: { avaliadorId: string; nome: string; quantos: number }[];
  };
  totais: { elegiveis: number; comAvaliador: number; avaliadores: number; provisorias: number };
}

export interface CartaoDeAvaliador {
  avaliadorId: string;
  nome: string;
  matricula: string;
  filial: string;
  cargo: string | null;
  area: string | null;
  total: number;
  naoRevisadas: number;
  provisorias: number;
}

export interface LinhaDaLista {
  id: string;
  colaboradorId: string;
  nome: string;
  matricula: string;
  filial: string;
  cargo: string | null;
  area: string | null;
  origem: string;
  origemReferencia: string | null;
  naoRevisada: boolean;
  provisorio: boolean;
  observacao: string | null;
  vigenciaInicio: string;
  importacaoId: string | null;
  /**
   * ⚠️ A linha do próprio usuário vem MARCADA, nunca filtrada. Aqui ela diz
   * "quem avalia você" — e traz o botão "Tirar". O campo é opcional só por
   * retrocompatibilidade de contrato; o backend sempre manda.
   */
  restrita?: boolean;
  motivoRestricao?: string;
}

export interface PreviaDaImportacao {
  conferencia: string;
  linhasNoArquivo: number;
  linhasSemAvaliador: number;
  centrosCusto: {
    chave: string;
    descricao: string | null;
    pessoas: number;
    divisao: { avaliador: string; matricula: string; quantos: number }[];
    porDivisaoAutomatica: boolean;
  }[];
  pares: {
    total: number;
    novos: number;
    inalterados: number;
    substituira: number;
    porDivisaoAutomatica: number;
  };
  conflitosComAjusteManual: {
    matricula: string;
    nome: string;
    avaliadorAtual: string;
    avaliadorDaPlanilha: string;
    centroCusto: string;
  }[];
  recusas: { numero: number; motivo: string; detalhe: string }[];
  avisos: string[];
}

export interface LoteDeImportacao {
  id: string;
  arquivoNome: string;
  linhasNoArquivo: number;
  paresGravados: number;
  criadoEm: string;
  desfeitoEm: string | null;
}

/** O que o vínculo do cadastro muda num ciclo ABERTO. Espelha o backend. */
export type SituacaoNoCiclo =
  | 'JA_REFLETE'
  | 'SEM_AVALIACAO'
  | 'FORA_DO_PUBLICO'
  | 'FORA_PELA_REGUA'
  | 'FORA_POR_DECISAO_RH'
  | 'OUTRO_AVALIADOR'
  | 'OUTRO_AVALIADOR_MANUAL'
  | 'JA_RESPONDIDA';

export interface SituacaoDoVinculoNoCiclo {
  cicloId: string;
  cicloNome: string;
  situacao: SituacaoNoCiclo;
  /** ⚠️ Vem do backend — a tela ordena por ele e não re-deriva a regra. */
  pedeAcao: boolean;
  avaliadorAtual: string | null;
  justificativa: string | null;
  respostas: number;
  statusAvaliacao: string | null;
}

export interface VinculoCriado {
  id: string;
  avaliadorId: string;
  avaliadoId: string;
  avaliadoNome: string;
  avaliadorNome: string;
  ciclos: SituacaoDoVinculoNoCiclo[];
}

export const cadastroAvaliadores = {
  pendencias: () =>
    rhApi.get<PendenciasDoCadastro>('/designacao-padrao/pendencias').then((r) => r.data),
  avaliadores: () =>
    rhApi.get<CartaoDeAvaliador[]>('/designacao-padrao/avaliadores').then((r) => r.data),
  listaDe: (avaliadorId: string) =>
    rhApi.get<LinhaDaLista[]>(`/designacao-padrao/avaliadores/${avaliadorId}`).then((r) => r.data),
  /**
   * Cria o vínculo do CADASTRO — e devolve o que ele muda (ou não) em cada ciclo
   * ABERTO, porque o cadastro não toca ciclo já aberto. Ver `AvisoDosCiclos`.
   */
  designar: (avaliadorId: string, avaliadoId: string, observacao?: string) =>
    rhApi
      .post<VinculoCriado>('/designacao-padrao', { avaliadorId, avaliadoId, observacao })
      .then((r) => r.data),
  remover: (id: string) => rhApi.delete(`/designacao-padrao/${id}`).then((r) => r.data),
  revisar: (ids: string[]) =>
    rhApi
      .post<{ revisadas: number; pedidas: number }>('/designacao-padrao/revisar', { ids })
      .then((r) => r.data),
  /** Prévia OBRIGATÓRIA — não grava nada e devolve a conferência do arquivo. */
  previa: (conteudo: string, substituirAjustesManuais: boolean) =>
    rhApi
      .post<PreviaDaImportacao>('/designacao-padrao/importacao/previa', {
        conteudo,
        substituirAjustesManuais,
      })
      .then((r) => r.data),
  importar: (
    conteudo: string,
    arquivoNome: string,
    conferencia: string,
    substituirAjustesManuais: boolean,
    /** Padrão true: lista de quem conhece a estrutura ≠ decisão do RH. */
    provisorio: boolean,
  ) =>
    rhApi
      .post<PreviaDaImportacao & { importacaoId: string }>('/designacao-padrao/importacao', {
        conteudo,
        arquivoNome,
        conferencia,
        substituirAjustesManuais,
        provisorio,
      })
      .then((r) => r.data),
  importacoes: () =>
    rhApi.get<LoteDeImportacao[]>('/designacao-padrao/importacoes').then((r) => r.data),
  desfazer: (id: string) =>
    rhApi
      .post<{ encerradas: number; revisadasAMao: number; aviso: string }>(
        `/designacao-padrao/importacoes/${id}/desfazer`,
        {},
      )
      .then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Copiar o cadastro da plataforma para a designação do ciclo.
// ---------------------------------------------------------------------------

export type MotivoNaoAplicada =
  /** Sem cadastro E sem avaliação — a única que significa ficar de fora. */
  | 'SEM_AVALIADOR_NO_CADASTRO'
  /** Sem cadastro, mas já designada no ciclo: segue como está (§3.1.20). */
  | 'SEM_CADASTRO_JA_DESIGNADA'
  | 'AJUSTE_MANUAL_DO_CICLO'
  | 'JA_RESPONDIDA'
  | 'TROCA_DE_APLICACAO';

export interface RelatorioDaCopia {
  cicloId: string;
  /** false = prévia; nada foi gravado. */
  aplicado: boolean;
  substituirManuais: boolean;
  criar: number;
  atualizar: number;
  jaIguais: number;
  deDivisaoNaoRevisada: number;
  naoAplicadas: {
    colaboradorId: string;
    nome: string;
    matricula: string;
    centroCusto: string | null;
    motivo: MotivoNaoAplicada;
    detalhe: string;
  }[];
  porMotivo: Partial<Record<MotivoNaoAplicada, number>>;
  porAplicacao: {
    aplicacaoId: string;
    nome: string;
    publico: number;
    criar: number;
    atualizar: number;
    jaIguais: number;
    semAvaliador: number;
    naoAplicadas: number;
  }[];
  avisos: string[];
  duracaoMs?: number;
}

export const copiaDoCadastro = {
  previa: (cicloId: string, substituirManuais: boolean) =>
    rhApi
      .post<RelatorioDaCopia>(`/designacao/ciclo/${cicloId}/copiar-do-cadastro`, {
        aplicar: false,
        substituirManuais,
      })
      .then((r) => r.data),
  aplicar: (cicloId: string, substituirManuais: boolean) =>
    rhApi
      .post<RelatorioDaCopia>(`/designacao/ciclo/${cicloId}/copiar-do-cadastro`, {
        aplicar: true,
        substituirManuais,
      })
      .then((r) => r.data),
};

// ---------------------------------------------------------------------------
// O público NOMINAL da aplicação. Centro de custo e filial são ATALHOS de
// preenchimento: escolhe, traz as pessoas, ajusta, salva a lista resultante.
// ---------------------------------------------------------------------------

export interface PessoaDoPublico {
  id: string;
  colaboradorId: string;
  nome: string;
  matricula: string;
  filial: string;
  cargo: string | null;
  centroCusto: string | null;
  area: string | null;
  situacao: string | null;
  origem: string;
  origemReferencia: string | null;
  provisorio: boolean;
  /** Marca, nunca filtra — a linha do próprio usuário no público da aplicação. */
  restrita?: boolean;
  motivoRestricao?: string;
}

export interface AlvoDoPublico {
  origem: 'CENTRO_CUSTO' | 'FILIAL' | 'MANUAL';
  referencia?: string;
  centrosCusto?: { filial?: string | null; centroCusto: string }[];
  filiais?: string[];
  colaboradorIds?: string[];
  provisorio?: boolean;
}

export interface PreviaDoPublico {
  aplicacaoId: string;
  aplicacaoNome: string;
  encontradas: number;
  adicionar: number;
  jaNesta: number;
  /** ⭐ Ninguém em duas aplicações do mesmo ciclo — o aviso vem ANTES de salvar. */
  emOutraAplicacao: { colaboradorId: string; nome: string; matricula: string; aplicacao: string }[];
  /**
   * ⭐ Quantos dos que entram vão MESMO gerar avaliação. Entrar no público e
   * gerar avaliação são perguntas diferentes — a régua do ciclo decide a
   * segunda (§3.1.21).
   */
  geramAvaliacao: number;
  /** Quem entra no público e não gera avaliação, com a justificativa da RÉGUA. */
  barradosPelaRegua: { colaboradorId: string; nome: string; matricula: string; justificativa: string }[];
  amostra: { nome: string; matricula: string; area: string | null }[];
}

export const publicoDaAplicacao = {
  listar: (aplicacaoId: string) =>
    rhApi.get<PessoaDoPublico[]>(`/aplicacoes/${aplicacaoId}/publico`).then((r) => r.data),
  previa: (aplicacaoId: string, alvo: AlvoDoPublico) =>
    rhApi
      .post<PreviaDoPublico>(`/aplicacoes/${aplicacaoId}/publico/previa`, alvo)
      .then((r) => r.data),
  adicionar: (aplicacaoId: string, alvo: AlvoDoPublico) =>
    rhApi
      .post<PreviaDoPublico & { adicionadas: number }>(`/aplicacoes/${aplicacaoId}/publico`, alvo)
      .then((r) => r.data),
  remover: (aplicacaoId: string, colaboradorId: string) =>
    rhApi.delete(`/aplicacoes/${aplicacaoId}/publico/${colaboradorId}`).then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Quem está logado. O JWT traz `username` e `filialCodigo`, mas NÃO o nome nem
// o nome da filial — o Hub os pega aqui, e o módulo precisa mostrar o mesmo.
// ---------------------------------------------------------------------------

export interface UsuarioLogado {
  id: string;
  username: string;
  nome: string;
  filialAtual: { id: string; codigo: string; nome: string } | null;
}

export const usuarioLogado = {
  carregar: () => authApi.get<UsuarioLogado>('/me').then((r) => r.data),
};
