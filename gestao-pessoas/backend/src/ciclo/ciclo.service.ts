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

  /**
   * ⭐ AJUSTAR O PERÍODO — e SÓ o período.
   *
   * `periodoInicio`/`periodoFim` são **rótulo**: dizem de que intervalo o ciclo
   * fala, aparecem no painel e viram o prazo na fila do avaliador. Nenhuma
   * conta os usa — quem ancora todo cálculo temporal é a `dataBase`, e ela
   * NÃO se mexe aqui, de propósito. Mudar a data-base de um ciclo em andamento
   * moveria a nota de quem já respondeu, em silêncio; é a mesma família do
   * `current_date` que o select antigo usava e que a §4.2 da spec proibiu.
   *
   * Por isso este método é estreito: quem quiser outra data-base cria outro
   * ciclo, que é a decisão que ela realmente é.
   *
   * ⚠️ Ciclo ENCERRADO não muda: o resultado já foi materializado e a memória
   * de cálculo dele fala de um período que ficaria diferente do gravado.
   */
  async ajustarPeriodo(
    cicloId: string,
    periodoInicio: Date,
    periodoFim: Date,
    usuarioId: string,
  ) {
    const ciclo = await this.prisma.ciclo.findUnique({ where: { id: cicloId } });
    if (!ciclo) throw new NotFoundException('Ciclo não encontrado.');
    if (ciclo.status === 'ENCERRADO') {
      throw new BadRequestException(
        'O ciclo está ENCERRADO — o período dele descreve resultados já materializados e não muda.',
      );
    }

    this.validarPeriodo({
      periodoInicio,
      periodoFim,
      dataBase: ciclo.dataBase,
      janelaTreinamentoMeses: ciclo.janelaTreinamentoMeses,
    });

    const atualizado = await this.prisma.ciclo.update({
      where: { id: cicloId },
      data: { periodoInicio, periodoFim },
    });

    await this.auditoria.registrar({
      entidade: 'Ciclo',
      entidadeId: cicloId,
      acao: 'AJUSTAR_PERIODO',
      usuarioId,
      valorAnterior: { periodoInicio: ciclo.periodoInicio, periodoFim: ciclo.periodoFim },
      valorNovo: { periodoInicio, periodoFim },
    });
    return atualizado;
  }

  /**
   * ⚠️ Traz também quantas avaliações ainda NÃO foram enviadas — é a condição
   * que `encerrar` exige, e sem o número a tela só consegue escrever a regra
   * embaixo do botão e deixar a pessoa descobrir clicando. Encerrar é a ação
   * irreversível do módulo; ela não pode ser o caminho para conhecer a regra.
   */
  async listar() {
    const [ciclos, pendentes] = await Promise.all([
      this.prisma.ciclo.findMany({
        orderBy: { periodoInicio: 'desc' },
        include: { _count: { select: { aplicacoes: true, avaliacoes: true } } },
      }),
      // groupBy e não `_count` filtrado: o `_count` do Prisma não aceita a
      // mesma relação duas vezes (total e filtrada) na mesma consulta.
      this.prisma.avaliacao.groupBy({
        by: ['cicloId'],
        where: { status: { in: ['PENDENTE', 'EM_ANDAMENTO'] } },
        _count: { _all: true },
      }),
    ]);
    const porCiclo = new Map(pendentes.map((p) => [p.cicloId, p._count._all]));
    return ciclos.map((c) => ({ ...c, avaliacoesPendentes: porCiclo.get(c.id) ?? 0 }));
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

  /** Só as datas: é o que a regra olha, e pedir o ciclo inteiro obrigaria quem
   *  ajusta o período a fabricar campos que não têm nada a ver com ela. */
  private validarPeriodo(dados: Pick<DadosCiclo, 'periodoInicio' | 'periodoFim' | 'dataBase' | 'janelaTreinamentoMeses'>) {
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
