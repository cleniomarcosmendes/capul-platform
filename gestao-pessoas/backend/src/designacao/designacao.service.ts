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
  /**
   * ⭐ Quem avalia esta pessoa — null quando ninguém foi designado ainda.
   *
   * Sem isto a tela não tem como dizer o que FALTA: elegível sem avaliador não
   * gera `Avaliacao`, some de toda contagem e fica de fora do ciclo sem erro
   * nenhum. É a mesma pendência que o painel conta como `semDesignacao`.
   */
  avaliadorId: string | null;
  avaliadorNome: string | null;
  avaliacaoStatus: string | null;
}

interface DesignacaoVigente {
  avaliadorId: string;
  avaliadorNome: string;
  status: string;
}

@Injectable()
export class DesignacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Lista da aplicação: o PÚBLICO NOMINAL dela, com a régua aplicada e as
   * decisões manuais já sobrepostas.
   *
   * ⭐ O público vem de `rh.aplicacao_publico`, uma linha por pessoa — não mais
   * do recorte por centro de custo. A estrutura de gestão não coincide com a
   * contábil: a equipe de limpeza são 46 pessoas em 19 pares filial × CC, e os
   * 31 aprendizes estão em 15 pares, todos compartilhados com gente efetiva.
   * Centro de custo e filial continuam existindo como ATALHO de preenchimento
   * na tela, e ficam registrados em `origem` + `origemReferencia`.
   *
   * ⚠️ Público vazio devolve lista vazia. Antes, aplicação sem centro de custo
   * caía num `where` sem filtro e trazia as 1.036 pessoas — "ainda não
   * configurei" e "todo mundo" eram o mesmo estado.
   */
  async listar(aplicacaoId: string): Promise<LinhaDaLista[]> {
    const aplicacao = await this.prisma.aplicacao.findUnique({
      where: { id: aplicacaoId },
      include: { ciclo: true },
    });
    if (!aplicacao) throw new NotFoundException('Aplicação não encontrada.');

    const noPublico = await this.prisma.aplicacaoPublico.findMany({
      where: { aplicacaoId },
      select: { colaboradorId: true },
    });
    const colaboradores = await this.prisma.colaborador.findMany({
      where: {
        id: { in: noPublico.map((p) => p.colaboradorId) },
        situacao: { in: SITUACOES_ELEGIVEIS as never[] },
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
    const designadas = await this.designacoesVigentes(aplicacao.cicloId);

    const semDesignacao = { avaliadorId: null, avaliadorNome: null, avaliacaoStatus: null };
    const linhas: LinhaDaLista[] = [
      ...incluidos.map((c) => ({
        ...this.paraLinha(c),
        ...semDesignacao,
        elegivel: true,
        motivo: null,
        justificativa: null,
        decididoManualmente: false,
      })),
      ...excluidos.map((c) => ({
        ...this.paraLinha(c),
        ...semDesignacao,
        elegivel: false,
        motivo: c.motivo as MotivoExclusao | null,
        justificativa: c.justificativa as string | null,
        decididoManualmente: false,
      })),
    ];

    // A decisão manual SOBREPÕE a régua, nos dois sentidos.
    return linhas.map((linha) => {
      const designada = designadas.get(linha.colaboradorId);
      const comDesignacao = {
        ...linha,
        avaliadorId: designada?.avaliadorId ?? null,
        avaliadorNome: designada?.avaliadorNome ?? null,
        avaliacaoStatus: designada?.status ?? null,
      };

      const decisao = decisoes.get(linha.colaboradorId);
      if (!decisao) return { ...comDesignacao, decididoManualmente: false };
      return {
        ...comDesignacao,
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
   *
   * ⚠️ Quando a pessoa JÁ tem avaliação neste ciclo e a designação a manda para
   * OUTRA aplicação, a troca passa por `assertPodeTrocarDeAplicacao` antes de
   * qualquer escrita. Ver o comentário lá: é o defeito silencioso que nasceu
   * dentro deste método.
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

    const existente = await this.prisma.avaliacao.findUnique({
      where: { cicloId_avaliadoId: { cicloId: aplicacao.cicloId, avaliadoId } },
      select: { id: true, aplicacaoId: true, avaliadorId: true, status: true },
    });
    const trocaDeAplicacao = existente !== null && existente.aplicacaoId !== aplicacaoId;
    if (trocaDeAplicacao) {
      await this.assertPodeTrocarDeAplicacao(existente, avaliado.nome);
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
      // A troca de aplicação é ato distinto de designar pela primeira vez: muda
      // QUAL questionário a pessoa responde, e quem for reconstruir o ciclo
      // meses depois precisa achar isso sem ler o diff de dois campos.
      acao: trocaDeAplicacao ? 'DESIGNAR_TROCA_APLICACAO' : 'DESIGNAR',
      usuarioId,
      valorAnterior: existente
        ? { aplicacaoId: existente.aplicacaoId, avaliadorId: existente.avaliadorId, status: existente.status }
        : undefined,
      valorNovo: { avaliadoId, avaliadorId, aplicacaoId, origem },
    });
    return avaliacao;
  }

  /**
   * ⭐ TROCAR A APLICAÇÃO DE QUEM JÁ RESPONDEU PRODUZ NOTA ERRADA, SEM ERRO.
   *
   * `Resposta` aponta para perguntas de um modelo; `Avaliacao.aplicacaoId` é
   * quem decide de qual `ModeloVersao` as perguntas são lidas
   * (`avaliacao.service.ts`, `itensRespondidos`). Trocar a aplicação deixa as
   * respostas órfãs — e, se a avaliação já foi enviada, a apuração combina a
   * `notaAvaliacao` CONGELADA do modelo antigo com o `pesoAvaliacao` e os
   * `AplicacaoCriterio` da aplicação nova (`apuracao.service.ts`). Sai um
   * número diferente, e nada acusa: não há exceção, não há alerta, e a memória
   * de cálculo fica consistente consigo mesma.
   *
   * É a família de defeito que este módulo existe para eliminar — o antigo
   * dividia por 18 fixo, o `NVL` fora da soma dava média zero — e ela nasceu
   * aqui dentro, num `upsert` que atualizava `aplicacaoId` de passagem.
   *
   * A regra é uma só: **nada de valor se perde numa troca.**
   *
   *   - ENVIADA           → recusa sempre. A nota é o valor, mesmo sem resposta.
   *   - com N respostas   → recusa DIZENDO N, para a tela poder perguntar.
   *   - sem nada gravado  → passa, e a troca vai para a auditoria.
   *
   * ⚠️ Trocar só o AVALIADOR, dentro da mesma aplicação, NÃO passa por aqui:
   * não há modelo diferente envolvido e nenhuma resposta muda de instrumento.
   */
  private async assertPodeTrocarDeAplicacao(
    existente: { id: string; aplicacaoId: string; status: string },
    nomeDoAvaliado: string,
  ) {
    const [respostas, origem] = await Promise.all([
      this.prisma.resposta.count({ where: { avaliacaoId: existente.id } }),
      this.prisma.aplicacao.findUnique({
        where: { id: existente.aplicacaoId },
        select: { nome: true },
      }),
    ]);
    const de = origem?.nome ?? 'outra aplicação';

    if (existente.status === 'ENVIADA') {
      throw new BadRequestException(
        `${nomeDoAvaliado} já teve a avaliação ENVIADA na aplicação "${de}", e a nota do ` +
          'questionário está congelada nela. Mudar de aplicação agora faria a apuração ' +
          'combinar essa nota com os pesos e critérios de outro questionário, e o resultado ' +
          'sairia errado sem acusar erro. Para mudar de aplicação, peça a reabertura ao RH e ' +
          'apague as respostas antes.',
      );
    }

    if (respostas > 0) {
      throw new BadRequestException(
        `${nomeDoAvaliado} já tem ${respostas} resposta(s) gravada(s) na aplicação "${de}". ` +
          'As respostas pertencem às perguntas daquele questionário e não têm equivalente no ' +
          'outro — trocar a aplicação as deixaria órfãs e a nota sairia errada. Apague as ' +
          'respostas antes de mudar de aplicação.',
      );
    }
  }

  /** Quem já tem avaliador designado no ciclo, com o nome de quem avalia. */
  private async designacoesVigentes(cicloId: string) {
    const avaliacoes = await this.prisma.avaliacao.findMany({
      where: { cicloId },
      select: { avaliadoId: true, avaliadorId: true, status: true },
    });
    if (avaliacoes.length === 0) return new Map<string, DesignacaoVigente>();

    const avaliadores = await this.prisma.colaborador.findMany({
      where: { id: { in: [...new Set(avaliacoes.map((a) => a.avaliadorId))] } },
      select: { id: true, nome: true },
    });
    const nomePorId = new Map(avaliadores.map((c) => [c.id, c.nome]));

    return new Map<string, DesignacaoVigente>(
      avaliacoes.map((a) => [
        a.avaliadoId,
        {
          avaliadorId: a.avaliadorId,
          avaliadorNome: nomePorId.get(a.avaliadorId) ?? '(colaborador não encontrado)',
          status: a.status as string,
        },
      ]),
    );
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
