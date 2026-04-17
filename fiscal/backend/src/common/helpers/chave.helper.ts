/**
 * Helpers para validar e extrair informações de chaves de acesso NF-e/CT-e.
 *
 * Formato da chave (44 dígitos):
 *   cUF(2) + AAMM(4) + CNPJ(14) + modelo(2) + serie(3) + numero(9) + tpEmis(1) + cNF(8) + DV(1)
 *
 * Este helper unifica validação, extração de UF/CNPJ/data e cálculo do DV
 * módulo 11 — eliminando duplicação entre NfeService, CteService, SEFAZ clients
 * e tools de verificação.
 */

import { BadRequestException } from '@nestjs/common';

/**
 * Mapa cUF → sigla UF (padrão IBGE, usado pela chave NF-e/CT-e).
 */
export const CUF_TO_UF: Readonly<Record<string, string>> = Object.freeze({
  '12': 'AC', '27': 'AL', '13': 'AM', '16': 'AP', '29': 'BA', '23': 'CE',
  '53': 'DF', '32': 'ES', '52': 'GO', '21': 'MA', '31': 'MG', '50': 'MS',
  '51': 'MT', '15': 'PA', '25': 'PB', '26': 'PE', '22': 'PI', '41': 'PR',
  '33': 'RJ', '24': 'RN', '11': 'RO', '14': 'RR', '43': 'RS', '42': 'SC',
  '28': 'SE', '35': 'SP', '17': 'TO',
});

/**
 * Mapa inverso (sigla → cUF) para uso em builders de envelope SEFAZ.
 */
export const UF_TO_CUF: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(Object.entries(CUF_TO_UF).map(([cUF, uf]) => [uf, cUF])),
);

/**
 * Valida que a string parece uma chave (44 dígitos). Lança BadRequestException
 * com mensagem amigável se for inválida.
 */
export function assertChaveFormato(chave: string): void {
  if (!/^\d{44}$/.test(chave)) {
    throw new BadRequestException(
      `Chave de acesso inválida: esperado 44 dígitos, recebido ${chave.length}.`,
    );
  }
}

/**
 * Extrai a UF (sigla) a partir dos 2 primeiros dígitos da chave (cUF IBGE).
 * Lança BadRequestException se a chave for inválida ou o cUF desconhecido.
 */
export function ufFromChave(chave: string): string {
  assertChaveFormato(chave);
  const cUF = chave.slice(0, 2);
  const uf = CUF_TO_UF[cUF];
  if (!uf) {
    throw new BadRequestException(`Chave de acesso inválida: cUF=${cUF} não corresponde a UF conhecida.`);
  }
  return uf;
}

/**
 * Extrai o cUF IBGE a partir da sigla da UF (para builders de envelope).
 */
export function cufFromUf(uf: string): string {
  const cUF = UF_TO_CUF[uf.toUpperCase()];
  if (!cUF) {
    throw new BadRequestException(`UF desconhecida: "${uf}"`);
  }
  return cUF;
}

/**
 * Extrai o CNPJ do emitente da chave (posições 6-20, 14 dígitos).
 */
export function cnpjEmitenteFromChave(chave: string): string {
  assertChaveFormato(chave);
  return chave.slice(6, 20);
}

/**
 * Extrai o ano/mês de emissão da chave (posições 2-6 = AAMM).
 * Retorna `{ ano: 20YY, mes: MM }`.
 */
export function dataEmissaoFromChave(chave: string): { ano: number; mes: number } {
  assertChaveFormato(chave);
  const yy = parseInt(chave.slice(2, 4), 10);
  const mm = parseInt(chave.slice(4, 6), 10);
  return { ano: 2000 + yy, mes: mm };
}

/**
 * Extrai o modelo do documento fiscal (posições 20-22).
 *   55 = NF-e
 *   65 = NFC-e
 *   57 = CT-e
 *   67 = CT-e OS
 */
export function modeloFromChave(chave: string): string {
  assertChaveFormato(chave);
  return chave.slice(20, 22);
}

/**
 * Valida que a chave tem o modelo esperado (ex: '55' para NF-e, '57' para CT-e).
 * Útil para guards em controllers/services específicos.
 */
export function assertModelo(chave: string, ...modelosAceitos: string[]): void {
  const modelo = modeloFromChave(chave);
  if (!modelosAceitos.includes(modelo)) {
    throw new BadRequestException(
      `Chave não é do tipo esperado. Modelo encontrado: ${modelo}, aceitos: ${modelosAceitos.join(', ')}.`,
    );
  }
}

/**
 * Calcula o dígito verificador (módulo 11) da chave e retorna true se válido.
 *
 * Usado como validação adicional **antes** de enviar ao SEFAZ — economiza
 * round-trip quando o usuário digita errado.
 */
export function validarDvChave(chave: string): boolean {
  if (!/^\d{44}$/.test(chave)) return false;
  const corpo = chave.slice(0, 43);
  const dvInformado = parseInt(chave.slice(43), 10);

  // Pesos módulo 11: 2, 3, 4, 5, 6, 7, 8, 9, 2, 3, ... (da direita p/ esquerda)
  let soma = 0;
  let peso = 2;
  for (let i = corpo.length - 1; i >= 0; i--) {
    soma += parseInt(corpo[i] as string, 10) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dvCalculado = resto < 2 ? 0 : 11 - resto;
  return dvCalculado === dvInformado;
}

/**
 * Valida formato + DV. Lança exception específica quando o DV falha
 * (mensagem diferente de "formato inválido" para facilitar diagnóstico).
 */
export function assertChaveValida(chave: string): void {
  assertChaveFormato(chave);
  if (!validarDvChave(chave)) {
    throw new BadRequestException(
      'Chave de acesso com dígito verificador inválido. Confira se digitou ou copiou corretamente.',
    );
  }
}
