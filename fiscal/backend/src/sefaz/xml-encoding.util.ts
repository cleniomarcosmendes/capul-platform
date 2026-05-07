import { Logger } from '@nestjs/common';

const logger = new Logger('XmlEncodingUtil');

export interface DecodeResult {
  /** XML decodificado (sempre como string JS unicode-correta). */
  xml: string;
  /** true quando o buffer original NAO era UTF-8 valido — caiu pra fallback latin1. */
  encodingAnomaly: boolean;
}

/**
 * Decode robusto de bytes XML que vem do SEFAZ ou Protheus.
 *
 * Bug detectado em 07/05/2026: emitentes (ex: VEJA GAS LTDA) geram XML com
 * declaracao `encoding="UTF-8"` mas bytes em ISO-8859-1 (`í` = 0xED, `ã` =
 * 0xE3, `ç` = 0xE7). SEFAZ aceita esses XMLs (nao valida encoding declarado
 * vs real). Quando nosso pipeline fazia `buffer.toString('utf8')`, Node
 * substituia bytes invalidos por U+FFFD (replacement char `�`), perdendo os
 * caracteres acentuados na razao social, logradouro, municipio, etc.
 *
 * Estrategia:
 *   1. Tentar TextDecoder UTF-8 com `fatal: true` — lanca em bytes invalidos
 *   2. Se lancar → fallback `latin1` (aceita TODOS os bytes 0-255 — nunca
 *      lanca). Caracteres acentuados ficam corretos pois 0xED em latin1 = `í`.
 *   3. Loga warning com encoding anomaly + retorna flag pra caller decidir
 *      se persiste auditoria.
 *
 * O XML resultante (string JS unicode) eh o mesmo independente da fonte —
 * proximo `Buffer.from(xml, 'utf-8').toString('base64')` gera bytes UTF-8
 * validos pra Protheus.
 *
 * Limitacao conhecida: re-encoding muda a assinatura digital do XML em
 * relacao aos bytes originais. Mas o Protheus grvXML aceita o XML pelo
 * conteudo (parsing) — nao re-valida assinatura. Se algum cenario futuro
 * exigir bytes originais (ex: re-validacao SEFAZ), preservar Buffer
 * separadamente.
 */
export function decodeXmlBytes(
  buffer: Buffer,
  context = 'desconhecido',
): DecodeResult {
  // Tentativa 1: UTF-8 estrito
  try {
    const xml = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return { xml, encodingAnomaly: false };
  } catch {
    // Bytes invalidos UTF-8 → fallback latin1 (aceita qualquer byte)
    const xml = buffer.toString('latin1');
    logger.warn(
      `[xmlEncoding] ${context}: bytes nao-UTF-8 detectados, usando fallback latin1. ` +
        `Provavel emitente nao-conforme (XML com encoding="UTF-8" mas bytes latin1).`,
    );
    return { xml, encodingAnomaly: true };
  }
}
