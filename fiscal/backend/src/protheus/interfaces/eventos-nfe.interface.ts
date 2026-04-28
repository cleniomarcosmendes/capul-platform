/**
 * Contrato da API `eventosNfe` recebida em 18/04/2026.
 *
 * GET /rest/api/INFOCLIENTES/FISCAL/eventosNfe?CHAVENFEE=<44-digitos>
 *
 * Retorna timeline consolidada de eventos de uma NF-e unindo:
 *   - SPED156         — eventos SEFAZ (autorização, cancelamento, CC-e)
 *   - SPED156/CCE     — CC-e específico
 *   - SPED150         — manifestações do destinatário
 *   - SZR010          — gravação do XML no Protheus
 *   - SF1010          — entrada fiscal no Protheus
 *
 * Observação: SF1010 é tratado no CLIENTE (fiscal-backend) como alerta separado,
 * fora da timeline estrita (SPED150/156/SZR/CCE) — regra interna da CAPUL.
 */

export type OrigemEventoNfe =
  | 'SPED150'
  | 'SPED156'
  | 'SPED156/CCE'
  | 'SZR010'
  | 'SF1010'
  | (string & {}); // fallback para origens não previstas

export interface EventoNfeRaw {
  /** Formato `YYYYMMDD HH:MM:SS` (timezone America/Sao_Paulo). */
  quando: string;
  origem: OrigemEventoNfe;
  tipo: string;
  /** Quem originou o evento: FORNECEDOR, CAPUL, JOB PROTHEUS, etc. */
  ator: string;
  /** Texto livre com informações contextuais (ex: `"DISTRIBUIDORA X | R$ 12.450,00"`). */
  detalhes: string;
  /**
   * Id do Evento conforme XML procEventoNFe:
   *   ID + tpEvento(6) + chave(44) + nSeqEvento(2) = 54 chars.
   * Disponibilizado em 27/04/2026. String vazia ("") para eventos que não
   * geram esse Id (ex.: SPED156 autorização original, SZR010 importação interna).
   */
  id_evento?: string;
  /**
   * Protocolo SEFAZ específico do evento (distinto do protocolo de autorização
   * da NF-e). Disponibilizado em 27/04/2026. String vazia para eventos sem
   * protocolo SEFAZ (autorização sintética, importação Protheus).
   */
  protocolo?: string;
  /**
   * XML autoral do evento (`<infEvento>` puro) codificado em base64.
   * Disponibilizado em 28/04/2026 — fecha a pendência da `<xJust>` (Justificativa
   * de Cancelamento/Op. Não Realizada/CC-e), que vive em `<infEvento><detEvento><xJust>`.
   * String vazia para eventos não-SEFAZ (SPED156 autorização original, SZR010 importação).
   */
  xmlBase64?: string;
}

export interface EventosNfeResponse {
  chave: string;
  quantidade: number;
  eventos: EventoNfeRaw[];
}

/**
 * Payload de erro 400 retornado pela API:
 *   { code: 400, message: "O parametro chaveNFe deve conter exatamente 44 digitos numericos." }
 */
export interface EventosNfeErrorBody {
  code: number;
  message: string;
}
