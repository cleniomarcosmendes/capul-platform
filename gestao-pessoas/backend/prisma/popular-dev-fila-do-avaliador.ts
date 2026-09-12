/**
 * POPULAR O DEV — a fila da conta de teste do AVALIADOR.
 *
 * ⚠️ NÃO É SEED DE PRODUÇÃO. Tudo sai com `provisorio = true`.
 *
 * ⭐ POR QUE ESTE SCRIPT EXISTE, e por que ele NÃO é "sortear avaliadores".
 *
 * No DEV se valida o PROCESSO, não o organograma: a atribuição real é decisão
 * do RH e só vale em produção. Mas o processo só é exercitável se a conta que
 * tem o papel AVALIADOR tiver o que avaliar — e ela tinha ZERO. Das 894
 * avaliações do ciclo, só 27 estavam com alguém que consegue entrar no sistema,
 * e nenhuma delas com a conta de AVALIADOR.
 *
 * Então o recorte aqui é deliberado e mínimo: dar à conta de teste uma fila que
 * cubra o que o levantamento pediu para observar. Não é preencher a empresa.
 *
 * ⚠️ O QUE ESTE SCRIPT NÃO TOCA: as pessoas sem avaliador nenhum. Elas são a
 * única instância viva do cenário "elegível que ninguém designou" — a pendência
 * que some sozinha, e que o painel e a pendência reversa existem para pegar.
 * Enchê-las apagaria o caso de teste sem ganhar função nova.
 *
 * ⭐ A fila tem gente de DUAS aplicações de propósito: é o que prova a melhoria
 * que originou o módulo (questionário por perfil). O mesmo avaliador abre um
 * questionário de 14 perguntas para o repositor e um de 11 para o aprendiz.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** A conta que tem o papel AVALIADOR no módulo. */
const MATRICULA_DO_AVALIADOR = '002749'; // wandersonnascimento
const DA_LOJA = 12;
const APRENDIZES = 3;
const HOJE = new Date('2026-09-06');

const NOTA =
  'DADO PROVISÓRIO DO DEV — fila montada para a conta de teste do AVALIADOR ' +
  'poder exercitar o processo. Não é atribuição real; a de verdade é do RH.';

async function main() {
  const avaliador = await prisma.colaborador.findFirst({
    where: { matricula: MATRICULA_DO_AVALIADOR, situacao: { in: ['ATIVO', 'AFASTADO', 'FERIAS'] as never } },
  });
  if (!avaliador) throw new Error(`Colaborador ${MATRICULA_DO_AVALIADOR} não encontrado.`);

  const elegiveis = { situacao: { in: ['ATIVO', 'AFASTADO', 'FERIAS'] as never } };

  // Do próprio centro de custo dele — não é sorteio: é a equipe onde ele
  // trabalha, que é o recorte que faz sentido para um supervisor de loja.
  const daLoja = (
    await prisma.colaborador.findMany({
      where: { ...elegiveis, filial: avaliador.filial, centroCusto: avaliador.centroCusto },
      orderBy: { nome: 'asc' },
    })
  ).filter((c) => c.id !== avaliador.id && !/aprendiz/i.test(c.cargoDescricao ?? ''));

  const aprendizes = (
    await prisma.colaborador.findMany({ where: elegiveis, orderBy: { nome: 'asc' } })
  ).filter((c) => /aprendiz/i.test(c.cargoDescricao ?? '') && c.id !== avaliador.id);

  const alvos = [...daLoja.slice(0, DA_LOJA), ...aprendizes.slice(0, APRENDIZES)];

  let reatribuidos = 0;
  let jaEram = 0;
  for (const alvo of alvos) {
    const vigente = await prisma.designacaoPadrao.findFirst({
      where: { avaliadoId: alvo.id, vigenciaFim: null },
    });
    if (vigente?.avaliadorId === avaliador.id) {
      jaEram++;
      continue;
    }
    await prisma.$transaction(async (tx) => {
      // Encerra, nunca apaga — e o único parcial recusaria os dois vigentes.
      if (vigente) {
        await tx.designacaoPadrao.update({
          where: { id: vigente.id },
          data: { vigenciaFim: HOJE },
        });
      }
      await tx.designacaoPadrao.create({
        data: {
          avaliadorId: avaliador.id,
          avaliadoId: alvo.id,
          origem: 'MANUAL',
          origemReferencia: 'fila da conta de teste do AVALIADOR',
          provisorio: true,
          observacao: NOTA,
          vigenciaInicio: HOJE,
        },
      });
    });
    reatribuidos++;
  }

  const semAvaliador = await prisma.colaborador.count({
    where: { ...elegiveis, ehAvaliadoNaDesignacaoPadrao: { none: { vigenciaFim: null } } },
  });

  console.log(`-- fila de ${avaliador.nome} (${avaliador.matricula})`);
  console.log(`   ${daLoja.slice(0, DA_LOJA).length} do proprio centro de custo + ${aprendizes.slice(0, APRENDIZES).length} aprendizes`);
  console.log(`   reatribuidos: ${reatribuidos} | ja eram dele: ${jaEram}`);
  console.log(`   sem avaliador no cadastro (INTOCADO de proposito): ${semAvaliador}`);
}

/**
 * ⚠️ GUARDA `require.main` — sem ela, IMPORTAR este arquivo já EXECUTA, e este
 * grava no banco. Com ela, `ferramenta-fora-da-suite.invariante.spec.ts`
 * consegue carregá-lo só para conferir que os imports ainda resolvem — que é o
 * defeito que passou em 12/09 e só apareceu quando alguém foi medir.
 */
if (require.main === module) {
  main()
    .then(() => prisma.$disconnect())
    .catch(async (e) => {
      console.error(e instanceof Error ? e.message : e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
