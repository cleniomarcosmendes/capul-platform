/**
 * DESIGNAÇÃO — quem entra no ciclo, e quem avalia quem.
 *
 * Três passos, na ordem em que a gestora trabalha:
 *   1. a régua monta a lista INICIAL a partir dos centros de custo da aplicação
 *      (`elegibilidade-ciclo.ts`);
 *   2. ela ajusta — inclui ou exclui — e cada ajuste vira linha em
 *      `rh.ciclo_elegibilidade`, nos dois sentidos;
 *   3. define o avaliador de cada pessoa.
 *
 * ⚠️ Ninguém some sem rastro. A lista devolve incluídos E excluídos, com motivo;
 * a decisão manual é gravada; e reverter uma decisão **não apaga** a anterior.
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SITUACOES_ELEGIVEIS } from '../common/elegibilidade.js';
import {
  montarListaInicial,
  type CandidatoDesignacao,
  type MotivoExclusao,
} from './elegibilidade-ciclo.js';

export interface LinhaDaLista {
  colaboradorId: string;
  matricula: string;
  nome: string;
  centroCusto: string | null;
  filial: string;
  elegivel: boolean;
  motivo: MotivoExclusao | null;
  justificativa: string | null;
  /** true quando a decisão veio de uma pessoa, não da régua. */
  decididoManualmente: boolean;
}

@Injectable()
export class DesignacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Lista da aplicação: colaboradores dos centros de custo dela, com a régua
   * aplicada e as decisões manuais já sobrepostas.
   */
  async listar(aplicacaoId: string): Promise<LinhaDaLista[]> {
    const aplicacao = await this.prisma.aplicacao.findUnique({
      where: { id: aplicacaoId },
      include: { centrosCusto: true, ciclo: true },
    });
    if (!aplicacao) throw new NotFoundException('Aplicação não encontrada.');

    const centros = aplicacao.centrosCusto.map((c) => c.centroCusto);
    const colaboradores = await this.prisma.colaborador.findMany({
      where: {
        situacao: { in: SITUACOES_ELEGIVEIS as never[] },
        ...(centros.length ? { centroCusto: { in: centros } } : {}),
      },
      orderBy: [{ filial: 'asc' }, { nome: 'asc' }],
    });

    const candidatos: (CandidatoDesignacao & { centroCusto: string | null; filial: string })[] =
      colaboradores.map((c) => ({
        colaboradorId: c.id,
        matricula: c.matricula,
        nome: c.nome,
        // Categoria funcional não é coluna do nosso cadastro: Presidente e Vice
        // são identificados pela decisão registrada, não re-derivados aqui.
        categoriaFuncional: null,
        situacaoNaDataBase: c.situacao,
        centroCusto: c.centroCusto,
        filial: c.filial,
      }));

    const { incluidos, excluidos } = montarListaInicial(candidatos, {
      incluirAfastados: aplicacao.ciclo.incluirAfastados,
    });

    const decisoes = await this.decisoesVigentes(aplicacao.cicloId);

    const linhas: LinhaDaLista[] = [
      ...incluidos.map((c) => ({
        ...this.paraLinha(c),
        elegivel: true,
        motivo: null,
        justificativa: null,
        decididoManualmente: false,
      })),
      ...excluidos.map((c) => ({
        ...this.paraLinha(c),
        elegivel: false,
        motivo: c.motivo as MotivoExclusao | null,
        justificativa: c.justificativa as string | null,
        decididoManualmente: false,
      })),
    ];

    // A decisão manual SOBREPÕE a régua, nos dois sentidos.
    return linhas.map((linha) => {
      const decisao = decisoes.get(linha.colaboradorId);
      if (!decisao) return { ...linha, decididoManualmente: false };
      return {
        ...linha,
        elegivel: decisao.decisao === 'INCLUIR',
        motivo: decisao.motivo,
        justificativa: decisao.justificativa,
        decididoManualmente: decisao.motivo === 'MANUAL_RH',
      };
    });
  }

  /**
   * Decisão manual do RH — incluir alguém que a régua excluiu, ou o contrário.
   * A decisão anterior, se houver, é MARCADA como removida e permanece.
   */
  async decidir(
    cicloId: string,
    colaboradorId: string,
    decisao: 'INCLUIR' | 'EXCLUIR',
    justificativa: string,
    usuarioId: string,
  ) {
    if (!justificativa?.trim()) {
      // Sem justificativa a linha vira "alguém decidiu algo" — que é o mesmo que
      // não ter registro nenhum quando alguém perguntar meses depois.
      throw new BadRequestException('Informe o motivo da decisão.');
    }

    const vigente = await this.prisma.cicloElegibilidade.findFirst({
      where: { cicloId, colaboradorId, removidoEm: null },
    });

    return this.prisma.$transaction(async (tx) => {
      if (vigente) {
        await tx.cicloElegibilidade.update({
          where: { id: vigente.id },
          data: { removidoEm: new Date(), removidoPorId: usuarioId },
        });
      }
      const nova = await tx.cicloElegibilidade.create({
        data: {
          cicloId,
          colaboradorId,
          decisao,
          motivo: 'MANUAL_RH',
          justificativa: justificativa.trim(),
          registradoPorId: usuarioId,
        },
      });
      await this.auditoria.registrar({
        entidade: 'CicloElegibilidade',
        entidadeId: nova.id,
        acao: `DECIDIR_${decisao}`,
        usuarioId,
        valorAnterior: vigente ? { decisao: vigente.decisao, motivo: vigente.motivo } : undefined,
        valorNovo: { decisao, justificativa },
      });
      return nova;
    });
  }

  /**
   * Designa avaliador. `@@unique([cicloId, avaliadoId])` garante um avaliador por
   * avaliado — e o snapshot congela filial, centro de custo e cargo, para o
   * resultado histórico não se mover se a pessoa mudar de área depois.
   */
  async designar(
    aplicacaoId: string,
    avaliadoId: string,
    avaliadorId: string,
    usuarioId: string,
    origem: 'CENTRO_CUSTO' | 'MANUAL' = 'CENTRO_CUSTO',
  ) {
    const [aplicacao, avaliado] = await Promise.all([
      this.prisma.aplicacao.findUnique({ where: { id: aplicacaoId } }),
      this.prisma.colaborador.findUnique({ where: { id: avaliadoId } }),
    ]);
    if (!aplicacao) throw new NotFoundException('Aplicação não encontrada.');
    if (!avaliado) throw new NotFoundException('Colaborador não encontrado.');

    if (avaliadoId === avaliadorId) {
      // Autoavaliação não existe (decisão A2/F1), e deixar passar aqui seria a
      // separação de funções perdendo o sentido antes mesmo de começar.
      throw new BadRequestException('Ninguém pode ser o avaliador da própria avaliação.');
    }

    const avaliacao = await this.prisma.avaliacao.upsert({
      where: { cicloId_avaliadoId: { cicloId: aplicacao.cicloId, avaliadoId } },
      update: { avaliadorId, aplicacaoId, origemDesignacao: origem },
      create: {
        cicloId: aplicacao.cicloId,
        aplicacaoId,
        avaliadoId,
        avaliadorId,
        origemDesignacao: origem,
        filialSnapshot: avaliado.filial,
        centroCustoSnapshot: avaliado.centroCusto,
        cargoSnapshot: avaliado.cargoDescricao,
      },
    });

    await this.auditoria.registrar({
      entidade: 'Avaliacao',
      entidadeId: avaliacao.id,
      acao: 'DESIGNAR',
      usuarioId,
      valorNovo: { avaliadoId, avaliadorId, origem },
    });
    return avaliacao;
  }

  private async decisoesVigentes(cicloId: string) {
    const linhas = await this.prisma.cicloElegibilidade.findMany({
      where: { cicloId, removidoEm: null },
    });
    return new Map(linhas.map((l) => [l.colaboradorId, l]));
  }

  private paraLinha(c: CandidatoDesignacao & { centroCusto?: string | null; filial?: string }) {
    return {
      colaboradorId: c.colaboradorId,
      matricula: c.matricula,
      nome: c.nome,
      centroCusto: c.centroCusto ?? null,
      filial: c.filial ?? '',
    };
  }
}
