/**
 * CICLO — o contêiner: período, data-base, política e conceitos.
 *
 * O questionário não vive aqui: vive nas Aplicações, que é o que permite
 * modelos diferentes por perfil de centro de custo dentro do mesmo ciclo.
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CicloNaoAbrivelError,
  assertCicloAbrivel,
  type AplicacaoParaValidar,
  type FaixaConceito,
} from './abertura.validator.js';

export interface DadosCiclo {
  nome: string;
  periodoInicio: Date;
  periodoFim: Date;
  /** Congela TODO cálculo temporal do ciclo. Nunca `now()`. */
  dataBase: Date;
  janelaTreinamentoMeses?: number;
  incluirAfastados?: boolean;
  valeParaMerito?: boolean;
  conceitos: (FaixaConceito & { cor?: string | null; ordem: number })[];
}

@Injectable()
export class CicloService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async criar(dados: DadosCiclo, usuarioId: string) {
    this.validarPeriodo(dados);

    const ciclo = await this.prisma.ciclo.create({
      data: {
        nome: dados.nome,
        periodoInicio: dados.periodoInicio,
        periodoFim: dados.periodoFim,
        dataBase: dados.dataBase,
        janelaTreinamentoMeses: dados.janelaTreinamentoMeses ?? 12,
        incluirAfastados: dados.incluirAfastados ?? false,
        valeParaMerito: dados.valeParaMerito ?? false,
        conceitos: {
          create: dados.conceitos.map((c) => ({
            descricao: c.descricao,
            limiteInferior: c.limiteInferior,
            limiteSuperior: c.limiteSuperior,
            cor: c.cor ?? null,
            ordem: c.ordem,
          })),
        },
      },
      include: { conceitos: true },
    });

    await this.auditoria.registrar({
      entidade: 'Ciclo',
      entidadeId: ciclo.id,
      acao: 'CRIAR',
      usuarioId,
      valorNovo: { nome: ciclo.nome, dataBase: ciclo.dataBase, valeParaMerito: ciclo.valeParaMerito },
    });
    return ciclo;
  }

  /**
   * ABRIR — a última porta antes de gerar nota. Valida tudo de uma vez (§4.6):
   * conceitos contíguos, aplicações com `pesoAvaliacao > 0`, critérios ativos e
   * com resolver registrado, e nenhum modelo de demonstração.
   */
  async abrir(cicloId: string, usuarioId: string) {
    const ciclo = await this.carregarParaAbertura(cicloId);
    if (ciclo.status !== 'RASCUNHO') {
      throw new BadRequestException(
        `O ciclo está ${ciclo.status} — só um ciclo em RASCUNHO pode ser aberto.`,
      );
    }

    const aplicacoes: AplicacaoParaValidar[] = ciclo.aplicacoes.map((a) => ({
      nome: a.nome,
      pesoAvaliacao: Number(a.pesoAvaliacao),
      modeloFinalidade: a.modeloVersao.modelo.finalidade,
      criterios: a.criterios.map((ac) => ({
        peso: Number(ac.peso),
        criterio: {
          codigo: ac.criterio.codigo,
          nome: ac.criterio.nome,
          origem: ac.criterio.origem,
          codigoCalculo: ac.criterio.codigoCalculo,
          ativo: ac.criterio.ativo,
        },
      })),
    }));

    const conceitos = ciclo.conceitos.map((c) => ({
      descricao: c.descricao,
      limiteInferior: Number(c.limiteInferior),
      limiteSuperior: Number(c.limiteSuperior),
    }));

    try {
      assertCicloAbrivel(aplicacoes, conceitos);
    } catch (e) {
      if (e instanceof CicloNaoAbrivelError) throw new BadRequestException(e.problemas);
      throw e;
    }

    const aberto = await this.prisma.ciclo.update({
      where: { id: cicloId },
      data: { status: 'ABERTO', abertoEm: new Date() },
    });
    await this.auditoria.registrar({
      entidade: 'Ciclo',
      entidadeId: cicloId,
      acao: 'ABRIR',
      usuarioId,
      valorNovo: { aplicacoes: aplicacoes.length },
    });
    return aberto;
  }

  async encerrar(cicloId: string, usuarioId: string) {
    const ciclo = await this.prisma.ciclo.findUnique({ where: { id: cicloId } });
    if (!ciclo) throw new NotFoundException('Ciclo não encontrado.');
    if (ciclo.status !== 'EM_APURACAO' && ciclo.status !== 'ABERTO') {
      throw new BadRequestException(`O ciclo está ${ciclo.status} e não pode ser encerrado.`);
    }

    // Encerrar com avaliação pendente encerraria em silêncio — a API recusa e
    // diz QUANTAS são, para a tela poder perguntar em vez de adivinhar.
    const pendentes = await this.prisma.avaliacao.count({
      where: { cicloId, status: { in: ['PENDENTE', 'EM_ANDAMENTO'] } },
    });
    if (pendentes > 0) {
      throw new BadRequestException(
        `Não é possível encerrar: ${pendentes} avaliação(ões) ainda não foram enviadas.`,
      );
    }

    const encerrado = await this.prisma.ciclo.update({
      where: { id: cicloId },
      data: { status: 'ENCERRADO', encerradoEm: new Date() },
    });
    await this.auditoria.registrar({ entidade: 'Ciclo', entidadeId: cicloId, acao: 'ENCERRAR', usuarioId });
    return encerrado;
  }

  listar() {
    return this.prisma.ciclo.findMany({
      orderBy: { periodoInicio: 'desc' },
      include: { _count: { select: { aplicacoes: true, avaliacoes: true } } },
    });
  }

  async obter(cicloId: string) {
    const ciclo = await this.carregarParaAbertura(cicloId);
    if (!ciclo) throw new NotFoundException('Ciclo não encontrado.');
    return ciclo;
  }

  private async carregarParaAbertura(cicloId: string) {
    const ciclo = await this.prisma.ciclo.findUnique({
      where: { id: cicloId },
      include: {
        conceitos: { orderBy: { ordem: 'asc' } },
        aplicacoes: {
          include: {
            modeloVersao: { include: { modelo: true } },
            criterios: { include: { criterio: true } },
            centrosCusto: true,
          },
        },
      },
    });
    if (!ciclo) throw new NotFoundException('Ciclo não encontrado.');
    return ciclo;
  }

  private validarPeriodo(dados: DadosCiclo) {
    const problemas: string[] = [];
    if (dados.periodoFim < dados.periodoInicio) {
      problemas.push('O fim do período é anterior ao início.');
    }
    if (dados.dataBase < dados.periodoInicio || dados.dataBase > dados.periodoFim) {
      // A data-base ancora todo cálculo temporal; fora do período ela mediria
      // um momento que o ciclo não cobre.
      problemas.push('A data-base precisa estar dentro do período do ciclo.');
    }
    if ((dados.janelaTreinamentoMeses ?? 12) <= 0) {
      problemas.push('A janela de treinamento precisa ser de pelo menos 1 mês.');
    }
    if (problemas.length) throw new BadRequestException(problemas);
  }
}
