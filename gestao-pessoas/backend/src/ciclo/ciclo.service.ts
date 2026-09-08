/**
 * CICLO — o contêiner: período, data-base, política e conceitos.
 *
 * O questionário não vive aqui: vive nas Aplicações, que é o que permite
 * modelos diferentes por perfil de centro de custo dentro do mesmo ciclo.
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ONDE_A_AVALIACAO_CONTA } from '../avaliacao/avaliacoes-que-contam.js';
import {
  CicloNaoAbrivelError,
  assertCicloAbrivel,
  problemasParaAbrir,
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
   * ⭐ O HISTÓRICO DE REABERTURA — porque **um ciclo reaberto duas vezes é
   * informação, não detalhe**.
   *
   * 🔒 A tabela guarda só a ÚLTIMA reabertura (colunas únicas); a contagem vem de
   * `rh.auditoria`, que guarda todas. **Não troque por um campo da tabela.**
   * Parece simplificação — uma consulta a menos — e apaga a informação sem nada
   * acusar: a tela continua funcionando, o número continua aparecendo, e passa a
   * dizer "1×" sempre. Se incomodar, o caminho é uma coluna `reaberturas`
   * incrementada aqui, nunca derivar do `reabertoEm`. O nome de quem reabriu sai de
   * `core.usuarios` por `$queryRaw` — `core` é read-only aqui, como na Logística
   * e no Fiscal.
   */
  async historicoDeReabertura(cicloId: string) {
    const ciclo = await this.prisma.ciclo.findUnique({
      where: { id: cicloId },
      select: { reabertoEm: true, reabertoPorId: true, motivoReabertura: true },
    });
    if (!ciclo?.reabertoEm) return { reaberturas: 0, ultima: null };

    const [reaberturas, nome] = await Promise.all([
      this.prisma.auditoria.count({
        where: { entidade: 'Ciclo', entidadeId: cicloId, acao: 'REABRIR' },
      }),
      this.nomeDoUsuario(ciclo.reabertoPorId),
    ]);
    return {
      reaberturas: Math.max(reaberturas, 1),
      ultima: { em: ciclo.reabertoEm, por: nome, motivo: ciclo.motivoReabertura },
    };
  }

  /** `core` é read-only: consulta por SQL cru, como os outros módulos fazem. */
  private async nomeDoUsuario(usuarioId: string | null): Promise<string | null> {
    if (!usuarioId) return null;
    const linhas = await this.prisma.$queryRaw<{ nome: string | null }[]>(
      Prisma.sql`SELECT nome FROM "core"."usuarios" WHERE id = ${usuarioId} LIMIT 1`,
    );
    return linhas[0]?.nome ?? null;
  }

  /**
   * O que falta para o ciclo poder abrir — a lista VIVA, para a tela mostrar
   * antes do clique. Roda a MESMA função da abertura sobre os MESMOS dados
   * (`carregarParaAbertura`), então não existe "a tela achava que dava".
   */
  async pendenciasParaAbrir(cicloId: string): Promise<string[]> {
    const ciclo = await this.carregarParaAbertura(cicloId);
    return problemasParaAbrir(this.aplicacoesParaValidar(ciclo), this.conceitosParaValidar(ciclo));
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

    const aplicacoes = this.aplicacoesParaValidar(ciclo);
    const conceitos = this.conceitosParaValidar(ciclo);

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

  /** ⚠️ Um mapeamento só: a lista viva e a guarda leem o ciclo do mesmo jeito. */
  private aplicacoesParaValidar(
    ciclo: Awaited<ReturnType<CicloService['carregarParaAbertura']>>,
  ): AplicacaoParaValidar[] {
    return ciclo.aplicacoes.map((a) => ({
      nome: a.nome,
      pessoasNoPublico: a._count.publico,
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
  }

  private conceitosParaValidar(ciclo: { conceitos: { descricao: string; limiteInferior: unknown; limiteSuperior: unknown }[] }) {
    return ciclo.conceitos.map((c) => ({
      descricao: c.descricao,
      limiteInferior: Number(c.limiteInferior),
      limiteSuperior: Number(c.limiteSuperior),
    }));
  }

  /**
   * ⭐⭐ ENCERRAR — e a saída para a pendência que NÃO vai entrar (08/09).
   *
   * Exigir 100% enviado, sem exceção, tranca o ciclo para sempre no dia em que
   * alguém sai da empresa, entra em licença longa ou simplesmente não responde:
   * a avaliação fica PENDENTE, ninguém pode respondê-la, e o encerrar continua
   * contando-a. Piloto (891) e Geral (5) estão nesse estado hoje.
   *
   * A saída é a MESMA da Logística no RDV, que já roda em produção: **a API
   * recusa e diz quantas são**; só encerra com `confirmarPendentes`, e aí as
   * pendentes viram CANCELADA **com o motivo escrito**. Nada é apagado — as
   * respostas parciais ficam registradas e fora da apuração, e o painel mostra
   * a contagem de canceladas, que é onde o custo do override fica à vista.
   *
   * ⚠️ Motivo OBRIGATÓRIO e auditado. Sem isso o override vira o caminho fácil
   * e, três ciclos adiante, ninguém encerra sem ele.
   * ⚠️ RH_ADMIN só — mesmo degrau do reabrir, garantido no controller.
   */
  async encerrar(
    cicloId: string,
    usuarioId: string,
    opcoes: { confirmarPendentes?: boolean; motivo?: string } = {},
  ) {
    const ciclo = await this.prisma.ciclo.findUnique({ where: { id: cicloId } });
    if (!ciclo) throw new NotFoundException('Ciclo não encontrado.');
    // ⚠️ Só de ABERTO. `EM_APURACAO` estava aqui como origem possível e **nada
    // no código jamais o produziu** — saiu do enum em 07/09/2026.
    if (ciclo.status !== 'ABERTO') {
      throw new BadRequestException(
        ciclo.status === 'ENCERRADO'
          ? 'Este ciclo já está encerrado. Para mexer nele, reabra o ciclo — é ato do RH_ADMIN, exige motivo e fica registrado.'
          : `O ciclo está ${ciclo.status} e não pode ser encerrado — só um ciclo ABERTO encerra.`,
      );
    }

    // Encerrar com avaliação pendente encerraria em silêncio — a API recusa e
    // diz QUANTAS são, para a tela poder perguntar em vez de adivinhar.
    const pendentes = await this.prisma.avaliacao.count({
      where: { cicloId, status: { in: ['PENDENTE', 'EM_ANDAMENTO'] } },
    });
    const motivo = opcoes.motivo?.trim() ?? '';
    if (pendentes > 0 && !opcoes.confirmarPendentes) {
      // ⭐ A recusa DIZ QUANTAS e DIZ A SAÍDA. Recusa sem alternativa manda a
      // pessoa procurar sozinha um caminho — e o que ela acha é criar outro
      // ciclo, que duplica resultado sem ninguém decidir.
      throw new BadRequestException(
        `Não é possível encerrar: ${pendentes} avaliação(ões) ainda não foram enviadas. ` +
          'Se elas não vão entrar (pessoa desligada, afastada, avaliador que não vai responder), ' +
          // ⚠️ "e as 1 ficam" — a concordância quebrava com pendência única, e a
          // frase é lida pela gestora. O número já está no começo da mensagem.
          'encerre com pendência: exige confirmação e motivo escrito, e elas ficam ' +
          'registradas como CANCELADAS — nada é apagado, e a contagem aparece no painel.',
      );
    }
    if (pendentes > 0 && motivo.length < 3) {
      throw new BadRequestException(
        'Informe o motivo de encerrar com pendência. Ele fica registrado no ciclo e em cada ' +
          'avaliação cancelada — é o que responde, meses depois, por que estas ficaram sem nota.',
      );
    }

    const encerrado = await this.prisma.$transaction(async (tx) => {
      if (pendentes > 0) {
        await tx.avaliacao.updateMany({
          where: { cicloId, status: { in: ['PENDENTE', 'EM_ANDAMENTO'] } },
          data: {
            status: 'CANCELADA',
            canceladaEm: new Date(),
            canceladaPorId: usuarioId,
            motivoCancelamento: `Ciclo encerrado com pendência: ${motivo}`,
          },
        });
      }
      const ciclo = await tx.ciclo.update({
        where: { id: cicloId },
        data: { status: 'ENCERRADO', encerradoEm: new Date() },
      });
      await this.auditoria.registrar({
        entidade: 'Ciclo',
        entidadeId: cicloId,
        // ⚠️ Ação DIFERENTE quando houve override: "ENCERRAR" e "encerrar
        // cancelando 891 avaliações" não podem ter o mesmo nome na auditoria.
        acao: pendentes > 0 ? 'ENCERRAR_COM_PENDENCIA' : 'ENCERRAR',
        usuarioId,
        valorNovo: pendentes > 0 ? { canceladas: pendentes, motivo } : undefined,
      });
      return ciclo;
    });
    return { ...encerrado, avaliacoesCanceladas: pendentes };
  }

  /**
   * ⭐⭐ REABRIR O CICLO — a porta que faz a recusa do encerrado ser honesta.
   *
   * Mesmo desenho do reabrir AVALIAÇÃO: `RH_ADMIN`, **motivo obrigatório**,
   * auditado, e o rastro fica no registro (`reabertoEm`, `reabertoPorId`,
   * `motivoReabertura`) ao lado do `encerradoEm`, que **não se apaga** — a
   * história é que ele foi encerrado e depois reaberto, não que nunca encerrou.
   *
   * ⚠️ **Volta para ABERTO, nunca para RASCUNHO.** RASCUNHO reabriria a porta de
   * criar aplicação e mudar peso — e peso mudado depois de existir resultado é
   * reapuração silenciosa, com nota diferente para quem já recebeu devolutiva.
   * Reabrir é para corrigir o que aconteceu DENTRO do ciclo (designação,
   * avaliação, apuração), não para remontá-lo.
   */
  async reabrir(cicloId: string, motivo: string, usuarioId: string) {
    if (!motivo?.trim()) {
      // Mesma exigência do reabrir avaliação: sem motivo, a linha vira "alguém
      // reabriu algo" — que é o mesmo que não ter registro nenhum.
      throw new BadRequestException('Informe o motivo da reabertura.');
    }
    const ciclo = await this.prisma.ciclo.findUnique({ where: { id: cicloId } });
    if (!ciclo) throw new NotFoundException('Ciclo não encontrado.');
    if (ciclo.status !== 'ENCERRADO') {
      throw new BadRequestException(
        `O ciclo está ${ciclo.status} — só um ciclo ENCERRADO é reaberto.`,
      );
    }

    const reaberto = await this.prisma.ciclo.update({
      where: { id: cicloId },
      data: {
        status: 'ABERTO',
        reabertoEm: new Date(),
        reabertoPorId: usuarioId,
        motivoReabertura: motivo.trim(),
      },
    });
    await this.auditoria.registrar({
      entidade: 'Ciclo',
      entidadeId: cicloId,
      acao: 'REABRIR',
      usuarioId,
      justificativa: motivo.trim(),
      valorAnterior: { status: 'ENCERRADO', encerradoEm: ciclo.encerradoEm },
      valorNovo: { status: 'ABERTO' },
    });
    return reaberto;
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
        // ⭐⭐ `_count` FILTRADO. Sem o `where`, a relação conta TODAS as linhas,
        // canceladas inclusive — e este é o número do card da lista ("52
        // avaliações") que discordava do "Faltam 37" logo abaixo, no mesmo
        // render. Ver `avaliacoes-que-contam.ts` e o invariante que varre o
        // fonte cobrando isto.
        include: {
          _count: { select: { aplicacoes: true, avaliacoes: { where: ONDE_A_AVALIACAO_CONTA } } },
        },
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
        /**
         * ⚠️ A BASE do ciclo — quantas avaliações ele tem — viaja junto porque
         * é o que qualifica todo número lido depois. A tela de Resultados
         * mostrava "3 resultado(s) · média 62,59" sem dizer que os 3 são de
         * 894: uma semana depois isso lê como número oficial. Mesma contagem
         * agregada da listagem.
         */
        // ⭐ Filtrado, como na listagem: cancelada não é avaliação do ciclo.
        _count: { select: { aplicacoes: true, avaliacoes: { where: ONDE_A_AVALIACAO_CONTA } } },
        conceitos: { orderBy: { ordem: 'asc' } },
        aplicacoes: {
          include: {
            modeloVersao: { include: { modelo: true } },
            criterios: { include: { criterio: true } },
            centrosCusto: true,
            // Quantas pessoas no público NOMINAL — é o que decide se a aplicação
            // alcança alguém. Ver `problemasParaAbrir`.
            _count: { select: { publico: true } },
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
