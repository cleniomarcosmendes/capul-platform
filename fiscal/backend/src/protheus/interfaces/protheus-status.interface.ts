/**
 * Estado granular da integracao com o Protheus durante uma consulta fiscal.
 * Compartilhado entre NfeService e CteService — ambos usam o mesmo fluxo
 * (exists → get OR sefaz → post).
 *
 * O objetivo e dar **transparencia total** ao usuario final sobre o que
 * aconteceu com a integracao Protheus em cada consulta: se foi cache, se
 * gravou, se falhou e qual foi a causa.
 */

export type ProtheusLeituraStatus =
  | 'CACHE_HIT'       // Protheus tinha o XML e devolveu
  | 'CACHE_MISS'      // Protheus respondeu que nao tem — fluxo segue para SEFAZ
  | 'NAO_CONSULTADO'  // Modo mock ou leitura desabilitada por configuracao
  | 'FALHA_TECNICA';  // Protheus retornou erro/timeout — fallback para SEFAZ

export type ProtheusGravacaoStatus =
  | 'GRAVADO'                       // POST /grvXML OK: SZR010+SZQ010 atualizados + pre-nota criada + amarracao OK
  | 'GRAVADO_PRENOTA_FALHOU'        // XML em SZR010+SZQ010 OK, mas pre-nota (U_PRENF/U_NFeSaida) falhou —
                                    //   exige conclusao manual no Protheus. Nao permite retry (08/05/2026).
  | 'GRAVADO_AGUARDANDO_AMARRACAO'  // XML em SZR010+SZQ010 OK, pre-nota OK, mas pendenteAmarracao=true —
                                    //   falta vincular o doc com pedido de compra no Protheus.
  | 'JA_EXISTIA'                    // Race condition: outro processo gravou entre exists e post
  | 'NAO_APLICAVEL'                 // XML veio do cache Protheus, nao precisa gravar de novo
  | 'NAO_TENTADO'                   // Leitura SEFAZ falhou antes da gravacao ser alcancada
  | 'FALHA_TECNICA';                // POST falhou com erro tipado ou inesperado

/**
 * Flags granulares retornadas pelo grvXML do Protheus (resp.resultados[0]).
 * Sao a fonte de verdade — o ProtheusGravacaoStatus eh derivado deles.
 */
export interface GrvXmlFlags {
  sucesso: boolean;
  xmlGravado: boolean;
  pendenteAmarracao: boolean;
  preNotaFalhou: boolean;
  mensagem: string;
}

/**
 * Deriva o ProtheusGravacaoStatus agregado a partir das 4 flags do retorno
 * do Protheus. Centraliza a logica num so lugar pra UI/backend usarem
 * coerentemente.
 *
 * Ordem de precedencia (mais grave primeiro):
 *   1. !sucesso || !xmlGravado    → FALHA_TECNICA
 *   2. preNotaFalhou               → GRAVADO_PRENOTA_FALHOU
 *   3. pendenteAmarracao           → GRAVADO_AGUARDANDO_AMARRACAO
 *   4. tudo OK                     → GRAVADO
 */
export function derivarStatusGravacao(flags: GrvXmlFlags): ProtheusGravacaoStatus {
  if (!flags.sucesso || !flags.xmlGravado) return 'FALHA_TECNICA';
  if (flags.preNotaFalhou) return 'GRAVADO_PRENOTA_FALHOU';
  if (flags.pendenteAmarracao) return 'GRAVADO_AGUARDANDO_AMARRACAO';
  return 'GRAVADO';
}

export interface ProtheusStatus {
  leitura: ProtheusLeituraStatus;
  leituraMensagem: string | null;
  leituraErro: string | null;
  gravacao: ProtheusGravacaoStatus;
  gravacaoMensagem: string | null;
  gravacaoErro: string | null;
  /** true quando o frontend deve exibir botao "Tentar gravar novamente" */
  permiteReexecucao: boolean;
  /**
   * Quando true, o service Protheus esta em modo mock (stub em memoria).
   * Nesse caso as mensagens de leitura/gravacao NAO refletem o ERP real —
   * o frontend deve exibir um aviso destacado para nao confundir o usuario.
   */
  modoMock: boolean;
  /**
   * Body JSON da última tentativa grvXML (POST /grvXML enviado ao Protheus).
   * Persistido em `documento_consulta.protheus_grv_request`. NULL quando
   * gravação ainda não foi tentada ou montagem do body falhou. Frontend
   * mostra botão "Copiar JSON" no modal de detalhe pra setor fiscal
   * autoatender debug com equipe Protheus sem precisar de SSH.
   */
  grvRequest: string | null;
}

/**
 * Traduz codigos de erro conhecidos da API Protheus em mensagens amigaveis.
 * Compartilhado entre NfeService e CteService para garantir consistencia
 * nas mensagens mostradas ao usuario.
 */
export function mapearCodigoProtheus(code: string): string {
  const map: Record<string, string> = {
    VALIDATION_ERROR: 'Os dados enviados foram rejeitados pelo Protheus (validação).',
    DATABASE_ERROR: 'O banco do Protheus recusou a gravação.',
    TIMEOUT: 'O Protheus demorou mais que o esperado para responder.',
    UNAUTHORIZED: 'Token de autenticação com o Protheus inválido ou expirado.',
    NOT_FOUND: 'Endpoint do xmlFiscal não encontrado no Protheus.',
    CONNECTION_REFUSED: 'Serviço Protheus não está aceitando conexões.',
  };
  return map[code] ?? 'Verifique com o time Protheus se a API /xmlFiscal está saudável.';
}

/**
 * Monta uma string de alerta consolidada a partir do ProtheusStatus
 * estruturado. Usada apenas para compatibilidade com o campo legado
 * `alertaProtheus` — novos consumers devem ler `protheusStatus`.
 */
export function construirAlertaLegado(status: ProtheusStatus): string | undefined {
  const partes: string[] = [];
  if (status.leitura === 'FALHA_TECNICA' && status.leituraMensagem) {
    partes.push(status.leituraMensagem);
  }
  if (status.gravacao === 'FALHA_TECNICA' && status.gravacaoMensagem) {
    partes.push(status.gravacaoMensagem);
  }
  return partes.length > 0 ? partes.join(' ') : undefined;
}
