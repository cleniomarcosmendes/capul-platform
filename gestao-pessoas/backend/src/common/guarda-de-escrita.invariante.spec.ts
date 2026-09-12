/**
 * ⭐⭐ INVARIANTE — método que ESCREVE consulta a guarda do agregado.
 *
 * A contramedida estrutural da §3.1.88, aplicada aos quatro serviços em que um
 * furo chega em nota de gente. Nasceu de um caso concreto: escrevi
 * `versaoPublicada` para dois chamadores, e o teste de fonte apontou um
 * terceiro que eu não tinha visto. **O `grep` acha onde a regra FOI escrita; o
 * que falta é onde ela DEVERIA estar, e a linha ausente não tem nome.**
 *
 * ⚠️ **Por que varrer o fonte e não revisar caso a caso.** Revisão pega os
 * métodos que existem hoje. O que este teste protege é o método de amanhã: quem
 * acrescentar um `update` num destes serviços sem passar pela guarda **quebra a
 * suíte**, e descobre no minuto em que escreve, não no ciclo em que a nota sai
 * errada. É o padrão do `assertRdvAberto` na Logística.
 *
 * ── COMO LER UMA FALHA ──────────────────────────────────────────────────────
 * O teste NÃO diz que o método está errado — diz que **ninguém verificou**. As
 * duas saídas legítimas são: (a) chamar a guarda; (b) entrar na LISTA DE
 * EXCEÇÕES abaixo, **com a linha dizendo por quê**.
 *
 * ⚠️⚠️ **A regra da exceção, e ela é a parte cara.** Se não der para escrever
 * essa linha com convicção, **não é exceção: é furo.** Exceção mal escolhida
 * produz falso vermelho, e falso vermelho destrói a ferramenta — a suíte passa
 * a ser ignorada e aí não protege mais nada (regra 1 da §5.9).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const RAIZ = path.join(__dirname, '..');

/** Escrita no banco. `$transaction` não conta: quem escreve é o `tx.x.update`. */
const ESCREVE = /\.(create|createMany|update|updateMany|delete|deleteMany|upsert)\s*\(/;

interface Regra {
  /** Nome legível, para a mensagem da falha. */
  nome: string;
  /** O que o corpo do método precisa conter. */
  exige: RegExp;
  /**
   * Método → POR QUE ele legitimamente não passa por esta guarda.
   * ⚠️ Sem a razão escrita não entra. Ver o cabeçalho.
   */
  excecoes: Record<string, string>;
}

interface Alvo {
  arquivo: string;
  regras: Regra[];
}

const ALVOS: Alvo[] = [
  {
    // ⭐ O mais apertado dos quatro, e **zero exceções**: aqui se decide quem
    // julga quem, e um furo produz avaliação designada em ciclo que não aceita
    // designação — que só aparece quando alguém tenta responder.
    arquivo: 'designacao/designacao.service.ts',
    regras: [
      {
        nome: 'afere o ciclo (assertCicloOperavel)',
        exige: /assertCicloOperavel\s*\(/,
        excecoes: {},
      },
      {
        nome: 'consulta um classificador (efeitoDe… / efeitoDo…)',
        exige: /efeitoD[eo][A-Z]\w*\s*\(/,
        excecoes: {},
      },
    ],
  },
  {
    // ⭐ A régua. Um critério salvo sem validação devolve vazio em silêncio para
    // o ciclo inteiro — e foi aqui que o `assertCriterioSalvavel` passou seis
    // dias escrito e sem chamador (§3.1.82).
    arquivo: 'criterio/criterio.service.ts',
    regras: [
      {
        nome: 'valida o que vai ser gravado (assertSalvavel / assertFaixasValidas)',
        exige: /assert(CriterioSalvavel|Salvavel|FaixasValidas)\s*\(/,
        excecoes: {},
      },
    ],
  },
  {
    arquivo: 'aplicacao/aplicacao.service.ts',
    regras: [
      {
        nome: 'afere o estado do ciclo antes de escrever',
        exige: /assertCiclo(DaAplicacao)?Operavel\s*\(|ciclo\.status\s*!==/,
        excecoes: {},
      },
      {
        nome: 'valida a aplicação (validarAplicacao / classificador)',
        exige: /validarAplicacao\s*\(|efeitoD[eo][A-Z]\w*\s*\(|motivoParaNaoEditar\s*\(/,
        excecoes: {
          adicionarAoPublico:
            'O público não é campo da Aplicação — é tabela à parte. `validarAplicacao` confere ' +
            'nome, peso do questionário e critérios, nada do que este método toca; e a regra do ' +
            'público ("aplicação sem público não alcança ninguém") é cobrada na ABERTURA do ' +
            'ciclo, por `problemasParaAbrir`, que é o único momento em que ela decide algo. ' +
            'Rodá-la aqui recusaria incluir uma pessoa por causa de um peso que ninguém mexeu.',
          removerDoPublico:
            'Mesma razão do `adicionarAoPublico`: mexe no público, não na Aplicação. E é o ato ' +
            'de CORRIGIR — travá-lo por um problema em outro campo prenderia o erro dentro da ' +
            'aplicação, que é o oposto do que a guarda existe para fazer.',
        },
      },
    ],
  },
  {
    // ⚠️ O de lista mais longa, e por uma razão de forma: metade destes métodos
    // É a transição de estado do ciclo. Ver a exceção de cada um.
    arquivo: 'ciclo/ciclo.service.ts',
    regras: [
      {
        nome: 'afere o estado do ciclo antes de escrever',
        exige: /assertCiclo\w+\s*\(|ciclo\.status\s*[!=]==/,
        excecoes: {
          criar:
            'Não há ciclo ainda — este é o método que o cria. Não existe estado a aferir, e o ' +
            'que precisa ser validado (o período) é validado por `validarPeriodo`.',
          marcarRecorte:
            'Escreve RÓTULO, não dado: `ehRecorte` declara se o ciclo alcança a empresa inteira ' +
            'ou só um recorte, e não move avaliação, designação, público nem nota — muda o que o ' +
            'painel AFIRMA sobre quem ficou fora de todas as aplicações. O estado do ciclo é a ' +
            'guarda errada para ele: encerrado trava o que altera resultado, e travar isto ' +
            'deixaria um ciclo fechado dizendo "664 pessoas fora" em vermelho para sempre, sem ' +
            'caminho de conserto — *guarda que impede o conserto é pior que guarda ausente*. ' +
            'O caso que obriga é o `ENSAIO PILOTO`, que nasceu antes da coluna. ' +
            '⚠️ Escrever sem aferir estado é aceitável AQUI porque o método faz uma coisa só e ' +
            'a coluna é dele: se um dia ele passar a escrever qualquer outro campo, esta linha ' +
            'deixa de valer e a exceção tem de cair. Coberto por `ciclo/alcance-do-ciclo.spec.ts`.',
        },
      },
    ],
  },
];

function corpoDosMetodos(fonte: string): { nome: string; corpo: string }[] {
  // Métodos de topo da classe: dois espaços de indentação.
  const partes = fonte.split(/\n  (?=(?:private |public |protected )?(?:async )?[a-zA-Z_]\w*\()/);
  return partes
    .slice(1)
    .map((corpo) => {
      const m = /^(?:private |public |protected )?(?:async )?(\w+)\(/.exec(corpo);
      return m ? { nome: m[1], corpo } : null;
    })
    .filter((x): x is { nome: string; corpo: string } => x !== null);
}

/** ⚠️ Comentário citando a guarda não é chamada — é documentação. */
function semComentarios(corpo: string): string {
  return corpo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('⭐⭐ invariante — método que escreve consulta a guarda do agregado', () => {
  for (const alvo of ALVOS) {
    describe(alvo.arquivo, () => {
      const fonte = fs.readFileSync(path.join(RAIZ, alvo.arquivo), 'utf8');
      const metodos = corpoDosMetodos(fonte).map((m) => ({ ...m, corpo: semComentarios(m.corpo) }));
      const queEscrevem = metodos.filter((m) => ESCREVE.test(m.corpo));

      /**
       * ⚠️ Sem isto o arquivo inteiro pode passar por acidente: um `split` que
       * deixe de casar (uma refatoração que troque a indentação, por exemplo)
       * devolve zero métodos e **todas as regras ficam verdes**. Verde por
       * ausência de leitura é o pior resultado possível num teste de guarda.
       */
      it('a varredura encontrou métodos que escrevem', () => {
        expect(queEscrevem.length).toBeGreaterThan(0);
      });

      for (const regra of alvo.regras) {
        it(regra.nome, () => {
          const semGuarda = queEscrevem
            .filter((m) => !regra.exige.test(m.corpo))
            .filter((m) => !(m.nome in regra.excecoes))
            .map((m) => m.nome);
          expect(semGuarda).toEqual([]);
        });

        /**
         * ⭐ A exceção também envelhece. Quando um método excetuado passar a
         * chamar a guarda (ou deixar de escrever), a linha que explica o porquê
         * vira ficção — e ninguém tem motivo para reler a lista.
         */
        it(`${regra.nome} — nenhuma exceção sobrando`, () => {
          const nomes = new Set(queEscrevem.map((m) => m.nome));
          const obsoletas = Object.keys(regra.excecoes).filter(
            (n) => !nomes.has(n) || regra.exige.test(queEscrevem.find((m) => m.nome === n)!.corpo),
          );
          expect(obsoletas).toEqual([]);
        });
      }
    });
  }

  /** Toda exceção tem razão escrita, e razão de uma linha não é razão. */
  it('⚠️ toda exceção traz o POR QUÊ, com texto suficiente para ser julgado', () => {
    const fracas: string[] = [];
    for (const alvo of ALVOS) {
      for (const regra of alvo.regras) {
        for (const [metodo, razao] of Object.entries(regra.excecoes)) {
          if (razao.trim().length < 80) fracas.push(`${alvo.arquivo}#${metodo}`);
        }
      }
    }
    expect(fracas).toEqual([]);
  });
});
