/**
 * AVALIAÇÃO — o que o avaliador faz: abrir, responder e enviar.
 *
 * ⭐ Todo acesso a registro individual passa pelo `AvaliacaoAcessoService`, que
 * é onde a separação de funções mora ("ninguém mexe na própria avaliação",
 * verificado por registro e não por papel). Há teste de invariante varrendo o
 * fonte para garantir que ninguém acesse `prisma.avaliacao` por fora.
 *
 * ⭐ A nota do QUESTIONÁRIO é calculada NO ENVIO e congelada em
 * `Avaliacao.notaAvaliacao`. Os critérios cadastrais não aparecem aqui — o
 * avaliador não pode ver "Tempo de Empresa: 75 pontos" ao lado das perguntas
 * que vai responder, porque isso ancora o julgamento.
 */
import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { calcularNotaAvaliacao, notaPorGrupo, type ItemRespondido } from '../calculo/nota-avaliacao.js';
import { AvaliacaoAcessoService, type ContextoAcesso } from './avaliacao-acesso.service.js';
import { marcarRestricoes } from './separacao-funcoes.js';

@Injectable()
export class AvaliacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acesso: AvaliacaoAcessoService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * A fila do avaliador: só o que lhe foi designado (decisão E2).
   * A própria avaliação dele, se estiver na lista, vem MARCADA — não filtrada.
   *
   * ⭐ Traz NOME e PROGRESSO de cada linha. Um supervisor com 30 liderados
   * precisa saber onde está sem abrir uma por uma — e "3 de 15 respondidas" é a
   * diferença entre retomar e recomeçar.
   */
  async minhasAvaliacoes(contexto: ContextoAcesso, cicloId?: string) {
    const linhas = await this.prisma.avaliacao.findMany({
      where: { avaliadorId: contexto.colaboradorId, ...(cicloId ? { cicloId } : {}) },
      orderBy: { criadoEm: 'asc' },
      select: {
        id: true,
        avaliadoId: true,
        status: true,
        enviadaEm: true,
        centroCustoSnapshot: true,
        cargoSnapshot: true,
        aplicacao: {
          select: {
            nome: true,
            modeloVersao: { select: { grupos: { select: { _count: { select: { perguntas: true } } } } } },
          },
        },
        _count: { select: { respostas: true } },
      },
    });

    const avaliados = await this.prisma.colaborador.findMany({
      where: { id: { in: linhas.map((l) => l.avaliadoId) } },
      select: { id: true, nome: true, matricula: true, cargoDescricao: true },
    });
    const porId = new Map(avaliados.map((c) => [c.id, c]));

    const comDados = linhas.map((l) => {
      const total = l.aplicacao.modeloVersao.grupos.reduce((s, g) => s + g._count.perguntas, 0);
      const avaliado = porId.get(l.avaliadoId);
      return {
        id: l.id,
        avaliadoId: l.avaliadoId,
        nome: avaliado?.nome ?? '(colaborador não encontrado)',
        matricula: avaliado?.matricula ?? '',
        cargo: l.cargoSnapshot ?? avaliado?.cargoDescricao ?? null,
        centroCusto: l.centroCustoSnapshot,
        aplicacao: l.aplicacao.nome,
        status: l.status,
        enviadaEm: l.enviadaEm,
        perguntasTotal: total,
        perguntasRespondidas: Math.min(l._count.respostas, total),
      };
    });

    return marcarRestricoes(comDados, contexto.colaboradorId);
  }

  /** Abre o questionário para responder. Passa pela porta (403 no próprio). */
  async abrirParaResponder(contexto: ContextoAcesso, avaliacaoId: string) {
    const avaliacao = await this.acesso.carregarParaAcao(contexto, avaliacaoId, 'abrir');

    const completa = await this.prisma.avaliacao.findUniqueOrThrow({
      where: { id: avaliacao.id },
      include: {
        aplicacao: {
          include: {
            modeloVersao: {
              include: {
                grupos: {
                  orderBy: { ordem: 'asc' },
                  include: {
                    perguntas: {
                      orderBy: { ordem: 'asc' },
                      include: { alternativas: { orderBy: { ordem: 'asc' } } },
                    },
                  },
                },
              },
            },
          },
        },
        respostas: true,
      },
    });

    const respondido = new Map(completa.respostas.map((r) => [r.perguntaId, r.alternativaId]));
    const total = completa.aplicacao.modeloVersao.grupos.reduce((s, g) => s + g.perguntas.length, 0);
    const avaliado = await this.prisma.colaborador.findUnique({
      where: { id: completa.avaliadoId },
      select: { nome: true, matricula: true, cargoDescricao: true },
    });

    return {
      id: completa.id,
      status: completa.status,
      observacaoAvaliador: completa.observacaoAvaliador,
      avaliado: {
        nome: avaliado?.nome ?? '',
        matricula: avaliado?.matricula ?? '',
        cargo: completa.cargoSnapshot ?? avaliado?.cargoDescricao ?? null,
      },
      perguntasTotal: total,
      perguntasRespondidas: respondido.size,
      grupos: completa.aplicacao.modeloVersao.grupos.map((g) => ({
        id: g.id,
        titulo: g.titulo,
        perguntas: g.perguntas.map((p) => ({
          id: p.id,
          enunciado: p.enunciado,
          // O peso NÃO vai para a tela do avaliador: saber que uma pergunta vale
          // o triplo muda a resposta, e o que se quer é a leitura do desempenho.
          alternativas: p.alternativas.map((a) => ({ id: a.id, descricao: a.descricao })),
          alternativaEscolhidaId: respondido.get(p.id) ?? null,
        })),
      })),
    };
  }

  /** Grava uma resposta. Idempotente por (avaliação, pergunta). */
  async responder(
    contexto: ContextoAcesso,
    avaliacaoId: string,
    perguntaId: string,
    alternativaId: string,
  ) {
    const avaliacao = await this.acesso.carregarParaAcao(contexto, avaliacaoId, 'responder');
    await this.assertPodeEditar(avaliacaoId);

    const alternativa = await this.prisma.perguntaAlternativa.findUnique({
      where: { id: alternativaId },
      select: { id: true, valor: true, perguntaId: true },
    });
    if (!alternativa || alternativa.perguntaId !== perguntaId) {
      throw new BadRequestException('A alternativa escolhida não pertence a esta pergunta.');
    }

    await this.prisma.$transaction([
      this.prisma.resposta.upsert({
        where: { avaliacaoId_perguntaId: { avaliacaoId, perguntaId } },
        update: { alternativaId, valor: alternativa.valor },
        create: { avaliacaoId, perguntaId, alternativaId, valor: alternativa.valor },
      }),
      this.prisma.avaliacao.update({
        where: { id: avaliacaoId },
        data: { status: 'EM_ANDAMENTO' },
      }),
    ]);
    return { ok: true, avaliadoId: avaliacao.avaliadoId };
  }

  /**
   * ENVIAR — calcula a nota do questionário e congela.
   *
   * ⚠️ Recusa envio incompleto **dizendo quantas faltam**, para a tela poder
   * perguntar em vez de adivinhar. Calcular sobre questionário pela metade daria
   * nota mais baixa, e ela pareceria desempenho em vez de formulário incompleto.
   */
  async enviar(contexto: ContextoAcesso, avaliacaoId: string, observacao?: string) {
    await this.acesso.carregarParaAcao(contexto, avaliacaoId, 'editar');
    await this.assertPodeEditar(avaliacaoId);

    const itens = await this.itensRespondidos(avaliacaoId);
    const semResposta = itens.filter((i) => i.valorRespondido === null).length;
    if (semResposta > 0) {
      throw new BadRequestException(
        `Faltam ${semResposta} pergunta(s) para enviar. Toda pergunta é obrigatória.`,
      );
    }

    const { nota } = calcularNotaAvaliacao(itens as ItemRespondido[]);
    const enviada = await this.prisma.avaliacao.update({
      where: { id: avaliacaoId },
      data: {
        status: 'ENVIADA',
        enviadaEm: new Date(),
        notaAvaliacao: nota,
        observacaoAvaliador: observacao?.trim() || undefined,
      },
    });

    await this.auditoria.registrar({
      entidade: 'Avaliacao',
      entidadeId: avaliacaoId,
      acao: 'ENVIAR',
      usuarioId: contexto.usuarioId,
      valorNovo: { notaAvaliacao: nota },
      ip: contexto.ip,
    });
    return { id: enviada.id, notaAvaliacao: nota, porGrupo: notaPorGrupo(itens as ItemRespondido[]) };
  }

  /** Reabertura — ato do RH, com motivo, e nunca na própria avaliação. */
  async reabrir(contexto: ContextoAcesso, avaliacaoId: string, motivo: string) {
    if (!motivo?.trim()) throw new BadRequestException('Informe o motivo da reabertura.');
    await this.acesso.carregarParaAcao(contexto, avaliacaoId, 'reabrir');

    const reaberta = await this.prisma.avaliacao.update({
      where: { id: avaliacaoId },
      data: {
        status: 'EM_ANDAMENTO',
        reabertaEm: new Date(),
        reabertaPorId: contexto.usuarioId,
        motivoReabertura: motivo.trim(),
        // A nota volta a ser indefinida: ela é do envio, e o envio foi desfeito.
        notaAvaliacao: null,
      },
    });
    await this.auditoria.registrar({
      entidade: 'Avaliacao',
      entidadeId: avaliacaoId,
      acao: 'REABRIR',
      usuarioId: contexto.usuarioId,
      justificativa: motivo.trim(),
      ip: contexto.ip,
    });
    return reaberta;
  }

  /** Perguntas do modelo + a resposta de cada uma (null quando não respondida). */
  private async itensRespondidos(avaliacaoId: string) {
    const avaliacao = await this.prisma.avaliacao.findUniqueOrThrow({
      where: { id: avaliacaoId },
      include: {
        aplicacao: {
          include: {
            modeloVersao: {
              include: { grupos: { include: { perguntas: { include: { alternativas: true } } } } },
            },
          },
        },
        respostas: true,
      },
    });
    const respostas = new Map(avaliacao.respostas.map((r) => [r.perguntaId, Number(r.valor)]));

    return avaliacao.aplicacao.modeloVersao.grupos.flatMap((g) =>
      g.perguntas.map((p) => ({
        perguntaId: p.id,
        grupoId: g.id,
        peso: Number(p.peso),
        maiorValor: Math.max(...p.alternativas.map((a) => Number(a.valor))),
        valorRespondido: respostas.get(p.id) ?? null,
      })),
    );
  }

  private async assertPodeEditar(avaliacaoId: string) {
    const avaliacao = await this.prisma.avaliacao.findUniqueOrThrow({
      where: { id: avaliacaoId },
      select: { status: true, ciclo: { select: { status: true } } },
    });
    if (avaliacao.ciclo.status !== 'ABERTO') {
      throw new BadRequestException(
        `O ciclo está ${avaliacao.ciclo.status} — só um ciclo ABERTO aceita respostas.`,
      );
    }
    if (avaliacao.status === 'ENVIADA') {
      throw new BadRequestException('Esta avaliação já foi enviada. Para alterar, peça a reabertura ao RH.');
    }
    if (avaliacao.status === 'CANCELADA') {
      throw new BadRequestException('Esta avaliação foi cancelada.');
    }
  }
}
