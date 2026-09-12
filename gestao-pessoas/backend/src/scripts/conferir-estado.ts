/**
 * ⭐⭐ CONFERÊNCIA DO ESTADO — pelas MESMAS RÉGUAS que o código usa.
 *
 * ── POR QUE ESTE ARQUIVO EXISTE ─────────────────────────────────────────────
 *
 * Em 12/09/2026, conferindo quem conseguiria entrar no ensaio, escrevi à mão:
 *
 *     count(*) filter (where col.situacao = 'ATIVO')
 *
 * e achei 2 de 16 avaliadores travados. Ia reportar como bloqueio. Os dois
 * estavam em **FÉRIAS** e **AFASTADO** — e `SITUACOES_ELEGIVEIS` inclui os dois.
 * Com a régua certa: 16 de 16.
 *
 * ⚠️ É o mesmo defeito que o comentário do `elegibilidade.ts` afirma e que já
 * foi corrigido uma vez no código. Em SQL de terminal ele engana pior:
 *
 *   • a constante existe e **não dá para importar**;
 *   • **nenhum teste varre**, porque a query nem está no repositório;
 *   • e o sintoma é **a conta parecer medir e medir outra coisa** — num lugar
 *     cujo resultado decide se algo está pronto.
 *
 * > ⭐ **Consulta que decide se algo está pronto não se escreve à mão no
 * > terminal.** Ou passa por aqui, ou passa por uma view que um invariante
 * > prende à constante (`v_colaborador_elegivel`).
 *
 * ── USO ─────────────────────────────────────────────────────────────────────
 *
 *   docker compose exec gestao-pessoas-backend node dist/scripts/conferir-estado.js [ciclo]
 *
 * Sem argumento, lista os ciclos. Com um pedaço do nome, confere aquele.
 *
 * ⚠️ Ele mora em `src/` e roda do `dist/` de propósito — **sem `ts-node` no
 * caminho**. O `ts-node` com `experimentalResolver` (que a regressão precisa
 * para resolver o sufixo `.js`) tropeça nos `exports` do `@prisma/client`, e
 * ferramenta de conferência que depende de um resolvedor experimental é
 * ferramenta que quebra sozinha — foi assim que a regressão quebrou (§3.1.124).
 * Como parte do build, ele é compilado pelo mesmo `tsc` do serviço: se um
 * import quebrar, **o build quebra**, que é o sinal mais alto que existe.
 *
 * ⚠️ SOMENTE LEITURA. Nenhuma escrita, nenhum efeito — dá para rodar em
 * produção sem combinar nada.
 */
import { PrismaClient } from '@prisma/client';
import { SITUACOES_ELEGIVEIS } from '../common/elegibilidade.js';
import { STATUS_VIVOS } from '../avaliacao/cancelamento.js';
import { MODULO } from '../common/roles-rh.js';
import { ONDE_A_AVALIACAO_CONTA, avaliacaoConta } from '../avaliacao/avaliacoes-que-contam.js';

const prisma = new PrismaClient();

/** As réguas, impressas no cabeçalho — quem lê o relatório vê com o que foi medido. */
function cabecalho(): string {
  return [
    'RÉGUAS EM USO (importadas do código, não escritas aqui)',
    `  SITUACOES_ELEGIVEIS ....... ${SITUACOES_ELEGIVEIS.join(', ')}`,
    `  STATUS_VIVOS .............. ${STATUS_VIVOS.join(', ')}`,
    `  ONDE_A_AVALIACAO_CONTA .... ${JSON.stringify(ONDE_A_AVALIACAO_CONTA)}`,
  ].join('\n');
}

async function listarCiclos() {
  const ciclos = await prisma.ciclo.findMany({
    orderBy: { criadoEm: 'desc' },
    select: { id: true, nome: true, status: true },
  });
  console.log('\nCICLOS:');
  for (const c of ciclos) console.log(`  ${c.status.padEnd(10)} ${c.nome}`);
  console.log('\nRode de novo com um pedaço do nome para conferir um deles.');
}

async function conferir(filtro: string) {
  const ciclo = await prisma.ciclo.findFirst({
    where: { nome: { contains: filtro, mode: 'insensitive' } },
    include: { aplicacoes: { select: { id: true, nome: true } }, conceitos: true },
  });
  if (!ciclo) {
    console.error(`Nenhum ciclo com "${filtro}" no nome.`);
    process.exitCode = 1;
    return;
  }

  console.log(`\nCICLO: ${ciclo.nome}  [${ciclo.status}]`);
  console.log('─'.repeat(72));

  // ── O PÚBLICO, pela régua certa ───────────────────────────────────────────
  const publico = await prisma.aplicacaoPublico.findMany({
    where: { cicloId: ciclo.id },
    select: { colaboradorId: true },
  });
  const ids = [...new Set(publico.map((p) => p.colaboradorId))];
  const elegiveis = await prisma.colaborador.count({
    // ⭐ A régua importada. Escrever 'ATIVO' aqui é o defeito que criou o script.
    where: { id: { in: ids }, situacao: { in: [...SITUACOES_ELEGIVEIS] } },
  });

  const porStatus = await prisma.avaliacao.groupBy({
    by: ['status'],
    where: { cicloId: ciclo.id },
    _count: { _all: true },
  });
  const conta = (s: string) => porStatus.find((x) => x.status === s)?._count._all ?? 0;
  const total = porStatus.reduce((t, x) => t + x._count._all, 0);
  const vivas = STATUS_VIVOS.reduce((t, s) => t + conta(s), 0);
  // ⭐ `avaliacaoConta` é a função da régua — não se reimplementa o filtro aqui.
  const contam = porStatus
    .filter((x) => avaliacaoConta(x.status))
    .reduce((t, x) => t + x._count._all, 0);

  console.log(`  no público (pessoas distintas) ......... ${ids.length}`);
  console.log(`    elegíveis pela régua ................ ${elegiveis}`);
  console.log(`    fora da régua ....................... ${ids.length - elegiveis}`);
  console.log(`  avaliações que existem ................ ${total}`);
  console.log(`    no público, sem avaliação criada .... ${ids.length - total}`);
  console.log(`  a fazer (STATUS_VIVOS) ................ ${vivas}`);
  console.log(`  que contam no denominador ............. ${contam}`);
  for (const x of porStatus.sort((a, b) => b._count._all - a._count._all)) {
    console.log(`      ${x.status.padEnd(14)} ${x._count._all}`);
  }

  // ── Quem consegue ENTRAR — as quatro coisas da §3.1.93 ────────────────────
  const avaliadores = await prisma.avaliacao.groupBy({
    by: ['avaliadorId'],
    where: { cicloId: ciclo.id },
  });
  const cols = await prisma.colaborador.findMany({
    where: { id: { in: avaliadores.map((a) => a.avaliadorId) } },
    select: { id: true, matricula: true, nome: true, situacao: true },
  });
  const matriculas = cols.map((c) => c.matricula);
  const usuarios = await prisma.$queryRaw<
    { matricula: string; status: string; papeis: number }[]
  >`
    SELECT u.matricula, u.status,
           count(pm.id)::int AS papeis
      FROM core.usuarios u
      LEFT JOIN core.permissoes_modulo pm ON pm.usuario_id = u.id
       AND pm.modulo_id = (SELECT id FROM core.modulos_sistema WHERE codigo = ${MODULO})
     WHERE u.matricula = ANY(${matriculas}::text[])
     GROUP BY u.matricula, u.status`;
  const porMatricula = new Map(usuarios.map((u) => [u.matricula, u]));

  /**
   * ⚠️ As QUATRO coisas (§3.1.93), na ordem em que faltam: conta, conta ativa,
   * papel no módulo, e colaborador elegível. Faltando a última, a pessoa toma
   * 403 falando de MATRÍCULA — e vai ao Configurador, onde está tudo certo.
   */
  const falta = { semConta: [] as string[], contaInativa: [] as string[], semPapel: [] as string[], foraDaRegua: [] as string[] };
  for (const c of cols) {
    const u = porMatricula.get(c.matricula);
    if (!u) falta.semConta.push(`${c.matricula} ${c.nome}`);
    else if (u.status !== 'ATIVO') falta.contaInativa.push(`${c.matricula} ${c.nome}`);
    else if (u.papeis === 0) falta.semPapel.push(`${c.matricula} ${c.nome}`);
    else if (!(SITUACOES_ELEGIVEIS as readonly string[]).includes(c.situacao)) {
      falta.foraDaRegua.push(`${c.matricula} ${c.nome} (${c.situacao})`);
    }
  }
  const entram = cols.length - Object.values(falta).reduce((t, v) => t + v.length, 0);
  console.log(`\n  AVALIADORES: ${cols.length} · conseguem entrar: ${entram}`);
  for (const [k, v] of Object.entries(falta)) {
    if (v.length === 0) continue;
    console.log(`      ${k}: ${v.length}`);
    for (const x of v) console.log(`         ${x}`);
  }

  // ── A régua de conceitos ──────────────────────────────────────────────────
  console.log(`\n  CONCEITOS: ${ciclo.conceitos.length}`);
  if (ciclo.conceitos.length === 0) {
    console.log('      ⚠️ NENHUM — a apuração não tem régua e não conclui.');
  }
}

if (require.main === module) {
  const filtro = process.argv[2];
  console.log(cabecalho());
  (filtro ? conferir(filtro) : listarCiclos())
    .catch((e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
