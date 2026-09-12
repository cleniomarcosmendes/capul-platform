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
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { calcularNotaAvaliacao, notaPorGrupo, type ItemRespondido } from '../calculo/nota-avaliacao.js';
import { carregarArranjo } from '../arranjo/carregar-arranjo.js';
import { AvaliacaoAcessoService, type ContextoAcesso } from './avaliacao-acesso.service.js';
import { marcarRestricoes } from './separacao-funcoes.js';
import { assertCicloAceitaReaberturaDeAvaliacao } from '../ciclo/ciclo-operavel.js';
import { ONDE_A_AVALIACAO_CONTA } from './avaliacoes-que-contam.js';
import {
  ACAO_FALTA_GENTE,
  ACAO_NAO_E_MINHA_EQUIPE,
  fraseDeConfirmacao,
} from './contestacao.js';
import { apagarResultadoDe } from '../apuracao/apagar-resultado.js';

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
      /**
       * ⚠️ **CANCELADA sai da fila** — e isto é metade do conserto, não um
       * detalhe. O `filaPorAvaliador` do painel do RH já excluía canceladas
       * desde sempre; aqui não havia filtro de status nenhum. Sem esta linha, o
       * cancelamento que nasceu em 08/09 daria ao RH uma fila limpa enquanto o
       * avaliador continuaria com a avaliação na mão — o mesmo beco do
       * "Excluir", só que em outra fantasia.
       *
       * É `not: CANCELADA` de propósito, e não uma lista de status vivos: a
       * fila mostra ENVIADA (é o histórico do que a pessoa já fez neste ciclo).
       * O que ela não pode mostrar é o que foi tirado da conta.
       */
      where: {
        avaliadorId: contexto.colaboradorId,
        ...ONDE_A_AVALIACAO_CONTA,
        /**
         * ⭐⭐ SÓ CICLO ABERTO — a fila é o trabalho que dá para FAZER.
         *
         * Não havia filtro de ciclo nenhum, e o efeito só apareceria no
         * primeiro encerramento de verdade: encerrado o Piloto, as 53 pessoas
         * continuariam vendo as 894 avaliações na fila, com os cartões "A
         * responder" clicáveis — e `responder` recusando na hora, porque exige
         * ABERTO. Fila que não esvazia quando o trabalho acaba deixa de ser
         * fila.
         *
         * ⚠️ É `ABERTO`, e não `not: ENCERRADO`, porque o buraco é simétrico:
         * designar é permitido em RASCUNHO (`assertCicloOperavel` só barra
         * ENCERRADO), então um ciclo ainda não aberto encheria a fila de quem
         * também não pode responder. A condição que fecha os dois é a mesma que
         * `responder` já usa — e é a única que não precisa ser revista quando
         * alguém acrescentar um status ao enum.
         *
         * ⚠️ Isto governa também o TOTAL da barra: `ProgressoGeral` recebe
         * `total={itens.length}`, somando todos os ciclos da resposta. Sem o
         * filtro, a barra da Arielly somava SIMULACAO com Piloto e anunciava
         * "13 de 26 enviadas" — dois ciclos, um número, nenhum deles verdadeiro.
         */
        ciclo: { status: 'ABERTO' },
        ...(cicloId ? { cicloId } : {}),
      },
      orderBy: { criadoEm: 'asc' },
      select: {
        id: true,
        avaliadoId: true,
        status: true,
        enviadaEm: true,
        centroCustoSnapshot: true,
        cargoSnapshot: true,
        // ⚠️ O CICLO vem junto porque a fila NÃO é de um ciclo só: podem existir
        // dois abertos ao mesmo tempo (a produção abre por ondas de unidade), e
        // sem dizer de qual é cada linha a pessoa vê um total que não bate com
        // nenhum ciclo — e não tem como saber até quando responder.
        ciclo: { select: { id: true, nome: true, periodoFim: true, status: true } },
        aplicacao: {
          select: {
            nome: true,
            // Contagem pelo ARRANJO — `pergunta` agora é o acervo global.
            modeloVersao: { select: { _count: { select: { perguntas: true } } } },
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

    /**
     * ⭐ A marca de "não é minha equipe" PERSISTE — uma consulta para a fila
     * inteira. Deixá-la só no estado da tela faria o aviso sumir no F5, e o
     * avaliador clicaria de novo achando que não tinha gravado: a trilha
     * encheria de repetição e ele ficaria sem saber se o RH foi avisado.
     */
    const contestadas = await this.prisma.auditoria.findMany({
      where: {
        entidade: 'Avaliacao',
        acao: ACAO_NAO_E_MINHA_EQUIPE,
        entidadeId: { in: linhas.map((l) => l.id) },
      },
      select: { entidadeId: true, criadoEm: true },
      orderBy: { criadoEm: 'desc' },
    });
    const contestadaEm = new Map(contestadas.map((c) => [c.entidadeId, c.criadoEm]));

    const comDados = linhas.map((l) => {
      const total = l.aplicacao.modeloVersao._count.perguntas;
      const avaliado = porId.get(l.avaliadoId);
      return {
        id: l.id,
        avaliadoId: l.avaliadoId,
        nome: avaliado?.nome ?? '(colaborador não encontrado)',
        matricula: avaliado?.matricula ?? '',
        cargo: l.cargoSnapshot ?? avaliado?.cargoDescricao ?? null,
        centroCusto: l.centroCustoSnapshot,
        aplicacao: l.aplicacao.nome,
        ciclo: {
          id: l.ciclo.id,
          nome: l.ciclo.nome,
          prazo: l.ciclo.periodoFim,
          status: l.ciclo.status as string,
        },
        status: l.status,
        enviadaEm: l.enviadaEm,
        perguntasTotal: total,
        perguntasRespondidas: Math.min(l._count.respostas, total),
        /** Quando ele disse que esta pessoa não é da equipe dele. Marca, não filtra. */
        contestadaEm: contestadaEm.get(l.id) ?? null,
      };
    });

    return marcarRestricoes(comDados, contexto.colaboradorId);
  }

  /**
   * ⭐⭐ "Esta pessoa não é da minha equipe" — registra e NÃO muda nada.
   *
   * A avaliação continua na fila, continua para responder, e a designação fica
   * como está: quem decide é o RH, com a lista na mão, depois. Ver
   * `contestacao.ts` para o porquê de as duas coisas andarem juntas.
   */
  async contestarDesignacao(contexto: ContextoAcesso, avaliacaoId: string, motivo: string) {
    const avaliacao = await this.acesso.carregarParaAcao(contexto, avaliacaoId, 'contestar');
    const avaliado = await this.prisma.colaborador.findUnique({
      where: { id: avaliacao.avaliadoId },
      select: { nome: true, matricula: true, centroCusto: true },
    });
    await this.auditoria.registrar({
      entidade: 'Avaliacao',
      entidadeId: avaliacaoId,
      acao: ACAO_NAO_E_MINHA_EQUIPE,
      usuarioId: contexto.usuarioId,
      justificativa: motivo.trim(),
      valorNovo: {
        avaliadoId: avaliacao.avaliadoId,
        avaliadoNome: avaliado?.nome ?? null,
        avaliadoMatricula: avaliado?.matricula ?? null,
        centroCusto: avaliado?.centroCusto ?? null,
        cicloId: avaliacao.cicloId,
        // ⚠️ Registrado de propósito: é a prova de que o ato NÃO mexeu na
        // designação, para quem ler a trilha meses depois não ter de deduzir.
        designacaoAlterada: false,
      },
      ip: contexto.ip,
    });
    return { ok: true, frase: fraseDeConfirmacao('NAO_E_MINHA_EQUIPE', avaliado?.nome) };
  }

  /**
   * ⭐ A outra metade do sinal: "falta gente na minha equipe".
   *
   * Não tem linha para clicar — é sobre quem NÃO está na fila —, então mora no
   * ciclo. Sem isto, metade do que o piloto tem a dizer sobre o cadastro se
   * perderia por uma razão de implementação, não de domínio.
   */
  async relatarFaltaDeGente(contexto: ContextoAcesso, cicloId: string, texto: string) {
    // Quem relata tem de ser avaliador DESTE ciclo — senão qualquer pessoa do
    // módulo escreve na trilha de um ciclo que não é dela.
    const temFila = await this.prisma.avaliacao.count({
      where: { cicloId, avaliadorId: contexto.colaboradorId ?? '', ...ONDE_A_AVALIACAO_CONTA },
    });
    if (temFila === 0) {
      throw new ForbiddenException(
        'Só quem tem avaliação designada neste ciclo pode relatar que falta gente na equipe dele.',
      );
    }
    await this.auditoria.registrar({
      entidade: 'Ciclo',
      entidadeId: cicloId,
      acao: ACAO_FALTA_GENTE,
      usuarioId: contexto.usuarioId,
      justificativa: texto.trim(),
      valorNovo: { avaliadorId: contexto.colaboradorId, avaliacoesNaFila: temFila },
      ip: contexto.ip,
    });
    return { ok: true, frase: fraseDeConfirmacao('FALTA_GENTE') };
  }

  /** Abre o questionário para responder. Passa pela porta (403 no próprio). */
  async abrirParaResponder(contexto: ContextoAcesso, avaliacaoId: string) {
    const avaliacao = await this.acesso.carregarParaAcao(contexto, avaliacaoId, 'abrir');

    const completa = await this.prisma.avaliacao.findUniqueOrThrow({
      where: { id: avaliacao.id },
      include: {
        // ⚠️ O CICLO vem junto. Quem abre um questionário de 14 perguntas
        // precisa saber SOBRE QUAL CICLO está respondendo e até quando: com dois
        // ciclos abertos, a mesma pessoa aparece duas vezes na fila com cartões
        // idênticos, e sem isto o avaliador responde as 14 sem nunca saber qual
        // das duas abriu.
        ciclo: { select: { id: true, nome: true, periodoFim: true } },
        aplicacao: {
          include: {
            modeloVersao: {
              include: {
                grupos: { orderBy: { ordem: 'asc' }, include: { classificacao: true } },
                perguntas: {
                  orderBy: { ordem: 'asc' },
                  include: {
                    pergunta: {
                      include: {
                        classificacao: true,
                        alternativas: { orderBy: { ordem: 'asc' } },
                      },
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
    const total = completa.aplicacao.modeloVersao.perguntas.length;
    const avaliado = await this.prisma.colaborador.findUnique({
      where: { id: completa.avaliadoId },
      select: { nome: true, matricula: true, cargoDescricao: true },
    });

    return {
      id: completa.id,
      status: completa.status,
      observacaoAvaliador: completa.observacaoAvaliador,
      ciclo: {
        id: completa.ciclo.id,
        nome: completa.ciclo.nome,
        prazo: completa.ciclo.periodoFim,
      },
      aplicacao: completa.aplicacao.nome,
      avaliado: {
        nome: avaliado?.nome ?? '',
        matricula: avaliado?.matricula ?? '',
        cargo: completa.cargoSnapshot ?? avaliado?.cargoDescricao ?? null,
      },
      perguntasTotal: total,
      perguntasRespondidas: respondido.size,
      // Agrupado pela CLASSIFICAÇÃO da questão, na ordem do arranjo. O avaliador
      // vê a mesma tela de sempre — o que mudou é de onde o agrupamento vem.
      grupos: completa.aplicacao.modeloVersao.grupos.map((g) => ({
        id: g.classificacaoId,
        titulo: g.classificacao.nome,
        perguntas: completa.aplicacao.modeloVersao.perguntas
          .filter((ap) => ap.pergunta.classificacaoId === g.classificacaoId)
          .map((ap) => ({
            id: ap.pergunta.id,
            enunciado: ap.pergunta.enunciado,
            // O peso NÃO vai para a tela do avaliador: saber que uma pergunta vale
            // o triplo muda a resposta, e o que se quer é a leitura do desempenho.
            alternativas: ap.pergunta.alternativas.map((a) => ({ id: a.id, descricao: a.descricao })),
            alternativaEscolhidaId: respondido.get(ap.pergunta.id) ?? null,
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
        // "Faltam N pergunta(s)" flexionava no verbo e no substantivo.
        `Perguntas sem resposta: ${semResposta}. Toda pergunta é obrigatória — responda antes de enviar.`,
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
    const alvo = await this.acesso.carregarParaAcao(contexto, avaliacaoId, 'reabrir');

    // ⚠️ O BECO: reabrir num ciclo encerrado deixava a avaliação EM_ANDAMENTO
    // sem ninguém poder responder (responder exige ABERTO). A recusa ensina a
    // ordem — ciclo primeiro, avaliação depois.
    const ciclo = await this.prisma.ciclo.findUniqueOrThrow({
      where: { id: alvo.cicloId },
      select: { status: true, encerradoEm: true },
    });
    assertCicloAceitaReaberturaDeAvaliacao(ciclo);

    /**
     * ⭐⭐ REABRIR APAGA O RESULTADO APURADO — decisão de 09/09, e as três
     * opções foram pesadas:
     *
     *   RECUSAR enquanto houver resultado transformaria *"apurei cedo para
     *   conferir o cálculo"* — que a própria tela de Resultados diz ser
     *   legítimo — em porta fechada: quem apurou parcial ficaria impedido de
     *   corrigir QUALQUER avaliação daquele ciclo.
     *
     *   MARCAR COMO VENCIDO criaria um terceiro estado que ninguém pediu, com o
     *   resultado antigo visível em Resultados enquanto a avaliação está
     *   EM_ANDAMENTO — a inconsistência que se quer evitar, com um rótulo em
     *   cima.
     *
     *   APAGAR é o que a reapuração já faz (`delete` + `create`). Não é
     *   comportamento novo: é o mesmo, disparado antes. E é coerente com o
     *   `notaAvaliacao: null` logo abaixo — a nota é do ENVIO, e o envio foi
     *   desfeito; o resultado que a combinava com os critérios também deixou de
     *   valer.
     *
     * ⚠️ O que foi apagado vai para a AUDITORIA, com a nota. Resultado apagado
     * sem rastro deixa "por que a média do ciclo mudou" sem resposta — e a
     * média de Resultados é calculada sobre as linhas existentes.
     */
    const apagado = await this.prisma.$transaction(async (tx) => {
      const removido = await apagarResultadoDe(tx as never, avaliacaoId);
      await tx.avaliacao.update({
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
      return removido;
    });

    await this.auditoria.registrar({
      entidade: 'Avaliacao',
      entidadeId: avaliacaoId,
      acao: 'REABRIR',
      usuarioId: contexto.usuarioId,
      justificativa: motivo.trim(),
      ip: contexto.ip,
      // ⭐ A nota apagada, nominalmente. Sem isto o resultado some e ninguém
      // consegue reconstruir por que a média do ciclo caiu.
      valorAnterior: apagado
        ? {
            resultadoApagado: {
              notaFinal: apagado.notaFinal,
              conceito: apagado.conceitoDescricao,
              apuradoEm: apagado.calculadoEm,
            },
          }
        : undefined,
    });

    return this.prisma.avaliacao.findUniqueOrThrow({ where: { id: avaliacaoId } });
  }

  /**
   * ⭐ O QUE A REABERTURA VAI FAZER — antes de fazer.
   *
   * A tela precisa dizer, com o número, que a reabertura apaga o resultado
   * apurado desta pessoa. Anunciar "isto apaga o resultado" sem a nota deixa a
   * pessoa decidir no escuro; anunciar a nota que a tela calculou por conta
   * própria voltaria a divergir do ato. Vem daqui, do mesmo registro que o ato
   * vai apagar.
   */
  async efeitoDaReabertura(contexto: ContextoAcesso, avaliacaoId: string) {
    // A MESMA porta do ato — quem não pode reabrir também não fica sabendo a nota.
    await this.acesso.carregarParaAcao(contexto, avaliacaoId, 'reabrir');
    const resultado = await this.prisma.resultadoAvaliacao.findUnique({
      where: { avaliacaoId },
      select: { notaFinal: true, conceitoDescricao: true, calculadoEm: true },
    });
    return {
      apagaResultado: resultado !== null,
      notaFinal: resultado ? Number(resultado.notaFinal) : null,
      conceito: resultado?.conceitoDescricao ?? null,
      apuradoEm: resultado?.calculadoEm ?? null,
    };
  }

  /**
   * Nota por GRUPO — calculada na leitura, nunca materializada (ADR-RH-02).
   *
   * Público porque a memória de cálculo do resultado mostra a mesma quebra: uma
   * segunda implementação dela divergiria da nota do envio no primeiro peso que
   * mudasse, e a tela diria dois números diferentes para a mesma avaliação.
   */
  /**
   * ⭐⭐ A MEMÓRIA POR QUESTÃO — o que a devolutiva precisa ter na mão.
   *
   * Sete barras e um total não sustentam conversa: o RH mostra "Relacionamento
   * 66,67" e não tem como dizer O QUE melhorar. Com a âncora escolhida visível
   * ("Raramente falta no trabalho"), a conversa tem objeto.
   *
   * ⚠️ Devolve o peso EXIBIDO (o arredondado), não o de calcular: quem confere
   * na mão soma o que está na tela. A nota do grupo, essa, sai do exato — e é
   * por isso que a soma dos pesos exibidos pode divergir do denominador em
   * centavos. O rodapé da tela diz de onde vem cada número.
   */
  async questoesRespondidasDa(avaliacaoId: string) {
    const avaliacao = await this.prisma.avaliacao.findUniqueOrThrow({
      where: { id: avaliacaoId },
      include: {
        aplicacao: { select: { modeloVersaoId: true } },
        respostas: { select: { perguntaId: true, alternativaId: true, valor: true } },
      },
    });
    const porPergunta = new Map(avaliacao.respostas.map((r) => [r.perguntaId, r]));
    const arranjo = await carregarArranjo(this.prisma, avaliacao.aplicacao.modeloVersaoId);

    return arranjo.questoes.map((q) => {
      const r = porPergunta.get(q.id);
      const escolhida = r ? q.alternativas.find((a) => a.id === r.alternativaId) : undefined;
      return {
        perguntaId: q.id,
        codigo: q.codigo,
        enunciado: q.enunciado,
        classificacaoId: q.classificacaoId,
        ordem: q.ordem,
        peso: q.peso,
        maiorValor: q.maiorValor,
        /** `null` quando a questão ficou sem resposta (avaliação cancelada). */
        valor: r ? Number(r.valor) : null,
        /** ⭐ O TEXTO da âncora — é o que dá objeto à conversa. */
        respostaEscolhida: escolhida?.descricao ?? null,
        /** Todas as âncoras, para a devolutiva mostrar o que viria depois. */
        ancoras: q.alternativas.map((a) => ({
          descricao: a.descricao,
          valor: a.valor,
          escolhida: a.id === r?.alternativaId,
        })),
      };
    });
  }

  async notaPorGrupoDa(avaliacaoId: string) {
    const itens = await this.itensRespondidos(avaliacaoId);
    const notas = notaPorGrupo(itens as ItemRespondido[]);

    // O título vem junto: "Grupo 3f2a-..." não é memória de cálculo, é um id
    // impresso na tela de quem precisa explicar a nota para o avaliado.
    // ⭐ O `grupoId` da memória de cálculo agora é o id da CLASSIFICAÇÃO — que é
    // global. A ordem de exibição, porém, é a do ARRANJO daquele perfil: a
    // mesma classificação aparece em posição diferente em cada questionário.
    const classificacoes = await this.prisma.classificacao.findMany({
      where: { id: { in: notas.map((n) => n.grupoId) } },
      select: { id: true, nome: true },
    });
    const nomePorId = new Map(classificacoes.map((c) => [c.id, c.nome]));

    const { aplicacao } = await this.prisma.avaliacao.findUniqueOrThrow({
      where: { id: avaliacaoId },
      select: { aplicacao: { select: { modeloVersaoId: true } } },
    });
    const arranjo = await this.prisma.arranjoGrupo.findMany({
      where: { modeloVersaoId: aplicacao.modeloVersaoId },
      select: { classificacaoId: true, ordem: true },
    });
    const ordemPorId = new Map(arranjo.map((g) => [g.classificacaoId, g.ordem]));

    return notas
      .map((n) => ({
        ...n,
        titulo: nomePorId.get(n.grupoId) ?? '(sem grupo)',
        ordem: ordemPorId.get(n.grupoId) ?? 0,
      }))
      .sort((a, b) => a.ordem - b.ordem);
  }

  /** Perguntas do modelo + a resposta de cada uma (null quando não respondida). */
  private async itensRespondidos(avaliacaoId: string) {
    const avaliacao = await this.prisma.avaliacao.findUniqueOrThrow({
      where: { id: avaliacaoId },
      include: {
        aplicacao: { select: { modeloVersaoId: true } },
        respostas: true,
      },
    });
    const respostas = new Map(avaliacao.respostas.map((r) => [r.perguntaId, Number(r.valor)]));

    // ⭐ O peso vem DERIVADO do arranjo (`carregarArranjo`), nunca de uma coluna
    // da pergunta — a questão é do acervo e não sabe quanto vale; quanto ela
    // vale depende do perfil que a usa.
    const arranjo = await carregarArranjo(this.prisma, avaliacao.aplicacao.modeloVersaoId);

    return arranjo.questoes.map((q) => ({
      perguntaId: q.id,
      grupoId: q.classificacaoId,
      /**
       * ⭐⭐ `pesoExato`, não `peso`. Ver §3.1.115: com o arredondado, as MESMAS
       * respostas dão 66,68 ou 66,65 conforme qual questão ficou com o centavo
       * do resto — e quem decide isso é a ORDEM das questões no arranjo, que é
       * escolha de quem monta, não do RH que avalia.
       *
       * O arredondado continua sendo o que a tela mostra (`pesoExibido`): ele
       * é o que reproduz o instrumento herdado e o que soma exatamente 60.
       */
      peso: q.pesoExato,
      pesoExibido: q.peso,
      maiorValor: q.maiorValor,
      valorRespondido: respostas.get(q.id) ?? null,
    }));
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
