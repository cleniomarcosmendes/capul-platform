/**
 * ⭐⭐ BOOLEANO QUE NÃO ACEITA PALPITE.
 *
 * ── O DEFEITO ───────────────────────────────────────────────────────────────
 *
 * O `ValidationPipe` do módulo roda com `enableImplicitConversion: true`, que é
 * o que faz `?pagina=2` chegar como número. O efeito colateral em BOOLEANO é
 * `Boolean(valor)`, e aí:
 *
 *   {"confirmarPendentes": "false"}  →  true
 *   {"confirmarPendentes": "talvez"} →  true
 *
 * ⚠️ **A string `"false"` liga a flag.** Medido em 12/09/2026 contra a API real.
 * A validação não pega porque ela roda DEPOIS da conversão: quando o
 * `@IsBoolean()` olha, o valor já é um booleano legítimo.
 *
 * O módulo tem 15 campos booleanos, e **três são flags de confirmação** —
 * `confirmarPendentes`, `confirmarSemFaixas`, `confirmarTrocaDeAvaliador`. Elas
 * existem porque *a API recusa para a tela poder perguntar*: quem manda a flag
 * está dizendo "eu vi o aviso e assumo". Um cliente que mandasse a string
 * `"false"` — o jeito mais natural de escrever "não confirmei" fora do nosso
 * frontend — autorizaria o ato em vez de recusá-lo, e o `confirmarPendentes`
 * CANCELA as avaliações não enviadas do ciclo.
 *
 * ⚠️ Nosso frontend manda booleano de verdade (TypeScript + JSON), então isto
 * não estava acontecendo. É buraco latente, não incidente — e é justamente a
 * forma que a tela nunca exercita: quem descobre é quem chama a API direto.
 *
 * ── A CORREÇÃO ──────────────────────────────────────────────────────────────
 *
 * Um `@Transform` próprio SUBSTITUI a conversão implícita naquele campo. Este
 * devolve o valor cru, intocado; o `@IsBoolean()` então enxerga a string e
 * recusa com 400. Não desliga a conversão implícita do módulo inteiro — o que
 * quebraria os números de query — só a desliga onde ela erra.
 */
import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';

/**
 * Booleano de corpo de requisição: aceita `true`/`false` e nada mais.
 *
 * ⚠️ NÃO usar em query string (`?ativo=true`), onde tudo chega texto e a
 * conversão é o comportamento certo — lá o valor legítimo É a string.
 */
export function BooleanoEstrito(): PropertyDecorator {
  return applyDecorators(
    /**
     * ⚠️ `obj[key]`, **não** `value`. Medido em 12/09: quando
     * `enableImplicitConversion` está ligado, a conversão de tipo acontece
     * ANTES das transformações próprias — então `value` já chega convertido
     * (`"false"` já virou `true`) e devolvê-lo intocado não conserta nada.
     * `obj` é o objeto PLANO da requisição, do jeito que veio; é a única
     * referência ao valor original que sobra depois da conversão.
     */
    Transform(({ obj, key }) => (obj as Record<string, unknown>)[key], { toClassOnly: true }),
    IsBoolean(),
  );
}
