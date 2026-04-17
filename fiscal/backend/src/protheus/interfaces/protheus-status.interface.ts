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
  | 'GRAVADO'         // POST /xmlFiscal OK, SZR010+SZQ010 atualizados
  | 'JA_EXISTIA'      // Race condition: outro processo gravou entre exists e post
  | 'NAO_APLICAVEL'   // XML veio do cache Protheus, nao precisa gravar de novo
  | 'NAO_TENTADO'     // Leitura SEFAZ falhou antes da gravacao ser alcancada
  | 'FALHA_TECNICA';  // POST falhou com erro tipado ou inesperado

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
