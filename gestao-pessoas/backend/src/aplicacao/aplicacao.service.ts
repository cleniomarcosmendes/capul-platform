/**
 * APLICAÇÃO — a peça que permite questionário POR PERFIL de centro de custo.
 *
 * Um ciclo tem N aplicações; cada uma casa um modelo com um público, define
 * quanto o questionário vale (`pesoAvaliacao`) e quais critérios cadastrais
 * entram, com que peso.
 *
 * ⭐ Aplicação SEM nenhum critério é válida — é o caso dos aprendizes, avaliados
 * 100% pelo questionário porque estão no piso de escolaridade, tempo de casa e
 * cursos por definição (docs/OBSERVACAO_RH_APRENDIZES.md).
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { validarAplicacao } from '../ciclo/abertura.validator.js';

export interface DadosAplicacao {
  cicloId: string;
  modeloVersaoId: string;
  nome: string;
  pesoAvaliacao: number;
  ordem?: number;
  criterios?: { criterioId: string; peso: number; ordem?: number }[];
  centrosCusto?: { filial?: string | null; centroCusto: string }[];
}

@Injectable()
export class AplicacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async criar(dados: DadosAplicacao, usuarioId: string) {
    const ciclo = await this.prisma.ciclo.findUnique({ where: { id: dados.cicloId } });
    if (!ciclo) throw new NotFoundException('Ciclo não encontrado.');
    if (ciclo.status !== 'RASCUNHO') {
      throw new BadRequestException(
        `O ciclo está ${ciclo.status}: aplicações só podem ser montadas enquanto ele é RASCUNHO.`,
      );
    }

    const versao = await this.prisma.modeloVersao.findUnique({
      where: { id: dados.modeloVersaoId },
      include: { modelo: true },
    });
    if (!versao) throw new NotFoundException('Versão de modelo não encontrada.');

    const criterios = await this.carregarCriterios(dados.criterios ?? []);

    // Valida ANTES de gravar: o momento mais barato de recusar é o mais perto de
    // quem cometeu o erro. A mesma validação roda de novo na abertura do ciclo.
    const problemas = validarAplicacao({
      nome: dados.nome,
      pesoAvaliacao: dados.pesoAvaliacao,
      modeloFinalidade: versao.modelo.finalidade,
      criterios: criterios.map((c) => ({
        peso: c.peso,
        criterio: {
          codigo: c.criterio.codigo,
          nome: c.criterio.nome,
          origem: c.criterio.origem,
          codigoCalculo: c.criterio.codigoCalculo,
          ativo: c.criterio.ativo,
        },
      })),
    });
    if (problemas.length) throw new BadRequestException(problemas);

    const aplicacao = await this.prisma.aplicacao.create({
      data: {
        cicloId: dados.cicloId,
        modeloVersaoId: dados.modeloVersaoId,
        nome: dados.nome,
        ordem: dados.ordem ?? 0,
        pesoAvaliacao: dados.pesoAvaliacao,
        criterios: {
          create: (dados.criterios ?? []).map((c, i) => ({
            criterioId: c.criterioId,
            peso: c.peso,
            ordem: c.ordem ?? i,
          })),
        },
        centrosCusto: {
          create: (dados.centrosCusto ?? []).map((cc) => ({
            filial: cc.filial ?? null,
            centroCusto: cc.centroCusto,
          })),
        },
      },
      include: { criterios: true, centrosCusto: true },
    });

    await this.auditoria.registrar({
      entidade: 'Aplicacao',
      entidadeId: aplicacao.id,
      acao: 'CRIAR',
      usuarioId,
      valorNovo: {
        nome: aplicacao.nome,
        pesoAvaliacao: dados.pesoAvaliacao,
        criterios: (dados.criterios ?? []).length,
      },
    });
    return aplicacao;
  }

  listarDoCiclo(cicloId: string) {
    return this.prisma.aplicacao.findMany({
      where: { cicloId },
      orderBy: { ordem: 'asc' },
      include: {
        criterios: { include: { criterio: true } },
        centrosCusto: true,
        _count: { select: { avaliacoes: true } },
      },
    });
  }

  private async carregarCriterios(itens: { criterioId: string; peso: number }[]) {
    if (itens.length === 0) return [];
    const criterios = await this.prisma.criterio.findMany({
      where: { id: { in: itens.map((i) => i.criterioId) } },
    });
    const porId = new Map(criterios.map((c) => [c.id, c]));
    return itens.map((i) => {
      const criterio = porId.get(i.criterioId);
      if (!criterio) throw new NotFoundException(`Critério ${i.criterioId} não encontrado.`);
      return { peso: i.peso, criterio };
    });
  }
}
