/**
 * ⭐⭐ PUBLICAR — Etapa 4, o ponto sem volta.
 *
 * Publicar é o ato que faz um rascunho virar instrumento: a partir dele
 * aplicações podem apontar para a versão, avaliações nascem sobre ela, e a
 * `pontuacaoMaxima` gravada aqui vira o **denominador de todo mundo daquele
 * perfil**.
 *
 * ⭐ **`RH_ADMIN` e só.** Montar o arranjo é `RH_MODELO` (Etapa 3); publicar é a
 * autoridade que decide que aquele instrumento vale. É a mesma separação que
 * `roles-rh.ts` descreve: *"RH_MODELO monta o INSTRUMENTO… não publica"*.
 *
 * ⚠️ **A pontuação máxima é CALCULADA aqui, não copiada.** Ao duplicar, ela
 * nasce nula de propósito (§3.1.89): copiar a da origem gravaria um número que
 * descreve outro arranjo e ele passaria a "conferir" contra o recalculado
 * errado. O único momento em que o número está certo é este — sobre o arranjo
 * final, imediatamente antes de congelá-lo.
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import {
  ModeloNaoPublicavelError,
  assertArranjoPublicavel,
  pontuacaoMaximaDoArranjoCompleto,
  somaDeclarada,
  somaDerivada,
  validarArranjoParaPublicacao,
  type ArranjoParaPublicacao,
} from './publicacao.validator.js';

export interface PreviaDaPublicacao {
  versaoId: string;
  modeloNome: string;
  versao: number;
  /** Já publicada? Então não há o que publicar. */
  publicado: boolean;
  problemas: string[];
  somaDeclarada: number;
  somaDerivada: number;
  pontuacaoMaxima: number;
  /** A soma da versão publicada mais recente do mesmo perfil, para comparar. */
  somaDaPublicadaAtual: number | null;
  frase: string;
}

@Injectable()
export class PublicacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async previa(versaoId: string): Promise<PreviaDaPublicacao> {
    const { versao, arranjo } = await this.carregar(versaoId);
    const problemas = versao.publicadoEm
      ? [`A v${versao.versao} de ${versao.modelo.nome} já está publicada.`]
      : validarArranjoParaPublicacao(arranjo);

    const publicadaAtual = await this.prisma.modeloVersao.findFirst({
      where: { modeloId: versao.modeloId, publicadoEm: { not: null } },
      orderBy: { versao: 'desc' },
      include: { grupos: { select: { peso: true } } },
    });
    const somaAtual = publicadaAtual
      ? Math.round(publicadaAtual.grupos.reduce((s, g) => s + Number(g.peso), 0) * 10_000) / 10_000
      : null;

    const declarada = somaDeclarada(arranjo.grupos);
    const maxima = pontuacaoMaximaDoArranjoCompleto(arranjo);

    return {
      versaoId,
      modeloNome: versao.modelo.nome,
      versao: versao.versao,
      publicado: versao.publicadoEm !== null,
      problemas,
      somaDeclarada: declarada,
      somaDerivada: somaDerivada(arranjo),
      pontuacaoMaxima: maxima,
      somaDaPublicadaAtual: somaAtual,
      frase:
        problemas.length > 0
          ? `Faltam ${problemas.length === 1 ? '1 coisa' : `${problemas.length} coisas`} para publicar.`
          : `Publica a v${versao.versao} de ${versao.modelo.nome}: ${arranjo.questoes.length} ` +
            `questões, soma ${declarada}, pontuação máxima ${maxima}. ` +
            '⚠️ Não desfaz — versão publicada é imutável, e a partir daqui aplicações podem ' +
            'apontar para ela. A versão anterior continua valendo para os ciclos que já a usam.',
    };
  }

  async publicar(versaoId: string, usuarioId: string) {
    const { versao, arranjo } = await this.carregar(versaoId);
    if (versao.publicadoEm !== null) {
      throw new BadRequestException(
        `A v${versao.versao} de ${versao.modelo.nome} já está publicada.`,
      );
    }
    /**
     * ⚠️ A guarda, não a prévia: quem chama a API direto não passou pela tela.
     *
     * ⚠️⚠️ E o `try` não é enfeite. `ModeloNaoPublicavelError` é `Error` puro,
     * então sem isto o Nest devolve **500 "Erro interno do servidor"** e a lista
     * de problemas — que é o produto inteiro deste validador — some no caminho.
     * Pego rodando o portão do Bloco C, não por teste: o `assertArranjoPublicavel`
     * tem spec verde, e ela exercita a FUNÇÃO, não a rota. Mesmo padrão do
     * `CicloNaoAbrivelError` em `ciclo.service.ts:150`.
     */
    try {
      assertArranjoPublicavel(arranjo);
    } catch (e) {
      if (e instanceof ModeloNaoPublicavelError) throw new BadRequestException(e.problemas);
      throw e;
    }

    const pontuacaoMaxima = pontuacaoMaximaDoArranjoCompleto(arranjo);
    /**
     * ⚠️ Cinto e suspensório sobre a conta da §3.1.86. `assertArranjoPublicavel`
     * já compara declarada × derivada; isto confere a MÁXIMA contra a mesma
     * derivada, que é o número que de fato vai para o banco. Se um dia as duas
     * peças divergirem, a publicação para aqui em vez de gravar um denominador
     * que ninguém consegue explicar depois.
     */
    const esperada = Math.round(somaDerivada(arranjo) * 10_000) / 10_000;
    if (!(pontuacaoMaxima > 0) || !(esperada > 0)) {
      throw new BadRequestException(
        'A pontuação máxima calculada é zero. Publicar gravaria um denominador inválido.',
      );
    }

    const publicada = await this.prisma.modeloVersao.update({
      where: { id: versaoId },
      data: { publicadoEm: new Date(), publicadoPorId: usuarioId, pontuacaoMaxima },
    });

    await this.auditoria.registrar({
      entidade: 'ModeloVersao',
      entidadeId: versaoId,
      acao: 'PUBLICAR',
      usuarioId,
      valorNovo: {
        modelo: versao.modelo.nome,
        versao: versao.versao,
        questoes: arranjo.questoes.length,
        somaDosPesos: esperada,
        pontuacaoMaxima,
      },
    });

    return {
      id: publicada.id,
      versao: publicada.versao,
      publicadoEm: publicada.publicadoEm,
      pontuacaoMaxima: Number(publicada.pontuacaoMaxima),
      somaDosPesos: esperada,
    };
  }

  private async carregar(versaoId: string) {
    const versao = await this.prisma.modeloVersao.findUnique({
      where: { id: versaoId },
      include: {
        modelo: true,
        grupos: { include: { classificacao: true }, orderBy: { ordem: 'asc' } },
        perguntas: {
          include: { pergunta: { include: { alternativas: true } } },
          orderBy: { ordem: 'asc' },
        },
      },
    });
    if (!versao) throw new NotFoundException('Versão não encontrada.');

    const arranjo: ArranjoParaPublicacao = {
      grupos: versao.grupos.map((g) => ({
        classificacaoId: g.classificacaoId,
        titulo: g.classificacao.nome,
        peso: Number(g.peso),
        ordem: g.ordem,
      })),
      questoes: versao.perguntas.map((ap) => ({
        perguntaId: ap.perguntaId,
        codigo: ap.pergunta.codigo,
        enunciado: ap.pergunta.enunciado,
        ativa: ap.pergunta.ativa,
        classificacaoId: ap.pergunta.classificacaoId,
        ordem: ap.ordem,
        alternativas: ap.pergunta.alternativas.map((a) => ({ valor: Number(a.valor) })),
      })),
    };
    return { versao, arranjo };
  }
}
