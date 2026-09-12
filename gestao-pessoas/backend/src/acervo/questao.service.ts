/**
 * ⭐⭐ CRIAR E EDITAR QUESTÃO DO ACERVO — Etapa 6 do editor.
 *
 * O bloco em que o RH deixa de depender do que veio transcrito do RD8010.
 *
 * ⚠️ **Criar uma questão não a coloca em perfil nenhum**, e isso é seguro por
 * construção: nenhuma consulta do módulo lê `prisma.pergunta` direto — as
 * quatro passam pelo ARRANJO (§3.1.83b). Questão fora de arranjo é invisível
 * para avaliação, contagem, apuração e memória de cálculo. **Mas a tela tem de
 * DIZER**: "questão criada" e "questão criada, e ainda não está em nenhum
 * perfil" são frases diferentes, e a primeira deixa quem criou achando que já
 * vale.
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { escalaDoAcervo, problemasDaEscala, type EscalaDoAcervo } from './escala.js';
import {
  efeitoDeApagarQuestao,
  efeitoDeDesativarQuestao,
  efeitoDeEditarTexto,
  efeitoDeReativarQuestao,
  efeitoDeReclassificar,
  type ContextoQuestao,
  type Efeito,
} from './efeito-de-questionar.js';

export interface AncoraEntrada {
  descricao: string;
  /** Opcional: quando ausente, entra o valor da escala do acervo naquela posição. */
  valor?: number;
}

export interface QuestaoEntrada {
  enunciado: string;
  classificacaoId: string;
  ancoras: AncoraEntrada[];
}

/**
 * ⭐ PREFIXO DAS QUESTÕES CRIADAS AQUI.
 *
 * `codigo` é a chave natural e veio do **SQP010** — as 15 herdadas são `004` a
 * `018`. Gerar `019` para uma questão nossa criaria colisão no dia em que o
 * Protheus tiver a dele, e a colisão apareceria como violação de unicidade
 * numa sincronização, longe daqui.
 *
 * `C###` separa as duas origens de forma legível na própria tela: número puro
 * veio do Protheus, `C` veio daqui.
 */
const PREFIXO_LOCAL = 'C';

@Injectable()
export class QuestaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** A escala vigente — o que o formulário pré-preenche. */
  async escala(): Promise<EscalaDoAcervo> {
    const questoes = await this.prisma.pergunta.findMany({
      select: { codigo: true, alternativas: { select: { valor: true, ordem: true } } },
    });
    return escalaDoAcervo(
      questoes.map((q) => ({
        codigo: q.codigo,
        alternativas: q.alternativas.map((a) => ({ valor: Number(a.valor), ordem: a.ordem })),
      })),
    );
  }

  async criar(dados: QuestaoEntrada, usuarioId: string) {
    const escala = await this.escala();
    const ancoras = this.normalizarAncoras(dados.ancoras, escala);
    await this.assertClassificacaoExiste(dados.classificacaoId);

    const enunciado = dados.enunciado.trim();
    if (enunciado.length < 3) {
      throw new BadRequestException('O enunciado precisa dizer o que está sendo avaliado.');
    }

    const codigo = await this.proximoCodigo();
    const criada = await this.prisma.pergunta.create({
      data: {
        codigo,
        enunciado,
        classificacaoId: dados.classificacaoId,
        alternativas: {
          create: ancoras.map((a, i) => ({ descricao: a.descricao, valor: a.valor, ordem: i })),
        },
      },
      include: { alternativas: { orderBy: { ordem: 'asc' } }, classificacao: true },
    });

    await this.auditoria.registrar({
      entidade: 'Pergunta',
      entidadeId: criada.id,
      acao: 'CRIAR',
      usuarioId,
      valorNovo: { codigo, enunciado, classificacao: criada.classificacao.nome },
    });

    return {
      ...criada,
      /**
       * ⭐ O aviso viaja com a resposta, não fica só na tela. Quem consome a
       * API (e o próximo formulário) precisa da mesma frase que o RH lê.
       */
      aviso:
        `Questão ${codigo} criada — e ela ainda NÃO está em nenhum perfil. ` +
        'Enquanto não entrar no arranjo de um perfil, ninguém a responde e ela não pesa nada.',
    };
  }

  async editar(id: string, dados: QuestaoEntrada, usuarioId: string) {
    const atual = await this.carregar(id);
    const ctx = this.contexto(atual);
    const escala = await this.escala();
    const ancoras = this.normalizarAncoras(dados.ancoras, escala);
    const enunciado = dados.enunciado.trim();

    const mudouTexto =
      enunciado !== atual.enunciado ||
      ancoras.length !== atual.alternativas.length ||
      ancoras.some((a, i) => a.descricao !== atual.alternativas[i]?.descricao) ||
      ancoras.some((a, i) => Math.abs(a.valor - Number(atual.alternativas[i]?.valor ?? -1)) > 1e-9);
    const mudouClassificacao = dados.classificacaoId !== atual.classificacaoId;

    // ⚠️ Cada mudança consulta O SEU classificador. Um só "podeEditar" trataria
    // trocar de classificação (que mexe em PESO) como se fosse corrigir um
    // acento — e a recusa de uma bloquearia a outra sem razão.
    if (mudouTexto) {
      const e = efeitoDeEditarTexto(ctx);
      if (e.acao === 'RECUSAR') throw new BadRequestException(e.frase);
    }
    if (mudouClassificacao) {
      const e = efeitoDeReclassificar(ctx);
      if (e.acao === 'RECUSAR') throw new BadRequestException(e.frase);
      await this.assertClassificacaoExiste(dados.classificacaoId);
    }
    if (!mudouTexto && !mudouClassificacao) return { ...atual, semMudanca: true };

    const nova = await this.prisma.$transaction(async (tx) => {
      if (mudouTexto) {
        await tx.perguntaAlternativa.deleteMany({ where: { perguntaId: id } });
        await tx.perguntaAlternativa.createMany({
          data: ancoras.map((a, i) => ({
            perguntaId: id,
            descricao: a.descricao,
            valor: a.valor,
            ordem: i,
          })),
        });
      }
      return tx.pergunta.update({
        where: { id },
        data: { enunciado, classificacaoId: dados.classificacaoId },
        include: { alternativas: { orderBy: { ordem: 'asc' } }, classificacao: true },
      });
    });

    await this.auditoria.registrar({
      entidade: 'Pergunta',
      entidadeId: id,
      acao: 'EDITAR',
      usuarioId,
      valorAnterior: {
        enunciado: atual.enunciado,
        classificacao: atual.classificacao.nome,
        ancoras: atual.alternativas.map((a) => a.descricao),
      },
      valorNovo: {
        enunciado,
        classificacao: nova.classificacao.nome,
        ancoras: ancoras.map((a) => a.descricao),
      },
    });
    return nova;
  }

  async desativar(id: string, usuarioId: string) {
    return this.mudarAtiva(id, false, usuarioId);
  }
  async reativar(id: string, usuarioId: string) {
    return this.mudarAtiva(id, true, usuarioId);
  }

  private async mudarAtiva(id: string, ativa: boolean, usuarioId: string) {
    const atual = await this.carregar(id);
    const ctx = this.contexto(atual);
    const e = ativa ? efeitoDeReativarQuestao(ctx) : efeitoDeDesativarQuestao(ctx);
    if (e.acao === 'RECUSAR') throw new BadRequestException(e.frase);
    await this.prisma.pergunta.update({ where: { id }, data: { ativa } });
    await this.auditoria.registrar({
      entidade: 'Pergunta',
      entidadeId: id,
      acao: ativa ? 'REATIVAR' : 'DESATIVAR',
      usuarioId,
      valorAnterior: { ativa: !ativa },
      valorNovo: { ativa },
    });
    return { ok: true, frase: e.frase };
  }

  async apagar(id: string, usuarioId: string) {
    const atual = await this.carregar(id);
    const ctx = this.contexto(atual);
    const e = efeitoDeApagarQuestao(ctx);
    if (e.acao === 'RECUSAR') throw new BadRequestException(e.frase);

    await this.prisma.$transaction(async (tx) => {
      await tx.perguntaAlternativa.deleteMany({ where: { perguntaId: id } });
      await tx.pergunta.delete({ where: { id } });
    });
    await this.auditoria.registrar({
      entidade: 'Pergunta',
      entidadeId: id,
      acao: 'APAGAR',
      usuarioId,
      valorAnterior: { codigo: atual.codigo, enunciado: atual.enunciado },
    });
    return { ok: true };
  }

  // ── privados ──────────────────────────────────────────────────────────────

  private async carregar(id: string) {
    const q = await this.prisma.pergunta.findUnique({
      where: { id },
      include: {
        classificacao: true,
        alternativas: { orderBy: { ordem: 'asc' } },
        _count: { select: { respostas: true } },
        arranjos: { select: { modeloVersao: { select: { publicadoEm: true } } } },
      },
    });
    if (!q) throw new NotFoundException('Questão não encontrada.');
    return q;
  }

  private contexto(q: Awaited<ReturnType<QuestaoService['carregar']>>): ContextoQuestao {
    return {
      codigo: q.codigo,
      enunciado: q.enunciado,
      classificacaoNome: q.classificacao.nome,
      ativa: q.ativa,
      respostas: q._count.respostas,
      arranjos: q.arranjos.length,
      arranjosPublicados: q.arranjos.filter((a) => a.modeloVersao.publicadoEm !== null).length,
    };
  }

  private async assertClassificacaoExiste(id: string) {
    const c = await this.prisma.classificacao.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Classificação não encontrada.');
    if (!c.ativa) {
      throw new BadRequestException(
        `A classificação "${c.nome}" está inativa — ela não é oferecida para questões novas. ` +
          'Reative-a ou escolha outra.',
      );
    }
  }

  /**
   * ⚠️ Valida a ESCALA, não só o formato. Ver `escala.ts`: maior valor
   * diferente desloca a pontuação máxima do perfil inteiro.
   */
  private normalizarAncoras(entrada: AncoraEntrada[], escala: EscalaDoAcervo) {
    const esperadas = escala.valores.length;
    if (entrada.length !== esperadas) {
      throw new BadRequestException(
        // ⚠️ Sem palavra colada ao número: com 1 sairia "1 alternativas".
        `Alternativas por questão no acervo: ${esperadas}. Vieram ${entrada.length}.`,
      );
    }
    const ancoras = entrada.map((a, i) => ({
      descricao: a.descricao.trim(),
      valor: a.valor ?? escala.valores[i],
    }));

    const vazia = ancoras.findIndex((a) => a.descricao.length < 3);
    if (vazia >= 0) {
      throw new BadRequestException(
        `A ${vazia + 1}ª alternativa está sem texto. Cada uma descreve um comportamento ` +
          'observado, do pior ao melhor — é por elas que o avaliador escolhe.',
      );
    }
    const repetida = new Set(ancoras.map((a) => a.descricao.toLowerCase()));
    if (repetida.size !== ancoras.length) {
      throw new BadRequestException(
        'Duas alternativas com o mesmo texto: o avaliador não teria como escolher entre elas.',
      );
    }

    const problemas = problemasDaEscala(
      ancoras.map((a) => a.valor),
      escala,
    );
    if (problemas.length) throw new BadRequestException(problemas);
    return ancoras;
  }

  /**
   * Próximo `C###` livre. Conta só os do prefixo — os numéricos são do SQP010 e
   * não entram na sequência.
   */
  private async proximoCodigo(): Promise<string> {
    const locais = await this.prisma.pergunta.findMany({
      where: { codigo: { startsWith: PREFIXO_LOCAL } },
      select: { codigo: true },
    });
    const maior = locais.reduce((m, q) => {
      const n = Number(q.codigo.slice(PREFIXO_LOCAL.length));
      return Number.isFinite(n) && n > m ? n : m;
    }, 0);
    return `${PREFIXO_LOCAL}${String(maior + 1).padStart(3, '0')}`;
  }
}
