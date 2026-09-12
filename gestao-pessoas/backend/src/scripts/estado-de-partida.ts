/**
 * ⭐⭐ ESTADO DE PARTIDA DO ENSAIO INTEGRAL — o retrato que se confere DEPOIS.
 *
 * ── POR QUE ESTE ARQUIVO EXISTE ─────────────────────────────────────────────
 *
 * O ensaio integral **escreve muito**: 325 respostas, apuração, liberação e
 * conduções. Sem um retrato do antes, "algo mudou sem querer?" não tem resposta
 * — e o ensaio existe justamente para produzir confiança.
 *
 * ⭐ Ele imprime só o que **NÃO deveria mudar** com o ensaio: a montagem. O que
 * o ensaio produz (respostas, notas, marcas) fica de fora de propósito — misturar
 * as duas coisas faria o retrato mudar por motivo legítimo e perder a serventia.
 *
 * ⚠️ Rode ANTES e DEPOIS, e compare os dois. Diferença aqui é achado.
 *
 * ── USO ─────────────────────────────────────────────────────────────────────
 *
 *   docker compose exec gestao-pessoas-backend node dist/scripts/estado-de-partida.js [ciclo]
 *
 * ⚠️ SOMENTE LEITURA.
 */
import { PrismaClient } from '@prisma/client';
import { SITUACOES_ELEGIVEIS } from '../common/elegibilidade.js';
import { MODULO } from '../common/roles-rh.js';
import { ONDE_A_AVALIACAO_CONTA } from '../avaliacao/avaliacoes-que-contam.js';
import { pontuacaoMaximaDoArranjo } from '../calculo/peso-derivado.js';
import { carregarArranjo } from '../arranjo/carregar-arranjo.js';

const prisma = new PrismaClient();
const n2 = (v: unknown) => Number(v).toFixed(2);

async function main() {
  const alvo = process.argv[2] ?? 'ENSAIO';
  const ciclo = await prisma.ciclo.findFirst({
    where: { nome: { contains: alvo, mode: 'insensitive' } },
    include: { conceitos: { orderBy: { ordem: 'asc' } } },
  });
  if (!ciclo) {
    console.log(`Nenhum ciclo casa com "${alvo}".`);
    return;
  }

  console.log('═'.repeat(78));
  console.log('ESTADO DE PARTIDA — o que NÃO deve mudar com o ensaio');
  console.log(`gerado em ${new Date().toISOString()}`);
  console.log('═'.repeat(78));

  // ── 1. O CICLO ────────────────────────────────────────────────────────────
  console.log('\n1. CICLO');
  console.log(`   nome ..................... ${ciclo.nome}`);
  console.log(`   status ................... ${ciclo.status}`);
  console.log(`   período .................. ${ciclo.periodoInicio.toISOString().slice(0, 10)} a ${ciclo.periodoFim.toISOString().slice(0, 10)}`);
  console.log(`   data-base ................ ${ciclo.dataBase.toISOString().slice(0, 10)}   ⚠️ ancora TODO cálculo temporal`);
  console.log(`   janela de treinamento .... ${ciclo.janelaTreinamentoMeses} meses`);
  console.log(`   incluir afastados ........ ${ciclo.incluirAfastados}   ⚠️ é o que decide se afastado gera avaliação`);
  console.log(`   vale para mérito ......... ${ciclo.valeParaMerito}`);
  console.log(`   é RECORTE ................ ${ciclo.ehRecorte}   (declarado por quem monta, nunca derivado)`);

  // ── 2. A RÉGUA DE CONCEITOS ───────────────────────────────────────────────
  console.log(`\n2. RÉGUA DE CONCEITOS — faixas: ${ciclo.conceitos.length}`);
  for (const c of ciclo.conceitos) {
    console.log(`   ${String(c.ordem).padStart(2)}. ${c.descricao.padEnd(22)} [${n2(c.limiteInferior)} , ${n2(c.limiteSuperior)})`);
  }
  const contigua = ciclo.conceitos.every(
    (c, i) => i === 0 || Number(ciclo.conceitos[i - 1].limiteSuperior) === Number(c.limiteInferior),
  );
  console.log(`   contígua: ${contigua ? 'sim' : '⛔ NÃO'}`);

  // ── 3. PÚBLICO E AVALIAÇÕES, POR APLICAÇÃO ────────────────────────────────
  const aplicacoes = await prisma.aplicacao.findMany({
    where: { cicloId: ciclo.id },
    orderBy: { ordem: 'asc' },
    include: {
      modeloVersao: { include: { modelo: true } },
      criterios: { include: { criterio: true } },
      centrosCusto: true,
    },
  });
  const publicoPorApl = await prisma.aplicacaoPublico.groupBy({
    by: ['aplicacaoId'],
    where: { cicloId: ciclo.id },
    _count: { _all: true },
  });
  const avPorApl = await prisma.avaliacao.groupBy({
    by: ['aplicacaoId', 'status'],
    where: { cicloId: ciclo.id },
    _count: { _all: true },
  });

  console.log(`\n3. APLICAÇÕES (${aplicacoes.length})`);
  for (const a of aplicacoes) {
    const pub = publicoPorApl.find((p) => p.aplicacaoId === a.id)?._count._all ?? 0;
    const avs = avPorApl.filter((x) => x.aplicacaoId === a.id);
    const total = avs.reduce((s, x) => s + x._count._all, 0);
    console.log(`\n   ▸ ${a.nome}`);
    console.log(`     modelo/versão .......... ${a.modeloVersao.modelo.nome} v${a.modeloVersao.versao}`);
    console.log(`     peso do questionário ... ${n2(a.pesoAvaliacao)}`);
    console.log(`     centros de custo ....... ${a.centrosCusto.length}`);
    console.log(`     público ................ ${pub}`);
    console.log(`     avaliações ............. ${total}  ${avs.map((x) => `${x.status}=${x._count._all}`).join(' · ')}`);

    /**
     * ⭐ O INSTRUMENTO vem de `carregarArranjo` — a MESMA função que a avaliação
     * usa para montar as questões. Remontar aqui daria um retrato de uma conta
     * que o sistema não faz.
     */
    const arranjo = await carregarArranjo(prisma as never, a.modeloVersaoId);
    const somaDeclarada = arranjo.grupos.reduce((s, g) => s + g.peso, 0);
    const somaDerivada = arranjo.questoes.reduce((s, q) => s + q.peso, 0);
    const maxima = pontuacaoMaximaDoArranjo(
      arranjo.questoes.map((q) => ({ perguntaId: q.id, peso: q.peso })),
      new Map(arranjo.questoes.map((q) => [q.id, q.maiorValor])),
    );
    console.log(`     INSTRUMENTO: ${arranjo.grupos.length} grupos · ${arranjo.questoes.length} questões`);
    for (const g of arranjo.grupos) {
      console.log(`       ${g.titulo.slice(0, 34).padEnd(36)} peso ${n2(g.peso).padStart(6)} · ${g.questoes} questões`);
    }
    console.log(`       soma declarada (grupos) .. ${n2(somaDeclarada)}`);
    console.log(`       soma derivada (questões) . ${n2(somaDerivada)}  ${Math.abs(somaDeclarada - somaDerivada) < 0.005 ? '✅ bate' : '⛔ NÃO BATE'}`);
    console.log(`       pontuação máxima ......... ${n2(maxima)}`);
    console.log(`     CRITÉRIOS (${a.criterios.length}):`);
    for (const c of a.criterios) {
      console.log(`       ${c.criterio.codigo.padEnd(18)} peso ${n2(c.peso)} · ${c.criterio.origem} · ${c.criterio.ativo ? 'ativo' : '⛔ INATIVO'}`);
    }
    const somaPesos = Number(a.pesoAvaliacao) + a.criterios.reduce((s, c) => s + Number(c.peso), 0);
    console.log(`     soma dos pesos da nota final: ${n2(somaPesos)}`);
  }

  // ── 4. AS CONTAS DOS AVALIADORES ──────────────────────────────────────────
  const avaliadores = await prisma.avaliacao.groupBy({
    by: ['avaliadorId'],
    where: { cicloId: ciclo.id },
    _count: { _all: true },
  });
  const cols = await prisma.colaborador.findMany({
    where: { id: { in: avaliadores.map((a) => a.avaliadorId) } },
    select: { id: true, matricula: true, nome: true, situacao: true },
  });
  const usuarios = await prisma.$queryRaw<
    { matricula: string; username: string; status: string; papeis: string }[]
  >`
    SELECT u.matricula, u.username, u.status,
           coalesce(string_agg(r.codigo, '+' ORDER BY r.codigo), '(nenhum)') AS papeis
      FROM core.usuarios u
      LEFT JOIN core.permissoes_modulo pm ON pm.usuario_id = u.id
       AND pm.modulo_id = (SELECT id FROM core.modulos_sistema WHERE codigo = ${MODULO})
      LEFT JOIN core.roles_modulo r ON r.id = pm.role_modulo_id
     WHERE u.matricula = ANY(${cols.map((c) => c.matricula)}::text[])
     GROUP BY u.matricula, u.username, u.status`;
  const porMat = new Map(usuarios.map((u) => [u.matricula, u]));

  console.log(`\n4. AVALIADORES (${avaliadores.length}) — régua: ${SITUACOES_ELEGIVEIS.join(', ')}`);
  let entram = 0;
  for (const c of cols.sort((a, b) => a.nome.localeCompare(b.nome))) {
    const u = porMat.get(c.matricula);
    const fila = avaliadores.find((a) => a.avaliadorId === c.id)?._count._all ?? 0;
    /**
     * ⚠️ **QUALQUER papel do módulo, não `AVALIADOR`** — e a primeira versão
     * disto exigia `AVALIADOR`, reprovando a ARIELLY (RH_ADMIN, avaliadora de 5
     * pessoas) e divergindo do `conferir-estado.js`, que dizia 16 de 16.
     * *Ser avaliador é FATO DO DADO*: quem responde é quem foi DESIGNADO, e o
     * papel só diz se a pessoa entra no módulo.
     */
    const ok = Boolean(u) && u?.status === 'ATIVO' && (u?.papeis ?? '(nenhum)') !== '(nenhum)' &&
      (SITUACOES_ELEGIVEIS as readonly string[]).includes(c.situacao);
    if (ok) entram++;
    console.log(
      `   ${ok ? '✅' : '⛔'} ${c.matricula} ${c.nome.slice(0, 28).padEnd(30)} fila=${String(fila).padStart(3)} ` +
        `· ${(u?.username ?? '(sem conta)').padEnd(20)} · ${(u?.papeis ?? '—').padEnd(12)} · ${c.situacao}`,
    );
  }
  console.log(`   conseguem entrar: ${entram} de ${cols.length}`);

  // ── 5. A CONTA QUE TEM DE FECHAR ──────────────────────────────────────────
  const publico = await prisma.aplicacaoPublico.findMany({
    where: { cicloId: ciclo.id },
    select: { colaboradorId: true },
  });
  const ids = [...new Set(publico.map((p) => p.colaboradorId))];
  const porSituacao = await prisma.colaborador.groupBy({
    by: ['situacao'],
    where: { id: { in: ids } },
    _count: { _all: true },
  });
  const afastados = porSituacao.find((s) => s.situacao === 'AFASTADO')?._count._all ?? 0;
  /**
   * ⚠️ `ONDE_A_AVALIACAO_CONTA`, não `count()` cru — a constante existe para que
   * ninguém precise lembrar de excluir CANCELADA. Contar tudo aqui faria o
   * retrato somar avaliações que o ciclo já descartou, e a diferença apareceria
   * como "gente sem avaliação" depois do primeiro cancelamento.
   */
  const total = await prisma.avaliacao.count({
    where: { cicloId: ciclo.id, ...ONDE_A_AVALIACAO_CONTA },
  });
  const canceladas = await prisma.avaliacao.count({
    where: { cicloId: ciclo.id, status: 'CANCELADA' },
  });
  const elegiveisDoCiclo = ids.length - (ciclo.incluirAfastados ? 0 : afastados);

  console.log('\n5. ⛳ A CONTA');
  console.log(`   público (pessoas distintas) ......... ${ids.length}`);
  for (const s of porSituacao) console.log(`       ${s.situacao.padEnd(10)} ${s._count._all}`);
  console.log(`   − afastados (incluirAfastados=${ciclo.incluirAfastados}) .. ${ciclo.incluirAfastados ? 0 : afastados}`);
  console.log(`   = elegíveis pela régua do CICLO ..... ${elegiveisDoCiclo}`);
  console.log(`   avaliações que contam ............... ${total}`);
  console.log(`   (canceladas, fora da conta) ......... ${canceladas}`);
  console.log(`   diferença ........................... ${elegiveisDoCiclo - total}`);
  console.log(
    elegiveisDoCiclo - total === 0
      ? '   ✅ fecha'
      : `   ⚠️ ${elegiveisDoCiclo - total} elegível(is) do ciclo sem avaliação — quem é, e por quê, precisa estar registrado`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
