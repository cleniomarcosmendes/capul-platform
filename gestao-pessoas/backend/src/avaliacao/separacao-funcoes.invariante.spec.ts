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
    'CONTA as pendentes antes de encerrar; e, na DEVOLUÇÃO DA FILA, lê e reabre as canceladas pelo ' +
    'encerramento — em LOTE, por ciclo, sem recorte por pessoa (mesma forma da apuracao.service). ' +
    'Reabrir está entre os atos protegidos, e passa aqui por dois motivos: ninguém consegue MIRAR ' +
    'a própria linha, porque o alvo é `status=CANCELADA + origem=ENCERRAMENTO` do ciclo inteiro; e ' +
    'devolver a avaliação de quem é o AVALIADO não lhe dá acesso a nada — devolve o trabalho para a ' +
    'fila do AVALIADOR dele. O que a prévia lê é motivo do cancelamento e se havia resposta, ' +
    'nunca nota nem conteúdo. ' +
    '⚠️ Até 12/09/2026 esta dispensa dizia apenas "só CONTA": foi escrita quando o arquivo só ' +
    'contava, e a devolução da fila entrou depois. A dispensa é por NOME DE ARQUIVO — o arquivo ' +
    'cresce e o texto fica.',
  'designacao/designacao.service.ts':
    'CRIA a designação. Ser designado não é mexer na própria avaliação: a gestora precisa ser designada ' +
    'para o superior dela receber a tarefa. Designar a si mesma como AVALIADORA é barrado no service.',
  'painel/painel.service.ts':
    'CONTA (groupBy por status, por avaliador e de avaliadoId, para saber quem falta designar) — ' +
    'a separação de funções não tem o que proteger num total. A única leitura de linha busca ' +
    '`avaliadorId` das avaliações apontadas como "não é minha equipe", para pôr NOME em quem ' +
    'avisou: é chave estrangeira virando pessoa, não o conteúdo da avaliação. ' +
    '⚠️ Até 12/09/2026 dizia "só CONTA", e esse findMany já existia.',
  'scripts/conferir-email.ts':
    'mesma frase do `conferir-estado.ts`, e pelo mesmo motivo: ferramenta de CONFERÊNCIA, só ' +
    'leitura. Um `groupBy` de `avaliadorId` para saber QUEM avalia no ciclo — precisa da lista ' +
    'de pessoas, nunca do conteúdo da avaliação de ninguém. Está em SO_AGREGA, então a frase é ' +
    'cobrada pela máquina. ' +
    '⚠️ Ele reprovou esta invariante ao nascer, como o irmão — e é assim que tem de ser: ' +
    'ferramenta que mora em `src/` é ferramenta que as varreduras LEEM (§3.1.147a).',
  'scripts/conferir-estado.ts':
    'ferramenta de CONFERÊNCIA, só leitura: dois groupBy (por status e por avaliador) para dizer ' +
    'quantas existem. Agregado, não lê o conteúdo de ninguém — e não há requisitante para a porta ' +
    'checar: inventar um usuário só para satisfazer a guarda faria a guarda registrar um acesso ' +
    'que não houve. Está em SO_AGREGA, então a frase acima é cobrada pela máquina.',
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
  'devolutiva/devolutiva.service.ts':
    'LIBERA A LEITURA em LOTE, por ciclo ou aplicação — não abre, não edita, não reabre e não ' +
    'recalcula, que é o que a porta protege. Escreve UMA coluna (`devolutivaLiberadaEm`) e não ' +
    'toca em nota nenhuma. ' +
    '⭐ E a separação de funções é aplicada AQUI, por conta própria e em dois pontos, não ' +
    'dispensada: a prévia põe a própria avaliação FORA do lote (marcada, nunca filtrada) e o ' +
    '`liberar` recusa o lote inteiro se um id próprio chegar — pelo mesmo `ehProprioAvaliado`, ' +
    'nunca por `===`. É por isto que RH_ADMIN precisa ser dado a duas pessoas. ' +
    'Coberto por `devolutiva/liberar-devolutiva.spec.ts`.',
  'apuracao/apuracao.service.ts':
    'apuração em LOTE, por ciclo ou aplicação — a exceção já acordada, com escopo guardado por ' +
    'assertEscopoReapuracaoValido (nunca por colaborador)',
};

/**
 * ⭐⭐ Dispensados que se justificam por **"agregado, não lê o conteúdo de
 * ninguém"** — a frase mais repetida da lista acima.
 *
 * Ela é uma AFIRMAÇÃO SOBRE O CÓDIGO, e até 12/09/2026 nada a conferia: a
 * dispensa é por NOME DE ARQUIVO, o arquivo cresce, e o texto fica dizendo o
 * que era verdade no dia em que foi escrito. Aconteceu três vezes —
 * `resultado.service` (11/09), `ciclo.service` e `painel.service` (12/09, este
 * commit): as três diziam "só CONTA" com um `findMany` dentro.
 *
 * Quem entra AQUI aceita que a máquina cobre a frase: em `prisma.avaliacao`,
 * só formas de contagem. Quem lê linha fica na lista de cima, com o motivo
 * escrito por extenso — o que é honesto, e continua sem verificação.
 */
const SO_AGREGA = [
  'aplicacao/aplicacao.service.ts',
  'scripts/conferir-estado.ts',
  'scripts/conferir-email.ts',
];

/** Formas de `prisma.avaliacao.X` que NÃO são contagem. */
const LE_OU_ESCREVE = /prisma\.avaliacao\.(?!count\b|groupBy\b|aggregate\b)([a-zA-Z]+)/g;

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

  it('⭐ quem foi dispensado por "só agrega" continua só agregando', () => {
    // Canário: a forma procurada ainda distingue contagem de leitura.
    expect([...'x = prisma.avaliacao.findMany()'.matchAll(LE_OU_ESCREVE)]).toHaveLength(1);
    expect([...'x = prisma.avaliacao.groupBy()'.matchAll(LE_OU_ESCREVE)]).toHaveLength(0);
    expect([...'x = prisma.avaliacao.count()'.matchAll(LE_OU_ESCREVE)]).toHaveLength(0);

    const fora: string[] = [];
    for (const relativo of SO_AGREGA) {
      const fonte = fs.readFileSync(path.join(RAIZ, relativo), 'utf8');
      for (const m of fonte.matchAll(LE_OU_ESCREVE)) fora.push(`${relativo} → ${m[0]}`);
    }
    expect(fora).toEqual([]);
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
