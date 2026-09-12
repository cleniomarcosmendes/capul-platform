/**
 * POPULAR O DEV — cadastro de avaliadores e o ciclo do piloto.
 *
 * ⚠️ ISTO NÃO É SEED DE PRODUÇÃO. Tudo o que este script grava em
 * `rh.designacao_padrao` sai com `provisorio = true`, porque a lista real de
 * quem avalia quem é decisão do RH e ainda não veio. O critério abaixo elege
 * avaliadores pelo CARGO só para o piloto ter dado com que ser exercitado.
 *
 * O CRITÉRIO PROVISÓRIO (combinado em 06/09/2026)
 * ───────────────────────────────────────────────
 * Candidato a responsável do próprio par filial × centro de custo é quem tem
 * Supervisor, Coordenador, Gerente ou Encarregado na descrição do cargo. Todos,
 * quando há mais de um. Par sem nenhum fica SEM responsável de propósito.
 *
 * ⚠️ "Coordenador" não elege ninguém: nenhum cargo da Capul contém a palavra.
 * O critério é efetivamente de três termos.
 *
 * Distribuição dentro do par:
 *   1 responsável  → todos do par vão para ele, exceto ele mesmo e os demais
 *                    responsáveis, com origem CENTRO_CUSTO;
 *   N responsáveis → divisão IGUAL em blocos contíguos por ordem alfabética do
 *                    avaliado, com origem DIVISAO_AUTOMATICA. Ninguém decidiu
 *                    essas linhas: elas existem para não jogar fora o trabalho
 *                    de quem preencheu a planilha, e o painel as conta como
 *                    "distribuído automaticamente, não revisado".
 *
 * QUEM AVALIA O RESPONSÁVEL — o furo que o critério do cargo não fecha. Como o
 * responsável é membro do próprio centro de custo, ele ficaria sem avaliador
 * (autoavaliação não existe). Regra provisória, em cascata:
 *   1. o gerente ÚNICO do próprio par avalia os demais responsáveis dele;
 *   2. senão, o gerente ÚNICO da filial (em outro centro de custo);
 *   3. senão, Claudimar Dias (Diretor Executivo);
 *   4. todo GERENTE vai para o Claudimar.
 *
 * ⚠️ Onde há MAIS DE UM gerente, a cascata NÃO escolhe — cai para o Claudimar.
 * Pegar o primeiro seria decidir por ordem de índice quem responde pela
 * avaliação de alguém, que é o que `escolherColaboradorUnico` já recusa fazer
 * com matrícula ambígua.
 *
 * ⚠️ Claudimar, o Presidente e o Vice ficam SEM avaliador, de propósito: é a
 * pendência aberta da Diretoria, e deixá-la visível no cadastro é melhor do que
 * inventar uma resposta que ninguém deu.
 */
import { PrismaClient, type Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const CARGO_DE_CHEFIA = /(supervisor|coordenador|gerente|encarregad)/i;
const EH_SUB_GERENTE = /sub[ -]?gerente/i;
const MATRICULA_DIRETOR_EXECUTIVO = '001079'; // CLAUDIMAR DIAS DE OLIVEIRA, filial 01
const SITUACOES_ELEGIVEIS = ['ATIVO', 'AFASTADO', 'FERIAS'];
const HOJE = new Date('2026-09-06');

const NOTA_PROVISORIA =
  'DADO PROVISÓRIO DO DEV — eleito por cargo em 06/09/2026 para exercitar o ' +
  'piloto. A lista real é configuração do RH e substitui esta.';

type Colab = {
  id: string;
  filial: string;
  matricula: string;
  nome: string;
  centroCusto: string | null;
  centroCustoDescricao: string | null;
  cargoDescricao: string | null;
};

type Linha = Omit<Prisma.DesignacaoPadraoCreateManyInput, 'id'>;

const chaveDoPar = (c: Colab) => `${c.filial}|${c.centroCusto}`;
const ehChefia = (c: Colab) => CARGO_DE_CHEFIA.test(c.cargoDescricao ?? '');
const ehGerente = (c: Colab) =>
  /gerente/i.test(c.cargoDescricao ?? '') && !EH_SUB_GERENTE.test(c.cargoDescricao ?? '');

/** Divide em N blocos contíguos do tamanho mais parecido possível. */
function emBlocos<T>(itens: readonly T[], n: number): T[][] {
  const base = Math.floor(itens.length / n);
  const sobra = itens.length % n;
  const blocos: T[][] = [];
  let i = 0;
  for (let b = 0; b < n; b++) {
    const tamanho = base + (b < sobra ? 1 : 0);
    blocos.push(itens.slice(i, i + tamanho));
    i += tamanho;
  }
  return blocos;
}

async function main() {
  const todos = (await prisma.colaborador.findMany({
    where: { situacao: { in: SITUACOES_ELEGIVEIS as never }, centroCusto: { not: null } },
    select: {
      id: true, filial: true, matricula: true, nome: true,
      centroCusto: true, centroCustoDescricao: true, cargoDescricao: true,
    },
    orderBy: [{ nome: 'asc' }],
  })) as Colab[];

  const diretorExecutivo = todos.find((c) => c.matricula === MATRICULA_DIRETOR_EXECUTIVO);
  if (!diretorExecutivo) throw new Error(`Diretor Executivo ${MATRICULA_DIRETOR_EXECUTIVO} nao encontrado.`);

  const pares = new Map<string, Colab[]>();
  for (const c of todos) pares.set(chaveDoPar(c), [...(pares.get(chaveDoPar(c)) ?? []), c]);

  const gerentesPorPar = new Map<string, Colab[]>();
  const gerentesPorFilial = new Map<string, Colab[]>();
  for (const c of todos.filter(ehGerente)) {
    gerentesPorPar.set(chaveDoPar(c), [...(gerentesPorPar.get(chaveDoPar(c)) ?? []), c]);
    gerentesPorFilial.set(c.filial, [...(gerentesPorFilial.get(c.filial) ?? []), c]);
  }

  const linhas: Linha[] = [];
  const relatorio = { pares: 0, comResponsavel: 0, semResponsavel: 0, divididos: 0 };

  // ── Passo 1: as pessoas comuns de cada par vão para o(s) responsável(is).
  for (const [chave, membros] of [...pares.entries()].sort()) {
    relatorio.pares++;
    const responsaveis = membros.filter(ehChefia).sort((a, b) => a.nome.localeCompare(b.nome));
    if (responsaveis.length === 0) {
      relatorio.semResponsavel++;
      continue; // cenário 3: fica sem, de propósito.
    }
    relatorio.comResponsavel++;

    const comuns = membros
      .filter((m) => !responsaveis.some((r) => r.id === m.id))
      .sort((a, b) => a.nome.localeCompare(b.nome));

    if (responsaveis.length === 1) {
      for (const alvo of comuns) {
        linhas.push({
          avaliadorId: responsaveis[0].id, avaliadoId: alvo.id,
          origem: 'CENTRO_CUSTO', origemReferencia: chave,
          provisorio: true, observacao: NOTA_PROVISORIA, vigenciaInicio: HOJE,
        });
      }
      continue;
    }

    relatorio.divididos++;
    const blocos = emBlocos(comuns, responsaveis.length);
    blocos.forEach((bloco, i) => {
      for (const alvo of bloco) {
        linhas.push({
          avaliadorId: responsaveis[i].id, avaliadoId: alvo.id,
          origem: 'DIVISAO_AUTOMATICA', origemReferencia: chave,
          provisorio: true,
          observacao:
            `${NOTA_PROVISORIA} A ALOCACAO DESTA LINHA FOI ARBITRADA: ${comuns.length} pessoas ` +
            `divididas em ordem alfabetica entre ${responsaveis.length} responsaveis do centro ` +
            'de custo. Ninguem decidiu que esta pessoa e deste avaliador — revisar.',
          vigenciaInicio: HOJE,
        });
      }
    });
  }

  // ── Passo 2: quem avalia o responsável.
  const jaTemAvaliador = new Set(linhas.map((l) => l.avaliadoId));
  for (const chefe of todos.filter(ehChefia)) {
    if (jaTemAvaliador.has(chefe.id)) continue;

    const gerentesDoPar = (gerentesPorPar.get(chaveDoPar(chefe)) ?? []).filter((g) => g.id !== chefe.id);
    const gerentesDaFilial = (gerentesPorFilial.get(chefe.filial) ?? []).filter((g) => g.id !== chefe.id);

    let avaliador = diretorExecutivo;
    let porque = 'gerente da area nao e unico (ou nao ha) — sobe para o Diretor Executivo';
    if (!ehGerente(chefe) && gerentesDoPar.length === 1) {
      avaliador = gerentesDoPar[0];
      porque = 'gerente unico do proprio centro de custo';
    } else if (!ehGerente(chefe) && gerentesDoPar.length === 0 && gerentesDaFilial.length === 1) {
      avaliador = gerentesDaFilial[0];
      porque = 'gerente unico da filial';
    } else if (ehGerente(chefe)) {
      porque = 'e gerente — sobe para o Diretor Executivo';
    }
    if (avaliador.id === chefe.id) continue;

    linhas.push({
      avaliadorId: avaliador.id, avaliadoId: chefe.id,
      origem: 'MANUAL', origemReferencia: null, provisorio: true,
      observacao: `${NOTA_PROVISORIA} Quem avalia o responsavel: ${porque}.`,
      vigenciaInicio: HOJE,
    });
    jaTemAvaliador.add(chefe.id);
  }

  // ── Passo 3 (cenário 2): um avaliador cobrindo MAIS DE UM centro de custo.
  // O Gerente da Oficina responde pelas três frentes da oficina elétrica; o
  // critério do cargo nunca produz isto sozinho, porque cada pessoa tem um só
  // centro de custo. É requisito antigo e nunca foi exercitado ponta a ponta.
  const GERENTE_OFICINA = '003413'; // DIOVANE ALVES DE SOUSA, filial 08
  const CCS_DA_OFICINA = ['08|21010602', '08|21010603'];
  const diovane = todos.find((c) => c.matricula === GERENTE_OFICINA);
  if (diovane) {
    for (const chave of CCS_DA_OFICINA) {
      for (const alvo of pares.get(chave) ?? []) {
        if (alvo.id === diovane.id || jaTemAvaliador.has(alvo.id)) continue;
        linhas.push({
          avaliadorId: diovane.id, avaliadoId: alvo.id,
          origem: 'MANUAL', origemReferencia: chave, provisorio: true,
          observacao:
            `${NOTA_PROVISORIA} O Gerente da Oficina responde pelas tres frentes da oficina ` +
            'eletrica (vendas, servicos e maquinas), que sao centros de custo distintos.',
          vigenciaInicio: HOJE,
        });
        jaTemAvaliador.add(alvo.id);
      }
    }
  }

  await prisma.designacaoPadrao.deleteMany({ where: { provisorio: true } });
  await prisma.designacaoPadrao.createMany({ data: linhas });

  console.log('-- designacao_padrao (tudo provisorio = true)');
  console.log(`   pares filial x CC: ${relatorio.pares}  com responsavel: ${relatorio.comResponsavel}  sem: ${relatorio.semResponsavel}`);
  console.log(`   pares com divisao automatica: ${relatorio.divididos}`);
  console.log(`   linhas gravadas: ${linhas.length}`);
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
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
