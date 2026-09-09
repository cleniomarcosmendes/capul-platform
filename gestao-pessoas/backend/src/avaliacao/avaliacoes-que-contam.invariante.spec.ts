/**
 * ⭐⭐ INVARIANTE ESTRUTURAL — toda contagem de avaliação filtra a CANCELADA.
 *
 * ── Por que este arquivo existe, e por que não bastava o outro ──────────────
 * Em 09/09 extraí `avaliacoes-que-contam.ts` afirmando que "os sete lugares
 * usam". Eram sete de **dez**. Os três que faltaram apareceram na tela horas
 * depois: o card da lista de Ciclos ("2 aplicações · 52 avaliações") ao lado do
 * "Faltam 37 por enviar" — **dois números de fontes diferentes no mesmo
 * render** — e o chip "31 avaliações" da aba Aplicações.
 *
 * ⚠️ **Escaparam por MUDANÇA DE FORMA, não por descuido.** Eu procurei por
 * `status: { not: 'CANCELADA' }` e substituí onde achei; os três que faltaram
 * **nunca tiveram um `where`** — são `_count: { select: { avaliacoes: true } }`,
 * contagem de RELAÇÃO declarada num `select`. O grep não podia encontrá-los,
 * porque eu procurava pela regra escrita e eles são o lugar onde ela nunca foi
 * escrita. E o teste de invariante que escrevi cobria os três consumidores que
 * eu conhecia (`resumoDoCiclo`, `doCiclo`, `previaDaAbertura`) — nenhum deles
 * passa por `ciclo.listar()`.
 *
 * ⭐ **A lição, e o motivo da forma deste teste:** enumerar consumidores à mão
 * verifica os que você lembra. Varrer o FONTE verifica os que existem. É o
 * mesmo remédio de `separacao-funcoes.invariante.spec.ts`, pela mesma razão —
 * lá o furo reapareceu quatro vezes antes de virar teste.
 *
 * ⚠️ Dispensa só na lista abaixo, COM MOTIVO. Contar TODAS as avaliações é
 * legítimo em alguns lugares (auditoria, apagar em cascata, o próprio recorte
 * por status) — o que não é legítimo é fazê-lo **sem dizer**.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const RAIZ = path.join(__dirname, '..');

/**
 * ⚠️⚠️ A DISPENSA É POR CHECAGEM, NUNCA POR ARQUIVO — e isto foi aprendido aqui,
 * na primeira execução deste teste.
 *
 * A primeira versão tinha uma lista só, por arquivo. `ciclo.service.ts` entrou
 * nela por um motivo legítimo (conta PENDENTE/EM_ANDAMENTO por status explícito
 * antes de encerrar) e, com isso, ficou **isento também da checagem do
 * `_count`** — que é exatamente onde estava o defeito que originou este arquivo.
 * A mutação denunciou: restaurados os três `_count` errados, o varredor acusou
 * o `aplicacao.service.ts` e **passou batido no `ciclo.service.ts`**.
 *
 * Dispensa larga demais é um furo com aparência de decisão. Duas listas.
 */

/** Pode contar a RELAÇÃO `avaliacoes` inteira (`_count` sem `where`). */
const DISPENSA_RELACAO: Record<string, string> = {
  'avaliacao/avaliacoes-que-contam.ts':
    'é a própria regra — o único arquivo onde a forma sem filtro tem de aparecer, para ser definida',
};

/** Pode chamar `avaliacao.count()` sem citar a regra nem um status. */
const DISPENSA_COUNT: Record<string, string> = {
  'avaliacao/avaliacoes-que-contam.ts':
    'é a própria regra — o único arquivo onde a forma sem filtro tem de aparecer, para ser definida',
  'painel/painel.service.ts':
    'agrupa POR STATUS e nomeia cada um ("2 canceladas" é uma linha do cartão); ' +
    'a soma que vira denominador passa por somarQueContam',
  'ciclo/ciclo.service.ts':
    'conta PENDENTE/EM_ANDAMENTO por status explícito antes de encerrar — recorte por status é a ' +
    'própria pergunta, não um total. ⚠️ NÃO dispensa o _count dele, que é o card da lista de ciclos',
  'aplicacao/aplicacao.service.ts':
    'apagar em cascata: a pergunta é do BANCO, não do negócio — a FK de rh.avaliacao bloqueia o ' +
    'DELETE mesmo com todas canceladas, e a trilha do cancelamento (com o motivo escrito) não deve ' +
    'ser apagada. ⚠️ O _count dele CONTINUA filtrado: "já houve trabalho de avaliador?" é outra ' +
    'pergunta, e as duas convivem no mesmo método de propósito',
};

function arquivosTs(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return arquivosTs(completo);
    return e.isFile() && e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts') ? [completo] : [];
  });
}

const FONTES = arquivosTs(RAIZ).map((completo) => ({
  relativo: path.relative(RAIZ, completo).split(path.sep).join('/'),
  texto: fs.readFileSync(completo, 'utf8'),
}));

describe('invariante: contagem de avaliação filtra a cancelada', () => {
  /**
   * ⭐ A FORMA QUE ESCAPOU. `_count: { select: { avaliacoes: true } }` conta a
   * relação inteira. O `true` é o defeito; o que se quer é `{ where: … }`.
   */
  it('⭐ nenhum `_count` conta a relação `avaliacoes` sem `where`', () => {
    const culpados = FONTES.filter(({ relativo, texto }) => {
      if (DISPENSA_RELACAO[relativo]) return false;
      // `avaliacoes: true` dentro de um select de _count — em uma linha ou não.
      return /_count\s*:\s*\{[^}]*select\s*:\s*\{[^}]*\bavaliacoes\s*:\s*true/s.test(texto);
    });

    expect(culpados.map((c) => c.relativo)).toEqual([]);
  });

  /**
   * ⚠️ E a forma antiga: `prisma.avaliacao.count()` sem nenhuma menção a status
   * conta tudo. Ou usa a constante, ou recorta por status de propósito.
   */
  it('nenhum `avaliacao.count()` conta sem dizer o que conta', () => {
    const culpados: string[] = [];
    for (const { relativo, texto } of FONTES) {
      if (DISPENSA_COUNT[relativo]) continue;
      for (const trecho of texto.matchAll(/avaliacao\.count\(\s*\{(.*?)\}\s*\)/gs)) {
        const argumento = trecho[1];
        const diz = /ONDE_A_AVALIACAO_CONTA|status/.test(argumento);
        if (!diz) culpados.push(`${relativo}: ${trecho[0].slice(0, 70)}…`);
      }
    }
    expect(culpados).toEqual([]);
  });

  /**
   * A lista de dispensa não pode virar depósito: entrada sem motivo escrito é
   * exceção que ninguém revisou.
   */
  it('toda dispensa tem motivo, e o arquivo existe', () => {
    for (const lista of [DISPENSA_RELACAO, DISPENSA_COUNT]) {
      for (const [arquivo, motivo] of Object.entries(lista)) {
        expect(motivo.length).toBeGreaterThan(20);
        expect(FONTES.some((f) => f.relativo === arquivo)).toBe(true);
      }
    }
  });

  /**
   * ⚠️ A lista da RELAÇÃO é a mais perigosa das duas — é a forma que escapou —
   * e por isso ela fica minúscula de propósito. Entrada nova aqui é sinal de que
   * alguém precisa olhar o desenho, não a lista.
   */
  it('⚠️ só a própria regra dispensa a checagem do `_count`', () => {
    expect(Object.keys(DISPENSA_RELACAO)).toEqual(['avaliacao/avaliacoes-que-contam.ts']);
  });

  /**
   * ⚠️ O teste acima só vale se ele CONSEGUE ver a forma errada. Sem isto, um
   * regex que deixou de casar passaria a aprovar tudo em silêncio — que é
   * exatamente o modo de falha que este arquivo existe para tapar.
   */
  it('⚠️ o varredor reconhece a forma errada quando ela existe', () => {
    const errado = 'include: { _count: { select: { aplicacoes: true, avaliacoes: true } } },';
    expect(/_count\s*:\s*\{[^}]*select\s*:\s*\{[^}]*\bavaliacoes\s*:\s*true/s.test(errado)).toBe(true);

    const certo = '_count: { select: { avaliacoes: { where: ONDE_A_AVALIACAO_CONTA } } },';
    expect(/_count\s*:\s*\{[^}]*select\s*:\s*\{[^}]*\bavaliacoes\s*:\s*true/s.test(certo)).toBe(false);
  });
});
