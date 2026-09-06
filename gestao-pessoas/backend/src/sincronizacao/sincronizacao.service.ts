/**
 * SINCRONIZAÇÃO DE COLABORADORES — do Protheus para `rh`.
 *
 * ⭐⭐ **SOMENTE LEITURA NA ORIGEM.** O ambiente de DESENVOLVIMENTO aponta para o
 * Protheus de PRODUÇÃO: gravar daqui gravaria na produção da empresa. Este
 * serviço lê a fonte (hoje CSV) e escreve **apenas** no schema `rh`. A garantia
 * é estrutural — a interface `FonteColaboradores` não tem método de escrita.
 *
 * ── Reexecução segura ───────────────────────────────────────────────────────
 * Tudo é upsert por chave natural: colaborador por `(filial, matricula)`,
 * histórico por `(colaborador, filial, data, sequencia)`. Rodar duas vezes não
 * duplica nada. Treinamento é substituído por pessoa (não tem chave natural na
 * origem), o que também é idempotente.
 *
 * ── Nada é descartado em silêncio ───────────────────────────────────────────
 * O relatório devolve as recusas com motivo, e o histórico grava até as linhas
 * que não alimentam o cálculo, marcadas. Quem rodar o sync consegue explicar
 * cada linha do arquivo.
 */
import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { dataOpcional } from './csv.js';
import { resolverDataUltimaFuncao } from './data-ultima-funcao.js';
import { prepararHistorico, paraMovimentos, separarUtilizaveis } from './historico-funcional.js';
import { filialAtualPorMatricula, mapearColaboradores, type Recusa } from './mapeamento.js';
import { FONTE_COLABORADORES, type FonteColaboradores } from './fonte.port.js';

export interface RelatorioSincronizacao {
  fonte: string;
  iniciadoEm: string;
  duracaoMs: number;
  colaboradores: {
    lidos: number;
    gravados: number;
    recusados: number;
    /** Agrupado por motivo — a lista pessoa a pessoa vai no log, não na resposta. */
    porMotivoDeRecusa: Record<string, number>;
  };
  historicoFuncional: {
    lidos: number;
    gravados: number;
    consideradosNoCalculo: number;
    descartadosPorFilial: number;
    semColaborador: number;
    /** Linhas que não dá para gravar — sem data ou sem função na origem. */
    invalidas: number;
  };
  treinamentos: {
    lidos: number;
    gravados: number;
    semColaborador: number;
    /** Curso sem data de início — não é gravável. */
    semDataInicio: number;
  };
  /** Até 50 recusas, para a tela mostrar sem virar despejo. */
  amostraDeRecusas: Recusa[];
}

@Injectable()
export class SincronizacaoService {
  private readonly logger = new Logger(SincronizacaoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    @Inject(FONTE_COLABORADORES) private readonly fonte: FonteColaboradores,
  ) {}

  async sincronizar(usuarioId: string): Promise<RelatorioSincronizacao> {
    const inicio = Date.now();
    const iniciadoEm = new Date().toISOString();
    this.logger.log(`Sincronização iniciada por ${usuarioId} — fonte: ${this.fonte.descricao}`);

    const [linhasColaborador, linhasHistorico, linhasTreinamento] = await Promise.all([
      this.fonte.lerColaboradores(),
      this.fonte.lerHistoricoFuncional(),
      this.fonte.lerTreinamentos(),
    ]);

    const { aceitos, recusados } = mapearColaboradores(linhasColaborador);
    for (const r of recusados) {
      this.logger.warn(`Recusado ${r.filial}/${r.matricula} ${r.nome}: ${r.detalhe}`);
    }

    // 1) Colaboradores — upsert por (filial, matricula).
    const idPorMatricula = new Map<string, string>();
    for (const c of aceitos) {
      const dados = {
        nome: c.nome,
        cpf: c.cpf,
        centroCusto: c.centroCusto,
        centroCustoDescricao: c.centroCustoDescricao,
        cargoDescricao: c.cargoDescricao,
        dataAdmissao: dataOpcional(c.dataAdmissao)!,
        dataDemissao: dataOpcional(c.dataDemissao),
        situacao: c.situacao,
        grauInstrucaoCodigo: c.grauInstrucaoCodigo,
        grauInstrucaoDescricao: c.grauInstrucaoDescricao,
        descricaoFuncao: c.descricaoFuncao,
        sincronizadoEm: new Date(),
      };
      const salvo = await this.prisma.colaborador.upsert({
        where: { filial_matricula: { filial: c.filial, matricula: c.matricula } },
        update: dados,
        create: { filial: c.filial, matricula: c.matricula, ...dados },
        select: { id: true },
      });
      idPorMatricula.set(c.matricula, salvo.id);
    }

    // 2) Histórico funcional — grava TUDO, marcando o que não alimenta o cálculo.
    const { utilizaveis, invalidas } = separarUtilizaveis(linhasHistorico);
    for (const i of invalidas) this.logger.warn(i.detalhe);
    const preparadas = prepararHistorico(utilizaveis, filialAtualPorMatricula(aceitos));
    let gravadasHistorico = 0;
    let semColaborador = 0;
    let descartadasPorFilial = 0;

    for (const h of preparadas) {
      const colaboradorId = idPorMatricula.get(h.matricula);
      if (!colaboradorId) {
        // Sem colaborador na base não há onde pendurar a linha (a FK exige).
        // São os expurgados do SRA que ainda têm histórico — contados no
        // relatório para o total do arquivo fechar.
        semColaborador++;
        continue;
      }
      if (!h.consideradoNoCalculo) descartadasPorFilial++;

      const dados = {
        funcaoCodigo: h.funcaoCodigo,
        funcaoDescricao: h.funcaoDescricao ?? null,
        tipo: h.tipo ?? null,
        origem: h.origem,
        consideradoNoCalculo: h.consideradoNoCalculo,
        motivoDescarte: h.motivoDescarte,
        sincronizadoEm: new Date(),
      };
      await this.prisma.colaboradorFuncaoHistorico.upsert({
        where: {
          colaboradorId_filial_data_sequencia_recnoOrigem: {
            colaboradorId,
            filial: h.filial,
            data: dataOpcional(h.data)!,
            sequencia: h.sequencia,
            recnoOrigem: h.recnoOrigem ?? 0,
          },
        },
        update: dados,
        create: {
          colaboradorId,
          filial: h.filial,
          data: dataOpcional(h.data)!,
          sequencia: h.sequencia,
          recnoOrigem: h.recnoOrigem ?? 0,
          ...dados,
        },
      });
      gravadasHistorico++;
    }

    // 3) `dataUltimaFuncao` corrente, derivada do que alimenta o cálculo.
    //    O valor com recorte na data-base sai do histórico, na apuração — aqui
    //    grava-se o corrente, que é o que as telas mostram.
    const consideradasPorMatricula = new Map<string, typeof preparadas>();
    for (const h of preparadas.filter((x) => x.consideradoNoCalculo)) {
      consideradasPorMatricula.set(h.matricula, [
        ...(consideradasPorMatricula.get(h.matricula) ?? []),
        h,
      ]);
    }
    for (const c of aceitos) {
      const movimentos = paraMovimentos(consideradasPorMatricula.get(c.matricula) ?? []);
      const { data } = resolverDataUltimaFuncao(movimentos, c.dataAdmissao);
      await this.prisma.colaborador.update({
        where: { filial_matricula: { filial: c.filial, matricula: c.matricula } },
        data: { dataUltimaFuncao: dataOpcional(data) },
      });
    }

    // 4) Treinamentos — substitui os da origem PROTHEUS_RA4 por pessoa.
    let gravadosTreinamento = 0;
    let treinamentoSemColaborador = 0;
    const porColaborador = new Map<string, typeof linhasTreinamento>();
    for (const t of linhasTreinamento) {
      const id = idPorMatricula.get((t.matricula ?? '').trim());
      if (!id) {
        treinamentoSemColaborador++;
        continue;
      }
      porColaborador.set(id, [...(porColaborador.get(id) ?? []), t]);
    }
    let treinamentoSemDataInicio = 0;
    for (const [colaboradorId, cursos] of porColaborador) {
      // Curso sem data de início não é gravável; contado à parte, como o resto.
      const gravaveis = cursos.filter((t) => dataOpcional(t.dataInicio));
      treinamentoSemDataInicio += cursos.length - gravaveis.length;
      await this.prisma.$transaction([
        this.prisma.colaboradorTreinamento.deleteMany({
          where: { colaboradorId, origem: 'PROTHEUS_RA4' },
        }),
        this.prisma.colaboradorTreinamento.createMany({
          data: gravaveis
            .map((t) => ({
              colaboradorId,
              descricao: t.descricao,
              dataInicio: dataOpcional(t.dataInicio)!,
              dataFim: dataOpcional(t.dataFim),
              cargaHoraria: t.cargaHoraria ?? null,
              origem: 'PROTHEUS_RA4',
            })),
        }),
      ]);
      gravadosTreinamento += gravaveis.length;
    }

    const relatorio: RelatorioSincronizacao = {
      fonte: this.fonte.descricao,
      iniciadoEm,
      duracaoMs: Date.now() - inicio,
      colaboradores: {
        lidos: linhasColaborador.length,
        gravados: aceitos.length,
        recusados: recusados.length,
        porMotivoDeRecusa: contarPor(recusados, (r) => r.motivo),
      },
      historicoFuncional: {
        lidos: linhasHistorico.length,
        gravados: gravadasHistorico,
        consideradosNoCalculo: gravadasHistorico - descartadasPorFilial,
        descartadosPorFilial: descartadasPorFilial,
        semColaborador,
        invalidas: invalidas.length,
      },
      treinamentos: {
        lidos: linhasTreinamento.length,
        gravados: gravadosTreinamento,
        semColaborador: treinamentoSemColaborador,
        semDataInicio: treinamentoSemDataInicio,
      },
      amostraDeRecusas: recusados.slice(0, 50),
    };

    await this.auditoria.registrar({
      entidade: 'Sincronizacao',
      entidadeId: iniciadoEm,
      acao: 'SINCRONIZAR_COLABORADORES',
      usuarioId,
      valorNovo: relatorio as unknown as object,
    });

    this.logger.log(
      `Sincronização concluída em ${relatorio.duracaoMs}ms — ` +
        `${relatorio.colaboradores.gravados} colaboradores, ` +
        `${relatorio.historicoFuncional.gravados} lançamentos, ` +
        `${relatorio.treinamentos.gravados} treinamentos.`,
    );
    return relatorio;
  }
}

function contarPor<T>(itens: readonly T[], chave: (item: T) => string): Record<string, number> {
  const contagem: Record<string, number> = {};
  for (const item of itens) {
    const k = chave(item);
    contagem[k] = (contagem[k] ?? 0) + 1;
  }
  return contagem;
}
