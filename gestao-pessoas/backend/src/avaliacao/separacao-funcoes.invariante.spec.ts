/**
 * ⭐⭐ INVARIANTE ESTRUTURAL — todo acesso a `avaliacao` passa pela porta.
 *
 * A separação de funções vale para abrir, editar, reabrir, recalcular e
 * responder — caminhos diferentes, escritos em momentos diferentes, por pessoas
 * diferentes. Revisão caso a caso falha sempre na rota que ninguém revisou: no
 * RDV da Logística o mesmo furo reapareceu QUATRO vezes antes de virar teste.
 *
 * Este teste varre o FONTE e cobra: arquivo que toca `prisma.avaliacao` tem de
 * usar o `AvaliacaoAcessoService`. Exceção só na lista abaixo, COM MOTIVO —
 * quem dispensar precisa dizer por quê.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const RAIZ = path.join(__dirname, '..');

/**
 * Arquivo -> por que não precisa passar pela porta.
 *
 * ⚠️ Toda entrada aqui precisa dizer **de qual regra ela está fora**, não só que
 * é diferente. A separação de funções protege o ACESSO A REGISTRO INDIVIDUAL de
 * avaliação — abrir, editar, reabrir, recalcular, responder. Contagem agregada,
 * criação da designação e apuração em lote não são isso; e é por serem outra
 * coisa que passam, não por serem convenientes.
 *
 * Se uma entrada nova não couber em nenhuma dessas frases, ela é exceção NOVA à
 * regra — e aí o desenho é que precisa de revisão, não a lista.
 */
const DISPENSADOS: Record<string, string> = {
  'avaliacao/avaliacao-acesso.service.ts': 'é a própria porta',
  'common/testing/prisma-mock.ts': 'mock de teste, não acessa banco',
  'avaliacao/avaliacao.service.ts':
    'usa a porta em todo acesso individual; as demais consultas são do questionário, não da avaliação',
  'ciclo/ciclo.service.ts':
    'só CONTA avaliações pendentes antes de encerrar o ciclo — agregado, não lê o conteúdo de ninguém',
  'designacao/designacao.service.ts':
    'CRIA a designação. Ser designado não é mexer na própria avaliação: a gestora precisa ser designada ' +
    'para o superior dela receber a tarefa. Designar a si mesma como AVALIADORA é barrado no service.',
  'painel/painel.service.ts':
    'só CONTA — groupBy por status e por avaliador, e groupBy de avaliadoId para saber quem ainda ' +
    'não foi designado. Mesma frase do ciclo.service: agregado, não lê o conteúdo de ninguém. ' +
    'A separação de funções não tem o que proteger num total.',
  'aplicacao/aplicacao.service.ts':
    'só CONTA avaliações antes de tirar alguém do público da aplicação — para não deixar a ' +
    'Avaliacao órfã do recorte que a originou. Mesma frase do ciclo.service e do ' +
    'painel.service: agregado, não lê o conteúdo de ninguém.',
  'resultado/resultado.service.ts':
    'lê avaliação para MONTAR AS PLANILHAS (quem enviou cada resultado e a lista de canceladas com ' +
    'motivo) — nunca abre, edita, reabre nem recalcula registro nenhum, que é o que a porta protege. ' +
    'A separação de funções é aplicada aqui na LEITURA, por conta própria e em três pontos: a ' +
    'própria linha sai dos dois CSV; na tela ela aparece marcada e com nota, conceito e ' +
    'renormalização ZERADOS no servidor; e a memória de cálculo da própria avaliação devolve 403. ' +
    'Coberto por `resultado/propria-nota.spec.ts`. ' +
    '⚠️ Até 11/09/2026 esta dispensa afirmava que "na tela a própria linha aparece marcada" e ' +
    'parava aí — o CSV omitia e a tela mostrava a nota, o conceito e a memória. Era a mesma regra ' +
    'em duas superfícies, com uma esquecida, e o texto da dispensa é que a legitimava.',
  'apuracao/apuracao.service.ts':
    'apuração em LOTE, por ciclo ou aplicação — a exceção já acordada, com escopo guardado por ' +
    'assertEscopoReapuracaoValido (nunca por colaborador)',
};

function arquivosTs(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return arquivosTs(completo);
    return e.isFile() && e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts') ? [completo] : [];
  });
}

describe('invariante: acesso a avaliação passa pelo AvaliacaoAcessoService', () => {
  const suspeitos = arquivosTs(RAIZ)
    .map((completo) => ({
      relativo: path.relative(RAIZ, completo).split(path.sep).join('/'),
      fonte: fs.readFileSync(completo, 'utf8'),
    }))
    .filter(({ fonte }) => /prisma\.avaliacao\./.test(fonte));

  /**
   * ⭐⭐ CANÁRIO — requisito de todo teste que varre fonte, não detalhe.
   *
   * Sem ele, o dia em que `prisma.avaliacao.` deixar de aparecer com essa grafia
   * (um `const { avaliacao } = this.prisma`, um repositório novo) a lista de
   * suspeitos vem vazia e as três checagens abaixo ficam **verdes por não terem
   * lido nada** — a mesma classe do `npm test` que rodava "52 suítes, 0 testes".
   *
   * São dois níveis, e o primeiro sozinho não basta: (a) a varredura leu
   * arquivos; (b) ela ainda RECONHECE a forma que procura.
   */
  it('⚠️ a varredura leu o módulo e ainda reconhece quem toca avaliação', () => {
    // (a) leu arquivos
    expect(arquivosTs(RAIZ).length).toBeGreaterThan(30);
    // (b) ainda reconhece a forma que procura, num texto sintético
    expect(/prisma\.avaliacao\./.test('await this.prisma.avaliacao.findMany({})')).toBe(true);
    expect(/prisma\.avaliacao\./.test('await this.prisma.resposta.findMany({})')).toBe(false);
    // (c) e encontrou gente de verdade — zero suspeitos aqui seria verde por
    //     não ter lido nada, não por o módulo estar limpo.
    expect(suspeitos.length).toBeGreaterThan(0);

    /**
     * ⚠️ A primeira versão deste canário assumia que **todo dispensado toca
     * avaliação**, e reprovou apontando `common/testing/prisma-mock.ts` — que
     * está na lista e não contém `prisma.avaliacao.` (é o mock que DEFINE
     * `avaliacao`). A lista de dispensados mistura duas coisas: quem toca a
     * tabela por exceção acordada, e infraestrutura de teste. Fica registrado
     * aqui em vez de "arrumado" na lista: mexer nela é mexer na exceção da
     * separação de funções, que não se faz de passagem.
     */
  });

  it('nenhum arquivo toca prisma.avaliacao sem usar a porta', () => {
    const violacoes = suspeitos
      .filter(({ relativo }) => !DISPENSADOS[relativo])
      .filter(({ fonte }) => !/AvaliacaoAcessoService/.test(fonte))
      .map(({ relativo }) => relativo);

    expect(violacoes).toEqual([]);
  });

  it('⭐ nenhuma rota que toca avaliação dispensa o vínculo de colaborador', () => {
    // `@DispensaVinculoDeColaborador` existe porque a primeira sincronização
    // roda antes de existir colaborador algum. Se ela alcançar uma rota de
    // avaliação, a separação de funções cai junto — `req.colaborador` fica
    // vazio e `ehProprioAvaliado` passa a devolver false para todo mundo.
    const comDispensa = arquivosTs(RAIZ)
      .map((completo) => ({
        relativo: path.relative(RAIZ, completo).split(path.sep).join('/'),
        fonte: fs.readFileSync(completo, 'utf8'),
      }))
      .filter(({ fonte }) => /@DispensaVinculoDeColaborador/.test(fonte))
      .filter(({ fonte }) => /prisma\.avaliacao\.|AvaliacaoAcessoService/.test(fonte))
      .map(({ relativo }) => relativo);

    expect(comDispensa).toEqual([]);
  });

  it('a lista de dispensados não tem entrada morta', () => {
    // Dispensa que sobrou de um arquivo apagado esconde a próxima violação.
    const existentes = new Set(suspeitos.map((s) => s.relativo));
    const mortas = Object.keys(DISPENSADOS).filter(
      (d) => !existentes.has(d) && !fs.existsSync(path.join(RAIZ, d)),
    );
    expect(mortas).toEqual([]);
  });
});
