import { BadRequestException } from '@nestjs/common';

/**
 * ⭐ Mês/ano de um filtro de indicador, validados (23/08).
 *
 * Os painéis liam `parseInt(mes)`/`Number(mes)` cru e passavam adiante. Dois estragos,
 * e o segundo é o pior:
 *
 * - `mes=abc` → NaN → `new Date` inválida → o Prisma recusa o parâmetro e a rota
 *   responde **500**. Num teste de aceitação isso parece módulo quebrado.
 * - `mes=13` / `mes=99` → **nenhum erro**: o JS rola a data para o ano seguinte e a tela
 *   mostra números de um **período errado, em silêncio**. Indicador que mente é pior que
 *   indicador que falha, porque ninguém desconfia de um número.
 *
 * Ausente = mês corrente (comportamento de sempre). Inválido = 400 com a razão.
 */
export function mesAnoDoFiltro(mes?: string, ano?: string): { m: number; a: number } {
  const agora = new Date();
  const m = mes !== undefined && mes !== '' ? Number(mes) : agora.getUTCMonth() + 1;
  const a = ano !== undefined && ano !== '' ? Number(ano) : agora.getUTCFullYear();
  if (!Number.isInteger(m) || m < 1 || m > 12) {
    throw new BadRequestException(`Mês inválido (${mes}) — use 1 a 12.`);
  }
  if (!Number.isInteger(a) || a < 2000 || a > 2100) {
    throw new BadRequestException(`Ano inválido (${ano}) — use um ano entre 2000 e 2100.`);
  }
  return { m, a };
}
