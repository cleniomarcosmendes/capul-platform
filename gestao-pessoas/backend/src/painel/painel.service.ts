/**
 * PAINEL — o acompanhamento do ciclo enquanto ele corre.
 *
 * A pergunta que esta tela responde é sempre a mesma: **o que falta para o
 * ciclo fechar?** Por isso ela não mostra médias nem gráficos de nota (isso é
 * Resultados) e sim três coisas, nesta ordem:
 *
 *   1. quanto falta, por aplicação;
 *   2. QUEM está segurando — a fila por avaliador, do mais atrasado ao menos,
 *      porque quem cobra precisa de nome, não de percentual;
 *   3. quem é elegível e ficou SEM designação — a única pendência que não
 *      aparece em lugar nenhum e faz a pessoa sumir do ciclo em silêncio.
 *
 * ⭐ O item 3 é a razão de o painel existir cedo. `Avaliacao` só nasce na
 * designação: quem a régua incluiu e ninguém designou não tem linha, não tem
 * status, e não entra em nenhuma contagem — ficaria de fora sem erro nenhum.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { DesignacaoService } from '../designacao/designacao.service.js';

export interface ProgressoDaAplicacao {
  aplicacaoId: string;
  nome: string;
  designados: number;
  enviadas: number;
  emAndamento: number;
  pendentes: number;
  canceladas: number;
  /** Elegíveis da régua que ninguém designou — não têm avaliação nenhuma. */
  semDesignacao: number;
}

export interface FilaDoAvaliador {
  avaliadorId: string;
  nome: string;
  matricula: string;
  total: number;
  enviadas: number;
  aFazer: number;
}

export interface PainelDoCiclo {
  ciclo: {
    id: string;
    nome: string;
    status: string;
    periodoInicio: Date;
    periodoFim: Date;
    dataBase: Date;
  };
  designados: number;
  enviadas: number;
  aFazer: number;
  semDesignacao: number;
  aplicacoes: ProgressoDaAplicacao[];
  avaliadores: FilaDoAvaliador[];
}

@Injectable()
export class PainelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly designacao: DesignacaoService,
  ) {}

  async doCiclo(cicloId: string): Promise<PainelDoCiclo> {
    const ciclo = await this.prisma.ciclo.findUnique({
      where: { id: cicloId },
      include: { aplicacoes: { orderBy: { ordem: 'asc' } } },
    });
    if (!ciclo) throw new NotFoundException('Ciclo não encontrado.');

    const porAplicacaoEStatus = await this.prisma.avaliacao.groupBy({
      by: ['aplicacaoId', 'status'],
      where: { cicloId },
      _count: { _all: true },
    });

    const aplicacoes: ProgressoDaAplicacao[] = [];
    for (const a of ciclo.aplicacoes) {
      const linhas = porAplicacaoEStatus.filter((l) => l.aplicacaoId === a.id);
      const conta = (s: string) => linhas.find((l) => l.status === s)?._count._all ?? 0;
      const designados = linhas.reduce((t, l) => t + l._count._all, 0);

      // A lista de elegibilidade é a mesma da tela de Designação — de propósito.
      // Duas contas de "quem deveria estar no ciclo" divergem no primeiro ajuste
      // manual, e aí o painel diz que falta gente que já foi resolvida.
      const elegiveis = (await this.designacao.listar(a.id)).filter((l) => l.elegivel);
      // groupBy e não findMany de propósito: o painel precisa saber QUEM já tem
      // avaliação, nunca o que há dentro dela. Consulta agregada deixa isso
      // explícito para o invariante e para quem ler depois.
      const comAvaliacao = new Set(
        (
          await this.prisma.avaliacao.groupBy({
            by: ['avaliadoId'],
            where: { aplicacaoId: a.id },
          })
        ).map((x) => x.avaliadoId),
      );

      aplicacoes.push({
        aplicacaoId: a.id,
        nome: a.nome,
        designados,
        enviadas: conta('ENVIADA'),
        emAndamento: conta('EM_ANDAMENTO'),
        pendentes: conta('PENDENTE'),
        canceladas: conta('CANCELADA'),
        semDesignacao: elegiveis.filter((e) => !comAvaliacao.has(e.colaboradorId)).length,
      });
    }

    return {
      ciclo: {
        id: ciclo.id,
        nome: ciclo.nome,
        status: ciclo.status,
        periodoInicio: ciclo.periodoInicio,
        periodoFim: ciclo.periodoFim,
        dataBase: ciclo.dataBase,
      },
      designados: aplicacoes.reduce((t, a) => t + a.designados, 0),
      enviadas: aplicacoes.reduce((t, a) => t + a.enviadas, 0),
      aFazer: aplicacoes.reduce((t, a) => t + a.pendentes + a.emAndamento, 0),
      semDesignacao: aplicacoes.reduce((t, a) => t + a.semDesignacao, 0),
      aplicacoes,
      avaliadores: await this.filaPorAvaliador(cicloId),
    };
  }

  /**
   * Fila por avaliador, do mais atrasado para o menos. Cancelada fica fora da
   * conta: não é trabalho de ninguém, e somá-la faria a fila de quem não deve
   * nada parecer cheia.
   */
  private async filaPorAvaliador(cicloId: string): Promise<FilaDoAvaliador[]> {
    const linhas = await this.prisma.avaliacao.groupBy({
      by: ['avaliadorId', 'status'],
      where: { cicloId, status: { not: 'CANCELADA' } },
      _count: { _all: true },
    });
    if (linhas.length === 0) return [];

    const pessoas = await this.prisma.colaborador.findMany({
      where: { id: { in: [...new Set(linhas.map((l) => l.avaliadorId))] } },
      select: { id: true, nome: true, matricula: true },
    });
    const porId = new Map(pessoas.map((p) => [p.id, p]));

    const acumulado = new Map<string, FilaDoAvaliador>();
    for (const l of linhas) {
      const atual =
        acumulado.get(l.avaliadorId) ??
        {
          avaliadorId: l.avaliadorId,
          nome: porId.get(l.avaliadorId)?.nome ?? '(colaborador não encontrado)',
          matricula: porId.get(l.avaliadorId)?.matricula ?? '',
          total: 0,
          enviadas: 0,
          aFazer: 0,
        };
      atual.total += l._count._all;
      if (l.status === 'ENVIADA') atual.enviadas += l._count._all;
      else atual.aFazer += l._count._all;
      acumulado.set(l.avaliadorId, atual);
    }

    return [...acumulado.values()].sort((a, b) => b.aFazer - a.aFazer || a.nome.localeCompare(b.nome));
  }
}
