/**
 * ⭐⭐ O ACERVO, COMO ACERVO — a leitura que faltava.
 *
 * Depois da migration de 11/09 a questão é GLOBAL: existe uma vez, e os perfis
 * a usam. Mas a única tela que mostrava questão continuava sendo a do
 * INSTRUMENTO (`/questionarios`), que lê **um arranjo por vez** — e ali as 15
 * questões aparecem como 39 linhas repetidas, uma por perfil que as usa.
 *
 * A pergunta que ninguém conseguia responder pela tela: *"quais questões
 * existem?"*. Ela é metade da decisão sobre o instrumento, e é a pergunta que
 * quem vai EDITAR faz primeiro.
 *
 * ⭐ Por isso o campo que dá sentido à lista não é o enunciado — é **onde cada
 * questão é usada**. Sem ele, a lista é um catálogo sem consequência; com ele,
 * ela responde *"mexer nesta questão afeta quem?"*, que é o que se pergunta
 * antes de mexer.
 *
 * ⚠️ LEITURA PURA. Editar é a Etapa 6; criar versão, a 2. Esta tela não tem
 * botão de salvar, e o aviso diz por onde a mudança passa hoje — mesma decisão
 * da `/questionarios` quando ela nasceu.
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { pesosDerivados } from '../calculo/peso-derivado.js';

export interface UsoDaQuestao {
  modeloVersaoId: string;
  modeloNome: string;
  versao: number;
  publicado: boolean;
  /**
   * Peso EFETIVO da questão naquele perfil — derivado por `pesosDerivados()`,
   * nunca lido de coluna. `null` quando o arranjo daquela versão está
   * incompleto (questão numa classificação sem peso): a tela escreve
   * "sem peso" em vez de exibir um número que não é verdade.
   */
  peso: number | null;
}

export interface QuestaoDoAcervo {
  id: string;
  codigo: string;
  enunciado: string;
  ativa: boolean;
  classificacaoId: string;
  classificacaoNome: string;
  alternativas: { id: string; descricao: string; valor: number; ordem: number }[];
  /** O maior valor — é ele que define quanto a questão vale no denominador. */
  maiorValor: number;
  /**
   * ⭐ Em quais perfis ela está. **Vazio é informação**, não ausência: questão
   * fora de todo arranjo é invisível para avaliação, contagem e apuração
   * (nenhuma consulta do módulo lê `pergunta` direto). A tela precisa dizer
   * isso — "criada" e "criada, e ainda não está em nenhum perfil" são frases
   * diferentes, e a primeira deixa quem criou achando que já vale.
   */
  usos: UsoDaQuestao[];
}

export interface ClassificacaoDoAcervo {
  id: string;
  nome: string;
  ordem: number;
  ativa: boolean;
  questoes: number;
}

export interface AcervoCompleto {
  totalQuestoes: number;
  /** Quantas não estão em perfil nenhum — o número que a tela destaca. */
  foraDeTodoPerfil: number;
  classificacoes: ClassificacaoDoAcervo[];
  questoes: QuestaoDoAcervo[];
}

@Injectable()
export class AcervoService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(): Promise<AcervoCompleto> {
    const [questoes, classificacoes, arranjos] = await Promise.all([
      this.prisma.pergunta.findMany({
        include: {
          classificacao: true,
          alternativas: { orderBy: { ordem: 'asc' } },
          arranjos: {
            include: {
              modeloVersao: { include: { modelo: { select: { nome: true } } } },
            },
          },
        },
        orderBy: [{ classificacao: { ordem: 'asc' } }, { codigo: 'asc' }],
      }),
      this.prisma.classificacao.findMany({ orderBy: { ordem: 'asc' } }),
      // O peso é do GRUPO no arranjo, e a questão o herda dividido — por isso a
      // contagem por (versão, classificação) vem junto: sem ela não dá para
      // dizer quanto a questão vale em cada perfil.
      this.prisma.arranjoGrupo.findMany({
        select: { modeloVersaoId: true, classificacaoId: true, peso: true },
      }),
    ]);

    /**
     * ⭐⭐ O peso efetivo sai de `pesosDerivados()`, a MESMA função que a
     * avaliação usa — não de uma divisão feita aqui.
     *
     * ⚠️ Escrevi a divisão à mão primeiro (`peso_do_grupo ÷ n`, arredondado) e
     * a conta não fechou: o Administrativo somava **59,97** e não 60. O que
     * falta é o centavo do resto, que a regra manda para as primeiras questões
     * por ordem — 16 ÷ 3 é 5,34 + 5,33 + 5,33, nunca 5,33 × 3. Duas telas
     * dando pesos diferentes para a mesma questão é pior que não ter a tela:
     * quem edita compararia com o questionário e concluiria que um dos dois
     * está errado, sem saber qual. O aviso já estava escrito no cabeçalho do
     * `peso-derivado.ts` ("não reimplementar aqui") e eu reimplementei mesmo
     * assim; quem pegou foi a soma, não a leitura.
     */
    const pesosPorVersao = new Map<string, Map<string, number>>();
    /** Versões cujo arranjo está incompleto — questão numa classificação sem peso. */
    const versoesSemPeso = new Set<string>();

    const questoesPorVersao = new Map<
      string,
      { perguntaId: string; classificacaoId: string; ordem: number }[]
    >();
    for (const q of questoes) {
      for (const a of q.arranjos) {
        const lista = questoesPorVersao.get(a.modeloVersaoId) ?? [];
        lista.push({ perguntaId: q.id, classificacaoId: q.classificacaoId, ordem: a.ordem });
        questoesPorVersao.set(a.modeloVersaoId, lista);
      }
    }
    const gruposPorVersao = new Map<string, { classificacaoId: string; peso: number }[]>();
    for (const a of arranjos) {
      const lista = gruposPorVersao.get(a.modeloVersaoId) ?? [];
      lista.push({ classificacaoId: a.classificacaoId, peso: Number(a.peso) });
      gruposPorVersao.set(a.modeloVersaoId, lista);
    }

    for (const [versaoId, doArranjo] of questoesPorVersao) {
      try {
        const derivados = pesosDerivados(doArranjo, gruposPorVersao.get(versaoId) ?? []);
        pesosPorVersao.set(versaoId, new Map(derivados.map((d) => [d.perguntaId, d.peso])));
      } catch {
        /**
         * ⚠️ Arranjo pela metade **não apaga a tela inteira**. Hoje não existe
         * nenhum (a migration confere isso na subida), mas o rascunho da Etapa 3
         * vai passar por aqui enquanto está sendo montado. O peso vem `null` e a
         * tela escreve "sem peso" — mentir um número seria o pior dos dois.
         */
        versoesSemPeso.add(versaoId);
      }
    }

    const linhas: QuestaoDoAcervo[] = questoes.map((q) => {
      const valores = q.alternativas.map((a) => Number(a.valor));
      return {
        id: q.id,
        codigo: q.codigo,
        enunciado: q.enunciado,
        ativa: q.ativa,
        classificacaoId: q.classificacaoId,
        classificacaoNome: q.classificacao.nome,
        alternativas: q.alternativas.map((a) => ({
          id: a.id,
          descricao: a.descricao,
          valor: Number(a.valor),
          ordem: a.ordem,
        })),
        maiorValor: valores.length ? Math.max(...valores) : 0,
        usos: q.arranjos
          .map((a) => {
            const peso = pesosPorVersao.get(a.modeloVersaoId)?.get(q.id) ?? null;
            return {
              modeloVersaoId: a.modeloVersaoId,
              modeloNome: a.modeloVersao.modelo.nome,
              versao: a.modeloVersao.versao,
              publicado: a.modeloVersao.publicadoEm !== null,
              /**
               * ⚠️ O peso EFETIVO, não o do grupo: a questão leva o do grupo
               * repartido entre as questões daquela classificação NAQUELE
               * perfil. Mostrar o do grupo diria que "Assiduidade" vale 12
               * quando ela vale 6 — e é o número que quem edita vai comparar
               * entre perfis. `null` = arranjo incompleto, não zero.
               */
              peso,
            };
          })
          .sort((a, b) => a.modeloNome.localeCompare(b.modeloNome, 'pt-BR')),
      };
    });

    const porClassificacao = new Map<string, number>();
    for (const q of linhas) {
      porClassificacao.set(q.classificacaoId, (porClassificacao.get(q.classificacaoId) ?? 0) + 1);
    }

    return {
      totalQuestoes: linhas.length,
      foraDeTodoPerfil: linhas.filter((q) => q.usos.length === 0).length,
      classificacoes: classificacoes.map((c) => ({
        id: c.id,
        nome: c.nome,
        ordem: c.ordem,
        ativa: c.ativa,
        questoes: porClassificacao.get(c.id) ?? 0,
      })),
      questoes: linhas,
    };
  }
}
