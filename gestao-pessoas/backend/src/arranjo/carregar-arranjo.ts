/**
 * CARREGAR O ARRANJO — a leitura do questionário de uma versão, com os pesos
 * já derivados.
 *
 * Existe para haver **uma** forma de ler o instrumento. Antes da migration do
 * acervo o questionário era um grafo privado da versão e cada consumidor
 * montava o seu `include`; agora o peso é derivado, e derivação repetida em
 * três lugares envelhece diferente em cada um — que é a falha que este projeto
 * já pagou mais de uma vez.
 *
 * ⚠️ Não grava nada. O peso por questão **não existe no banco** (ADR-RH-02
 * aplicado ao peso): é calculado aqui, na leitura, a partir do peso da
 * classificação no arranjo.
 */
import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import { pesosDerivados, pontuacaoMaximaDoArranjo } from '../calculo/peso-derivado.js';

export interface AlternativaDoArranjo {
  id: string;
  descricao: string;
  valor: number;
  ordem: number;
  codigoOrigem: string | null;
}

export interface QuestaoCarregada {
  id: string;
  codigo: string;
  enunciado: string;
  /** Ordem dentro do arranjo (da versão inteira, não do grupo). */
  ordem: number;
  classificacaoId: string;
  classificacaoNome: string;
  /**
   * Derivado do peso da classificação — nunca lido do banco. **É o EXIBIDO**:
   * duas casas, com o centavo do resto na primeira por ordem, e é o que
   * reproduz os 44 pesos herdados do Protheus.
   */
  peso: number;
  /**
   * ⭐⭐ O mesmo peso SEM arredondar. **É o de CALCULAR** — com o arredondado, as
   * mesmas respostas dão notas diferentes conforme qual questão ficou com o
   * centavo (§3.1.115).
   */
  pesoExato: number;
  maiorValor: number;
  alternativas: AlternativaDoArranjo[];
}

export interface GrupoCarregado {
  classificacaoId: string;
  titulo: string;
  ordem: number;
  peso: number;
  /** Quantas questões DESTE arranjo estão nesta classificação. */
  questoes: number;
}

export interface ArranjoCarregado {
  versaoId: string;
  modeloId: string;
  modeloNome: string;
  versao: number;
  publicadoEm: Date | null;
  pontuacaoMaximaGravada: number | null;
  pontuacaoMaximaCalculada: number;
  somaDosPesos: number;
  aplicacoesQueUsam: number;
  grupos: GrupoCarregado[];
  questoes: QuestaoCarregada[];
}

export async function carregarArranjo(
  prisma: PrismaService,
  versaoId: string,
): Promise<ArranjoCarregado> {
  const v = await prisma.modeloVersao.findUnique({
    where: { id: versaoId },
    include: {
      modelo: true,
      _count: { select: { aplicacoes: true } },
      grupos: { orderBy: { ordem: 'asc' }, include: { classificacao: true } },
      perguntas: {
        orderBy: { ordem: 'asc' },
        include: {
          pergunta: {
            include: {
              classificacao: true,
              alternativas: { orderBy: { ordem: 'asc' } },
            },
          },
        },
      },
    },
  });
  if (!v) throw new NotFoundException('Versão de modelo não encontrada.');

  const derivados = new Map(
    pesosDerivados(
      v.perguntas.map((ap) => ({
        perguntaId: ap.perguntaId,
        classificacaoId: ap.pergunta.classificacaoId,
        ordem: ap.ordem,
      })),
      v.grupos.map((g) => ({ classificacaoId: g.classificacaoId, peso: Number(g.peso) })),
    ).map((d) => [d.perguntaId, d]),
  );

  const questoes: QuestaoCarregada[] = v.perguntas.map((ap) => {
    const valores = ap.pergunta.alternativas.map((a) => Number(a.valor));
    return {
      id: ap.pergunta.id,
      codigo: ap.pergunta.codigo,
      enunciado: ap.pergunta.enunciado,
      ordem: ap.ordem,
      classificacaoId: ap.pergunta.classificacaoId,
      classificacaoNome: ap.pergunta.classificacao.nome,
      peso: derivados.get(ap.perguntaId)?.peso ?? 0,
      /**
       * ⭐⭐ O peso EXATO — é ele que entra na conta da nota. Ver
       * `calculo/peso-derivado.ts`: com o arredondado, as mesmas respostas dão
       * notas diferentes conforme qual questão ficou com o centavo do resto.
       */
      pesoExato: derivados.get(ap.perguntaId)?.pesoExato ?? 0,
      maiorValor: valores.length ? Math.max(...valores) : 0,
      alternativas: ap.pergunta.alternativas.map((a) => ({
        id: a.id,
        descricao: a.descricao,
        valor: Number(a.valor),
        ordem: a.ordem,
        codigoOrigem: a.codigoOrigem,
      })),
    };
  });

  const porClassificacao = new Map<string, number>();
  for (const q of questoes) {
    porClassificacao.set(q.classificacaoId, (porClassificacao.get(q.classificacaoId) ?? 0) + 1);
  }

  const somaDosPesos =
    questoes.reduce((s, q) => s + Math.round(q.peso * 100), 0) / 100;

  return {
    versaoId: v.id,
    modeloId: v.modeloId,
    modeloNome: v.modelo.nome,
    versao: v.versao,
    publicadoEm: v.publicadoEm,
    pontuacaoMaximaGravada: v.pontuacaoMaxima === null ? null : Number(v.pontuacaoMaxima),
    pontuacaoMaximaCalculada: pontuacaoMaximaDoArranjo(
      questoes.map((q) => ({
        perguntaId: q.id,
        classificacaoId: q.classificacaoId,
        peso: q.peso,
      })),
      new Map(questoes.map((q) => [q.id, q.maiorValor])),
    ),
    somaDosPesos,
    aplicacoesQueUsam: v._count.aplicacoes,
    grupos: v.grupos.map((g) => ({
      classificacaoId: g.classificacaoId,
      titulo: g.classificacao.nome,
      ordem: g.ordem,
      peso: Number(g.peso),
      questoes: porClassificacao.get(g.classificacaoId) ?? 0,
    })),
    questoes,
  };
}
