/**
 * RESULTADOS — a nota final, e a conta que chegou nela.
 *
 * ⭐ MEMÓRIA DE CÁLCULO. Uma nota sem a conta é um número que ninguém consegue
 * defender numa conversa com o avaliado. Por isso o detalhe mostra, lado a
 * lado: a nota do questionário (com a quebra por grupo, calculada na leitura —
 * ADR-RH-02), cada critério cadastral com o valor bruto que veio do cadastro, a
 * faixa em que caiu, a pontuação e o peso aplicado — e diz quando houve
 * RENORMALIZAÇÃO, que é o caso em que o peso de um critério sem dado foi
 * redistribuído entre os demais.
 *
 * ⭐ APLICAÇÃO ao lado da nota (decisão do RH, 05/09): a régua de conceitos é do
 * ciclo, mas o instrumento é da aplicação. Sem dizer qual questionário a pessoa
 * respondeu, comparar "BOM" de um aprendiz com "BOM" de um supervisor sugere
 * uma equivalência que não existe.
 *
 * ⚠️ Ler o PRÓPRIO resultado não é ato sobre ele. A separação de funções barra
 * abrir, editar, reabrir e recalcular a própria avaliação
 * (`avaliacao/separacao-funcoes.ts`) — atos que MUDAM o registro. A linha da
 * pessoa aparece marcada, como manda a regra de nunca filtrar em silêncio, e
 * abre: esconder de alguém o próprio número não protege nada, e faria o total
 * da lista não fechar.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AvaliacaoService } from '../avaliacao/avaliacao.service.js';
import { marcarRestricoes } from '../avaliacao/separacao-funcoes.js';

export interface LinhaDeResultado {
  id: string;
  avaliacaoId: string;
  avaliadoId: string;
  nome: string;
  matricula: string;
  cargo: string | null;
  centroCusto: string | null;
  filial: string | null;
  aplicacao: string;
  notaAvaliacao: number;
  notaCriterios: number | null;
  notaFinal: number;
  conceito: string | null;
  houveRenormalizacao: boolean;
  calculadoEm: Date;
  /** true quando é o resultado de quem está olhando — marcado, nunca oculto. */
  restrita?: boolean;
  motivoRestricao?: string;
}

@Injectable()
export class ResultadoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly avaliacoes: AvaliacaoService,
  ) {}

  async doCiclo(cicloId: string, colaboradorId: string | null): Promise<LinhaDeResultado[]> {
    const linhas = await this.prisma.resultadoAvaliacao.findMany({
      where: { cicloId },
      orderBy: { notaFinal: 'desc' },
      include: {
        avaliacao: {
          select: {
            id: true,
            avaliadoId: true,
            cargoSnapshot: true,
            centroCustoSnapshot: true,
            filialSnapshot: true,
            aplicacao: { select: { nome: true } },
          },
        },
      },
    });
    if (linhas.length === 0) return [];

    const pessoas = await this.prisma.colaborador.findMany({
      where: { id: { in: linhas.map((l) => l.colaboradorId) } },
      select: { id: true, nome: true, matricula: true, cargoDescricao: true },
    });
    const porId = new Map(pessoas.map((p) => [p.id, p]));

    const resultado: LinhaDeResultado[] = linhas.map((l) => ({
      id: l.id,
      avaliacaoId: l.avaliacaoId,
      avaliadoId: l.avaliacao.avaliadoId,
      nome: porId.get(l.colaboradorId)?.nome ?? '(colaborador não encontrado)',
      matricula: porId.get(l.colaboradorId)?.matricula ?? '',
      cargo: l.avaliacao.cargoSnapshot ?? porId.get(l.colaboradorId)?.cargoDescricao ?? null,
      centroCusto: l.avaliacao.centroCustoSnapshot,
      filial: l.avaliacao.filialSnapshot,
      aplicacao: l.avaliacao.aplicacao.nome,
      notaAvaliacao: Number(l.notaAvaliacao),
      notaCriterios: l.notaCriterios === null ? null : Number(l.notaCriterios),
      notaFinal: Number(l.notaFinal),
      conceito: l.conceitoDescricao,
      houveRenormalizacao: l.houveRenormalizacao,
      calculadoEm: l.calculadoEm,
    }));

    // Sem colaborador resolvido (RH que não é funcionário) ninguém tem linha
    // própria para marcar — e a lista sai inteira, como deve.
    return colaboradorId ? marcarRestricoes(resultado, colaboradorId) : resultado;
  }

  /** Memória de cálculo de um resultado. */
  async memoria(resultadoId: string) {
    const r = await this.prisma.resultadoAvaliacao.findUnique({
      where: { id: resultadoId },
      include: {
        criterios: true,
        ciclo: { select: { nome: true, dataBase: true } },
        avaliacao: {
          select: {
            id: true,
            avaliadoId: true,
            enviadaEm: true,
            observacaoAvaliador: true,
            avaliadorId: true,
            cargoSnapshot: true,
            centroCustoSnapshot: true,
            aplicacao: { select: { nome: true, pesoAvaliacao: true } },
          },
        },
      },
    });
    if (!r) throw new NotFoundException('Resultado não encontrado.');

    const [avaliado, avaliador] = await Promise.all([
      this.prisma.colaborador.findUnique({
        where: { id: r.colaboradorId },
        select: { nome: true, matricula: true, cargoDescricao: true },
      }),
      this.prisma.colaborador.findUnique({
        where: { id: r.avaliacao.avaliadorId },
        select: { nome: true, matricula: true },
      }),
    ]);

    return {
      id: r.id,
      ciclo: { nome: r.ciclo.nome, dataBase: r.ciclo.dataBase },
      aplicacao: r.avaliacao.aplicacao.nome,
      avaliado: {
        nome: avaliado?.nome ?? '',
        matricula: avaliado?.matricula ?? '',
        cargo: r.avaliacao.cargoSnapshot ?? avaliado?.cargoDescricao ?? null,
        centroCusto: r.avaliacao.centroCustoSnapshot,
      },
      avaliador: { nome: avaliador?.nome ?? '', matricula: avaliador?.matricula ?? '' },
      enviadaEm: r.avaliacao.enviadaEm,
      observacaoAvaliador: r.avaliacao.observacaoAvaliador,
      notaAvaliacao: Number(r.notaAvaliacao),
      pesoAvaliacao: Number(r.pesoAvaliacao),
      notaCriterios: r.notaCriterios === null ? null : Number(r.notaCriterios),
      notaFinal: Number(r.notaFinal),
      conceito: r.conceitoDescricao,
      houveRenormalizacao: r.houveRenormalizacao,
      calculadoEm: r.calculadoEm,
      // A quebra do questionário é calculada agora, sobre as respostas gravadas.
      porGrupo: await this.avaliacoes.notaPorGrupoDa(r.avaliacaoId),
      criterios: r.criterios.map((c) => ({
        criterioId: c.criterioId,
        nome: c.criterioNome,
        valorBruto: c.valorBruto === null ? null : Number(c.valorBruto),
        valorTexto: c.valorTexto,
        pontuacao: c.pontuacao === null ? null : Number(c.pontuacao),
        peso: Number(c.pesoAplicado),
        semDado: c.semDado,
      })),
    };
  }
}
