/**
 * APURAÇÃO — liga o motor ao banco.
 *
 * Avaliar e apurar são etapas separadas: `Avaliacao.notaAvaliacao` foi congelada
 * no ENVIO, só do questionário. Aqui se combina com os critérios cadastrais,
 * pelos pesos da Aplicação, e grava `ResultadoAvaliacao` + um
 * `ResultadoCriterio` por critério. Mudar peso vira REAPURAÇÃO, sem reabrir
 * avaliação nenhuma.
 *
 * ⭐ ESCOPO. A reapuração é por CICLO ou por APLICAÇÃO — nunca por colaborador.
 * Recorte por pessoa deixaria alguém isolar a própria linha e contornar a
 * separação de funções por um caminho legítimo (`assertEscopoReapuracaoValido`).
 */
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { conceitoDaNota } from '../ciclo/abertura.validator.js';
import { agregarAlertas, apurarColaborador, type AlertaAgregado, type AlertaApuracao, type CriterioConfigurado } from '../calculo/motor.js';
import type { Faixa } from '../calculo/faixa.js';
import { assertEscopoReapuracaoValido, type EscopoReapuracao } from '../avaliacao/separacao-funcoes.js';
import { assertCicloOperavel } from '../ciclo/ciclo-operavel.js';
import { apagarResultadoDe } from './apagar-resultado.js';

export interface ResultadoDaApuracao {
  escopo: EscopoReapuracao;
  avaliacoesApuradas: number;
  semNotaDeAvaliacao: number;
  /** Pendências agregadas, para a tela mostrar antes do fechamento do ciclo. */
  alertas: AlertaAgregado[];
}

@Injectable()
export class ApuracaoService {
  private readonly logger = new Logger(ApuracaoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Apura de verdade: calcula, GRAVA o resultado e registra em auditoria. */
  apurar(escopo: EscopoReapuracao, usuarioId: string): Promise<ResultadoDaApuracao> {
    return this.executar(escopo, usuarioId, true);
  }

  /**
   * CONFERIR — a mesma conta, sem gravar nada.
   *
   * É o que alimenta a tela de pendências cadastrais: as faixas que faltam e os
   * dados que não existem aparecem para o RH resolver ANTES de o ciclo fechar,
   * e não como efeito colateral de ter apurado. Roda o motor idêntico de
   * propósito — pendência descoberta por uma segunda implementação seria
   * pendência que a apuração real talvez não tenha.
   *
   * Diferente de `apurar`, ciclo sem nenhuma avaliação enviada NÃO é erro aqui:
   * é o começo do ciclo, e a tela precisa abrir mesmo assim.
   */
  conferir(escopo: EscopoReapuracao): Promise<ResultadoDaApuracao> {
    return this.executar(escopo, null, false);
  }

  /** O ciclo do escopo — direto (CICLO) ou pela aplicação (APLICACAO). */
  private async cicloDoEscopo(escopo: EscopoReapuracao) {
    if (escopo.tipo === 'CICLO') {
      return this.prisma.ciclo.findUnique({
        where: { id: escopo.cicloId },
        select: { status: true, encerradoEm: true },
      });
    }
    const aplicacao = await this.prisma.aplicacao.findUnique({
      where: { id: escopo.aplicacaoId },
      select: { ciclo: { select: { status: true, encerradoEm: true } } },
    });
    return aplicacao?.ciclo ?? null;
  }

  private async executar(
    escopo: EscopoReapuracao,
    usuarioId: string | null,
    gravar: boolean,
  ): Promise<ResultadoDaApuracao> {
    assertEscopoReapuracaoValido(escopo);

    /**
     * ⚠️ Só quando GRAVA. `conferir` (gravar = false) é o que alimenta a
     * conferência do painel e continua valendo no ciclo encerrado — é leitura.
     * Apurar é o ato mais perigoso de fazer num ciclo encerrado: muda a NOTA de
     * gente cujo resultado já foi comunicado.
     */
    if (gravar) {
      const ciclo = await this.cicloDoEscopo(escopo);
      if (ciclo) assertCicloOperavel(ciclo, 'apuração');
    }

    const avaliacoes = await this.prisma.avaliacao.findMany({
      where: {
        status: 'ENVIADA',
        ...(escopo.tipo === 'CICLO' ? { cicloId: escopo.cicloId } : { aplicacaoId: escopo.aplicacaoId }),
      },
      include: {
        ciclo: { include: { conceitos: { orderBy: { ordem: 'asc' } } } },
        aplicacao: { include: { criterios: { include: { criterio: { include: { faixas: true } } } } } },
      },
    });
    if (avaliacoes.length === 0 && gravar) {
      throw new BadRequestException('Nenhuma avaliação enviada neste escopo — nada a apurar.');
    }

    const todosAlertas: AlertaApuracao[] = [];
    let apuradas = 0;
    let semNota = 0;

    for (const avaliacao of avaliacoes) {
      if (avaliacao.notaAvaliacao === null) {
        // Enviada sem nota é inconsistência de estado: a nota é calculada NO
        // envio. Conta e segue — travar a apuração das outras não ajudaria.
        semNota++;
        this.logger.warn(`Avaliação ${avaliacao.id} está ENVIADA sem notaAvaliacao.`);
        continue;
      }

      const colaborador = await this.carregarColaborador(avaliacao.avaliadoId);
      const dataBase = paraAaaammdd(avaliacao.ciclo.dataBase);

      const { resultado, alertas } = apurarColaborador({
        notaAvaliacao: Number(avaliacao.notaAvaliacao),
        pesoAvaliacao: Number(avaliacao.aplicacao.pesoAvaliacao),
        criterios: avaliacao.aplicacao.criterios.map(
          (ac): CriterioConfigurado => ({
            criterioId: ac.criterioId,
            codigo: ac.criterio.codigo,
            nome: ac.criterio.nome,
            origem: ac.criterio.origem,
            codigoCalculo: ac.criterio.codigoCalculo,
            peso: Number(ac.peso),
            faixas: ac.criterio.faixas.map(paraFaixa),
          }),
        ),
        colaborador,
        ciclo: { dataBase, janelaTreinamentoMeses: avaliacao.ciclo.janelaTreinamentoMeses },
        valoresInformados: await this.valoresInformados(avaliacao.cicloId, avaliacao.avaliadoId),
      });
      todosAlertas.push(...alertas);

      const conceito = conceitoDaNota(
        avaliacao.ciclo.conceitos.map((c) => ({
          id: c.id,
          descricao: c.descricao,
          limiteInferior: Number(c.limiteInferior),
          limiteSuperior: Number(c.limiteSuperior),
        })),
        resultado.notaFinal,
      );

      if (!gravar) {
        apuradas++;
        continue;
      }

      await this.prisma.$transaction(async (tx) => {
        // Reapuração: a memória de cálculo antiga sai junto com o resultado
        // antigo — resultado novo com critério velho pendurado seria pior que
        // não ter memória nenhuma. A sequência mora em `apagarResultadoDe`,
        // compartilhada com a reabertura da avaliação.
        await apagarResultadoDe(tx as never, avaliacao.id);
        await tx.resultadoAvaliacao.create({
          data: {
            cicloId: avaliacao.cicloId,
            avaliacaoId: avaliacao.id,
            colaboradorId: avaliacao.avaliadoId,
            notaAvaliacao: resultado.notaAvaliacao,
            pesoAvaliacao: resultado.pesoAvaliacao,
            notaCriterios: resultado.notaCriterios,
            notaFinal: resultado.notaFinal,
            conceitoId: conceito?.id ?? null,
            conceitoDescricao: conceito?.descricao ?? null,
            houveRenormalizacao: resultado.houveRenormalizacao,
            criterios: {
              create: resultado.criterios.map((c) => ({
                criterioId: c.criterioId,
                criterioNome: c.criterioNome,
                valorBruto: c.valorBruto,
                valorTexto: c.valorTexto,
                faixaId: c.faixaId,
                pontuacao: c.pontuacao,
                pesoAplicado: c.peso,
                semDado: c.semDado,
              })),
            },
          },
        });
      });
      apuradas++;
    }

    const relatorio: ResultadoDaApuracao = {
      escopo,
      avaliacoesApuradas: apuradas,
      semNotaDeAvaliacao: semNota,
      alertas: agregarAlertas(todosAlertas),
    };

    if (!gravar) return relatorio;

    await this.auditoria.registrar({
      entidade: escopo.tipo === 'CICLO' ? 'Ciclo' : 'Aplicacao',
      entidadeId: escopo.tipo === 'CICLO' ? escopo.cicloId : escopo.aplicacaoId,
      acao: 'APURAR',
      usuarioId: usuarioId as string,
      valorNovo: {
        avaliacoesApuradas: apuradas,
        semNotaDeAvaliacao: semNota,
        alertas: relatorio.alertas.length,
      },
    });
    return relatorio;
  }

  /**
   * Dados do colaborador para os resolvers — incluindo o HISTÓRICO funcional,
   * que é o que permite o recorte pela data-base e faz a reapuração de um ciclo
   * antigo devolver o mesmo número de sempre.
   */
  private async carregarColaborador(colaboradorId: string) {
    const c = await this.prisma.colaborador.findUniqueOrThrow({
      where: { id: colaboradorId },
      include: {
        funcaoHistorico: { where: { consideradoNoCalculo: true }, orderBy: { data: 'asc' } },
        treinamentos: { where: { dataFim: { not: null } } },
      },
    });
    return {
      grauInstrucaoCodigo: c.grauInstrucaoCodigo,
      dataAdmissao: paraAaaammdd(c.dataAdmissao),
      dataUltimaFuncao: c.dataUltimaFuncao ? paraAaaammdd(c.dataUltimaFuncao) : null,
      historicoFuncao: c.funcaoHistorico.map((h) => ({
        data: paraAaaammdd(h.data),
        sequencia: h.sequencia,
        funcaoCodigo: h.funcaoCodigo,
      })),
      treinamentosConcluidos: c.treinamentos.map((t) => paraAaaammdd(t.dataFim!)),
    };
  }

  private async valoresInformados(cicloId: string, colaboradorId: string) {
    const linhas = await this.prisma.criterioValorInformado.findMany({
      where: { cicloId, colaboradorId },
    });
    return linhas.map((v) => ({
      criterioId: v.criterioId,
      valorNumerico: v.valorNumerico === null ? null : Number(v.valorNumerico),
      valorTexto: v.valorTexto,
    }));
  }
}

/** Date → AAAAMMDD (UTC), que é como os resolvers falam. */
function paraAaaammdd(data: Date): string {
  return (
    String(data.getUTCFullYear()).padStart(4, '0') +
    String(data.getUTCMonth() + 1).padStart(2, '0') +
    String(data.getUTCDate()).padStart(2, '0')
  );
}

function paraFaixa(f: {
  id: string;
  tipo: string;
  limiteInferior: unknown;
  limiteSuperior: unknown;
  inclusivoInf: boolean;
  inclusivoSup: boolean;
  valorDominio: string | null;
  pontuacao: unknown;
  rotulo: string | null;
  ordem: number;
}): Faixa {
  return {
    id: f.id,
    tipo: f.tipo as 'NUMERICA' | 'DOMINIO',
    limiteInferior: f.limiteInferior === null ? null : Number(f.limiteInferior),
    limiteSuperior: f.limiteSuperior === null ? null : Number(f.limiteSuperior),
    inclusivoInf: f.inclusivoInf,
    inclusivoSup: f.inclusivoSup,
    valorDominio: f.valorDominio,
    pontuacao: Number(f.pontuacao),
    rotulo: f.rotulo,
    ordem: f.ordem,
  };
}
