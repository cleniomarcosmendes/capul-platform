/**
 * ⭐ CADASTRO DAS CLASSIFICAÇÕES — Etapa 5 do editor.
 *
 * A classificação é o que carrega o PESO no arranjo (`ArranjoGrupo.peso`), e é
 * por ela que a questão herda quanto vale. Cadastrá-la é, portanto, mexer na
 * estrutura da nota — mas só potencialmente: enquanto nenhum arranjo declara
 * peso para ela, uma classificação nova não afeta perfil nenhum.
 *
 * ⚠️ O que este cadastro **não** faz: mudar arranjo. Colocar a classificação em
 * um perfil (e dizer quanto ela pesa lá) é a Etapa 3.
 */
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import {
  efeitoDeApagar,
  efeitoDeDesativar,
  efeitoDeReativar,
  type ContextoClassificacao,
  type Efeito,
} from './efeito-de-classificar.js';

export interface ClassificacaoDoCadastro extends ContextoClassificacao {
  id: string;
  ordem: number;
  efeitoDeApagar: Efeito;
  efeitoDeDesativar: Efeito;
  efeitoDeReativar: Efeito;
}

@Injectable()
export class ClassificacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(): Promise<ClassificacaoDoCadastro[]> {
    const [classificacoes, arranjos] = await Promise.all([
      this.prisma.classificacao.findMany({
        orderBy: { ordem: 'asc' },
        include: { _count: { select: { perguntas: true } } },
      }),
      this.prisma.arranjoGrupo.findMany({
        select: { classificacaoId: true, modeloVersao: { select: { publicadoEm: true } } },
      }),
    ]);

    const usos = new Map<string, { total: number; publicados: number }>();
    for (const a of arranjos) {
      const atual = usos.get(a.classificacaoId) ?? { total: 0, publicados: 0 };
      atual.total += 1;
      if (a.modeloVersao.publicadoEm !== null) atual.publicados += 1;
      usos.set(a.classificacaoId, atual);
    }

    return classificacoes.map((c) => {
      const uso = usos.get(c.id) ?? { total: 0, publicados: 0 };
      const ctx: ContextoClassificacao = {
        nome: c.nome,
        ativa: c.ativa,
        questoes: c._count.perguntas,
        arranjos: uso.total,
        arranjosPublicados: uso.publicados,
      };
      return {
        id: c.id,
        ordem: c.ordem,
        ...ctx,
        efeitoDeApagar: efeitoDeApagar(ctx),
        efeitoDeDesativar: efeitoDeDesativar(ctx),
        efeitoDeReativar: efeitoDeReativar(ctx),
      };
    });
  }

  async criar(nome: string, usuarioId: string) {
    const limpo = nome.trim();
    if (!limpo) throw new BadRequestException('A classificação precisa de um nome.');
    await this.assertNomeLivre(limpo, null);

    const maior = await this.prisma.classificacao.findFirst({
      orderBy: { ordem: 'desc' },
      select: { ordem: true },
    });
    const criada = await this.prisma.classificacao.create({
      data: { nome: limpo, ordem: (maior?.ordem ?? -1) + 1 },
    });
    await this.auditoria.registrar({
      entidade: 'Classificacao',
      entidadeId: criada.id,
      acao: 'CRIAR',
      usuarioId,
      valorNovo: { nome: limpo },
    });
    return criada;
  }

  async renomear(id: string, nome: string, usuarioId: string) {
    const limpo = nome.trim();
    if (!limpo) throw new BadRequestException('A classificação precisa de um nome.');
    const atual = await this.carregar(id);
    await this.assertNomeLivre(limpo, id);

    const nova = await this.prisma.classificacao.update({
      where: { id },
      data: { nome: limpo },
    });
    await this.auditoria.registrar({
      entidade: 'Classificacao',
      entidadeId: id,
      acao: 'RENOMEAR',
      usuarioId,
      valorAnterior: { nome: atual.nome },
      valorNovo: { nome: limpo },
    });
    return nova;
  }

  /**
   * ⚠️ Reordenar é a lista INTEIRA de uma vez, nunca "sobe um".
   *
   * Com um `PATCH` por item, uma falha no meio deixa duas classificações com a
   * mesma ordem e a tela passa a listar em ordem arbitrária — e ninguém vê,
   * porque a lista continua tendo todos os itens.
   */
  async reordenar(ids: string[], usuarioId: string) {
    const existentes = await this.prisma.classificacao.findMany({ select: { id: true } });
    const conhecidos = new Set(existentes.map((c) => c.id));
    const faltando = existentes.length !== ids.length || ids.some((i) => !conhecidos.has(i));
    if (faltando) {
      throw new BadRequestException(
        `A nova ordem precisa citar as ${existentes.length} classificações, uma vez cada. ` +
          `Vieram ${ids.length}. Reordenar pela metade deixaria duas na mesma posição.`,
      );
    }
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('A nova ordem repete uma classificação.');
    }

    await this.prisma.$transaction(
      ids.map((id, ordem) => this.prisma.classificacao.update({ where: { id }, data: { ordem } })),
    );
    await this.auditoria.registrar({
      entidade: 'Classificacao',
      entidadeId: 'LISTA',
      acao: 'REORDENAR',
      usuarioId,
      valorNovo: { ordem: ids },
    });
    return { ok: true };
  }

  async desativar(id: string, usuarioId: string) {
    return this.mudarAtiva(id, false, usuarioId);
  }

  async reativar(id: string, usuarioId: string) {
    return this.mudarAtiva(id, true, usuarioId);
  }

  private async mudarAtiva(id: string, ativa: boolean, usuarioId: string) {
    const ctx = await this.contexto(id);
    const efeito = ativa ? efeitoDeReativar(ctx) : efeitoDeDesativar(ctx);
    if (efeito.acao === 'RECUSAR') throw new BadRequestException(efeito.frase);

    await this.prisma.classificacao.update({ where: { id }, data: { ativa } });
    await this.auditoria.registrar({
      entidade: 'Classificacao',
      entidadeId: id,
      acao: ativa ? 'REATIVAR' : 'DESATIVAR',
      usuarioId,
      valorAnterior: { ativa: !ativa },
      valorNovo: { ativa },
    });
    return { ok: true, frase: efeito.frase };
  }

  async apagar(id: string, usuarioId: string) {
    const ctx = await this.contexto(id);
    const efeito = efeitoDeApagar(ctx);
    if (efeito.acao === 'RECUSAR') throw new BadRequestException(efeito.frase);

    await this.prisma.classificacao.delete({ where: { id } });
    await this.auditoria.registrar({
      entidade: 'Classificacao',
      entidadeId: id,
      acao: 'APAGAR',
      usuarioId,
      valorAnterior: { nome: ctx.nome },
    });
    return { ok: true };
  }

  private async carregar(id: string) {
    const c = await this.prisma.classificacao.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Classificação não encontrada.');
    return c;
  }

  private async contexto(id: string): Promise<ContextoClassificacao> {
    const c = await this.prisma.classificacao.findUnique({
      where: { id },
      include: {
        _count: { select: { perguntas: true } },
        arranjos: { select: { modeloVersao: { select: { publicadoEm: true } } } },
      },
    });
    if (!c) throw new NotFoundException('Classificação não encontrada.');
    return {
      nome: c.nome,
      ativa: c.ativa,
      questoes: c._count.perguntas,
      arranjos: c.arranjos.length,
      arranjosPublicados: c.arranjos.filter((a) => a.modeloVersao.publicadoEm !== null).length,
    };
  }

  /**
   * ⚠️ O `@unique` do banco é case-SENSITIVE: "Assiduidade" e "assiduidade"
   * passariam as duas, e a tela mostraria duas linhas que ninguém distingue.
   * A conferência aqui é sem caixa, e é ela que produz a frase legível.
   */
  private async assertNomeLivre(nome: string, exceto: string | null) {
    const iguais = await this.prisma.classificacao.findMany({
      where: { nome: { equals: nome, mode: 'insensitive' } },
      select: { id: true, nome: true },
    });
    const colisao = iguais.find((c) => c.id !== exceto);
    if (colisao) {
      throw new ConflictException(`Já existe uma classificação chamada "${colisao.nome}".`);
    }
  }
}
