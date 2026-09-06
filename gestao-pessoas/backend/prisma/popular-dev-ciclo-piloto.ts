/**
 * POPULAR O DEV — o ciclo do piloto com a aplicação dos APRENDIZES.
 *
 * ⚠️ NÃO É SEED DE PRODUÇÃO. Monta no DEV o ciclo do piloto em RASCUNHO, ao
 * lado do "Avaliação Geral 2026" que está ABERTO — as 3 avaliações enviadas de
 * verdade que vivem lá são o único dado real de uso do módulo e não se tocam.
 *
 * ⭐ POR QUE A APLICAÇÃO DOS APRENDIZES É O TESTE QUE IMPORTA
 * Ela era IMPOSSÍVEL de montar enquanto o público vinha do recorte por centro
 * de custo: os 31 aprendizes estão em 15 pares filial × CC, todos
 * compartilhados com gente efetiva. Não existe centro de custo que os isole —
 * escolher o CC de qualquer um deles arrastaria junto os colegas do quadro
 * normal. E a régua de elegibilidade e o OBSERVACAO_RH_APRENDIZES.md já
 * tratavam a aplicação própria deles como decidida: estava documentado como
 * resolvido algo que o modelo de dados não expressava.
 *
 * A aplicação sai SEM critérios cadastrais, que é a decisão registrada para os
 * aprendizes (piso de escolaridade, tempo de casa e cursos por definição), e
 * com `pesoAvaliacao = 100`: sobrando só o questionário, a conta vira
 * `nota × 100 / 100` — nenhum caso especial.
 *
 * ⚠️ Só esta aplicação é montada. As outras duas do piloto dependem de o RH
 * escolher os centros de custo de cada público, que é decisão dele e se faz na
 * tela. A dos aprendizes é a única cujo recorte já está definido — por cargo.
 *
 * ⚠️ O questionário usado é o "Administrativo" publicado pelo seed, por ser o
 * mais curto. NÃO é o questionário dos aprendizes, que ainda não existe: não há
 * editor de modelo, e os três modelos de produção vieram do seed.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NOME_DO_CICLO = 'Piloto 15/09/2026';
const CARGO_APRENDIZ = /aprendiz/i;

const CONCEITOS = [
  { descricao: 'Insuficiente', limiteInferior: 0, limiteSuperior: 25, ordem: 1 },
  { descricao: 'Abaixo do esperado', limiteInferior: 25, limiteSuperior: 50, ordem: 2 },
  { descricao: 'Atende', limiteInferior: 50, limiteSuperior: 75, ordem: 3 },
  { descricao: 'Supera', limiteInferior: 75, limiteSuperior: 90, ordem: 4 },
  { descricao: 'Excelente', limiteInferior: 90, limiteSuperior: 100, ordem: 5 },
];

async function limparCicloAnterior() {
  const anterior = await prisma.ciclo.findFirst({ where: { nome: NOME_DO_CICLO } });
  if (!anterior) return;

  // Trava de segurança: se alguém já respondeu neste ciclo, o script não é mais
  // "montar o piloto" — é apagar trabalho de gente. Para aí.
  const avaliacoes = await prisma.avaliacao.count({ where: { cicloId: anterior.id } });
  if (avaliacoes > 0) {
    throw new Error(
      `O ciclo "${NOME_DO_CICLO}" já tem ${avaliacoes} avaliação(ões). ` +
        'Apague à mão se for mesmo o que você quer — este script não faz isso.',
    );
  }
  await prisma.aplicacaoPublico.deleteMany({ where: { cicloId: anterior.id } });
  await prisma.aplicacaoCriterio.deleteMany({ where: { aplicacao: { cicloId: anterior.id } } });
  await prisma.aplicacaoCentroCusto.deleteMany({ where: { aplicacao: { cicloId: anterior.id } } });
  await prisma.aplicacao.deleteMany({ where: { cicloId: anterior.id } });
  await prisma.conceitoFaixa.deleteMany({ where: { cicloId: anterior.id } });
  await prisma.cicloElegibilidade.deleteMany({ where: { cicloId: anterior.id } });
  await prisma.ciclo.delete({ where: { id: anterior.id } });
  console.log(`   (ciclo "${NOME_DO_CICLO}" anterior removido — não tinha avaliação)`);
}

async function main() {
  await limparCicloAnterior();

  const versao = await prisma.modeloVersao.findFirst({
    where: { modelo: { nome: 'Administrativo', finalidade: 'PRODUCAO' }, publicadoEm: { not: null } },
  });
  if (!versao) throw new Error('Nenhuma versão publicada do modelo "Administrativo".');

  const ciclo = await prisma.ciclo.create({
    data: {
      nome: NOME_DO_CICLO,
      periodoInicio: new Date('2026-01-01'),
      periodoFim: new Date('2026-12-31'),
      dataBase: new Date('2026-09-15'),
      janelaTreinamentoMeses: 12,
      status: 'RASCUNHO',
      // O piloto valida o sistema; não decide carreira de ninguém.
      valeParaMerito: false,
      incluirAfastados: false,
      conceitos: { create: CONCEITOS },
    },
  });

  const aplicacao = await prisma.aplicacao.create({
    data: {
      cicloId: ciclo.id,
      modeloVersaoId: versao.id,
      nome: 'Aprendizes',
      ordem: 1,
      // Sem critérios cadastrais: com o questionário valendo 100, a nota final
      // é a nota do questionário, sem caso especial na fórmula.
      pesoAvaliacao: 100,
    },
  });

  const aprendizes = (
    await prisma.colaborador.findMany({
      where: { situacao: { in: ['ATIVO', 'AFASTADO', 'FERIAS'] as never } },
      select: { id: true, nome: true, filial: true, centroCusto: true, cargoDescricao: true },
      orderBy: [{ filial: 'asc' }, { nome: 'asc' }],
    })
  ).filter((c) => CARGO_APRENDIZ.test(c.cargoDescricao ?? ''));

  await prisma.aplicacaoPublico.createMany({
    data: aprendizes.map((a) => ({
      aplicacaoId: aplicacao.id,
      cicloId: ciclo.id,
      colaboradorId: a.id,
      origem: 'MANUAL' as const,
      // O recorte não é CC nem filial: é o cargo. `origemReferencia` guarda o
      // filtro usado, para a tela poder explicar de onde a lista saiu.
      origemReferencia: 'cargo contém APRENDIZ',
    })),
  });

  const pares = new Set(aprendizes.map((a) => `${a.filial}|${a.centroCusto}`));
  console.log(`-- ciclo "${ciclo.nome}" (${ciclo.status}, vale_para_merito=${ciclo.valeParaMerito})`);
  console.log(`   aplicacao "${aplicacao.nome}": ${aprendizes.length} pessoas`);
  console.log(`   espalhadas por ${pares.size} pares filial x centro de custo`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });
