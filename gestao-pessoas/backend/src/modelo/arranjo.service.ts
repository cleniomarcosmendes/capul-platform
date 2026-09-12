/**
 * ⭐⭐ MONTAR O ARRANJO DE UM RASCUNHO — Etapa 3, e o bloco de maior risco.
 *
 * É aqui que o **peso passa a ser escrito pela mão do RH**. Até 12/09 os pesos
 * do módulo vinham todos do seed, transcritos do RD8010; a partir daqui alguém
 * digita um número que decide quanto cada coisa vale na nota de mil pessoas.
 *
 * ── AS TRÊS TRAVAS DE DESENHO ───────────────────────────────────────────────
 *
 * **1. Só RASCUNHO.** Versão publicada é imutável — dela saíram notas.
 *
 * **2. O ARRANJO INTEIRO DE UMA VEZ**, nunca "adiciona um / tira um". Com
 *    operações item a item existe um instante em que a classificação já tem
 *    peso e ainda não tem questão (ou o contrário), e é justamente esse estado
 *    que faz a soma declarada divergir da derivada. Gravar tudo numa transação
 *    elimina o estado intermediário em vez de tentar tolerá-lo — é a mesma
 *    razão do `reordenar` das classificações.
 *
 * **3. AS DUAS SOMAS VÊM JUNTAS, sempre.** `somaDeclarada` (o que o RH digitou)
 *    e `somaDerivada` (o que a nota vai usar) são calculadas por caminhos
 *    diferentes e devolvidas lado a lado, na montagem e na publicação. É a
 *    conta da §3.1.86 — a que pegou os três defeitos de arredondamento que
 *    nenhum teste pegou.
 *
 * ⚠️ **O que este serviço NÃO faz:** publicar. Montar é `RH_MODELO`; publicar é
 * o ato com consequência e é `RH_ADMIN` (`publicacao.service.ts`).
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { pesosDerivados } from '../calculo/peso-derivado.js';
import { avisosDeComparabilidade, type AvisoDeComparabilidade, type PerfilComparavel } from './comparabilidade.js';
import {
  somaDeclarada,
  somaDerivada,
  somatorioPorGrupo,
  pontuacaoMaximaDoArranjoCompleto,
  validarArranjoParaPublicacao,
  type ArranjoParaPublicacao,
} from './publicacao.validator.js';

export interface GrupoEntrada {
  classificacaoId: string;
  peso: number;
}
export interface QuestaoEntrada {
  perguntaId: string;
}
export interface ArranjoEntrada {
  /** Na ordem em que aparecem. A ordem grava `ArranjoGrupo.ordem`. */
  grupos: GrupoEntrada[];
  /** Na ordem do questionário. É ela que decide quem recebe o centavo do resto. */
  questoes: QuestaoEntrada[];
}

export interface ArranjoDeEdicao {
  versaoId: string;
  modeloId: string;
  modeloNome: string;
  versao: number;
  publicado: boolean;
  /** O que o RH digitou. */
  somaDeclarada: number;
  /** O que a nota vai usar. ⚠️ Tem de ser igual ao de cima. */
  somaDerivada: number;
  /** `Σ(peso × maior valor)` — o denominador da nota. */
  pontuacaoMaxima: number;
  grupos: {
    classificacaoId: string;
    titulo: string;
    peso: number;
    questoes: number;
    percentual: number;
  }[];
  questoes: {
    perguntaId: string;
    codigo: string;
    enunciado: string;
    ativa: boolean;
    classificacaoId: string;
    classificacaoNome: string;
    ordem: number;
    /** Derivado. `null` quando a classificação não tem peso neste arranjo. */
    peso: number | null;
    maiorValor: number;
  }[];
  /** O que impediria PUBLICAR agora. Vazio = pronta. */
  problemasParaPublicar: string[];
  /**
   * ⭐ AVISOS, não problemas — a distinção é o desenho inteiro da Etapa 7.
   * Aparecem na montagem e no diálogo de publicar, **antes** do ato; nunca
   * impedem. Ver `comparabilidade.ts`.
   */
  avisosDeComparabilidade: AvisoDeComparabilidade[];
}

@Injectable()
export class ArranjoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async ler(versaoId: string): Promise<ArranjoDeEdicao> {
    const { versao, arranjo, nomes } = await this.carregar(versaoId);
    const [outros, publicadaDeste] = await Promise.all([
      this.outrosPerfis(versao.modeloId),
      this.publicadaDoMesmoPerfil(versao.modeloId, versao.id),
    ]);
    return this.montarResposta(versao, arranjo, nomes, outros, publicadaDeste);
  }

  /**
   * Os perfis com que ESTE se compara: as versões **publicadas** dos OUTROS
   * modelos.
   *
   * ⚠️ Só publicadas, e só de outros modelos. Rascunho alheio é trabalho em
   * andamento — comparar com ele produziria aviso sobre um estado que ninguém
   * escolheu ainda; e comparar com outra versão do MESMO perfil é a evolução
   * dele no tempo, que é o aviso do diálogo de publicar, não este.
   */
  /**
   * A versão publicada mais recente DESTE perfil — só para dizer se a diferença
   * é nova. Ver o campo `novo` em `comparabilidade.ts`.
   */
  private async publicadaDoMesmoPerfil(
    modeloId: string,
    exceto: string,
  ): Promise<PerfilComparavel | null> {
    const v = await this.prisma.modeloVersao.findFirst({
      where: { modeloId, publicadoEm: { not: null }, id: { not: exceto } },
      orderBy: { versao: 'desc' },
      include: {
        modelo: { select: { nome: true } },
        grupos: { include: { classificacao: { select: { nome: true } } } },
        perguntas: { include: { pergunta: { select: { classificacaoId: true } } } },
      },
    });
    if (!v) return null;
    return {
      versaoId: v.id,
      modeloNome: v.modelo.nome,
      versao: v.versao,
      publicado: true,
      grupos: v.grupos.map((g) => ({
        classificacaoId: g.classificacaoId,
        titulo: g.classificacao.nome,
        peso: Number(g.peso),
      })),
      questoes: v.perguntas.map((ap) => ({
        perguntaId: ap.perguntaId,
        classificacaoId: ap.pergunta.classificacaoId,
      })),
    };
  }

  private async outrosPerfis(modeloId: string): Promise<PerfilComparavel[]> {
    const versoes = await this.prisma.modeloVersao.findMany({
      where: { modeloId: { not: modeloId }, publicadoEm: { not: null } },
      include: {
        modelo: { select: { nome: true, finalidade: true } },
        grupos: { include: { classificacao: { select: { nome: true } } } },
        perguntas: { include: { pergunta: { select: { classificacaoId: true } } } },
      },
    });
    return versoes
      // ⚠️ O [DEMO] fica de fora: ele não abre ciclo válido (§4.6), então a
      // régua dele não é régua de ninguém — avisar sobre ela seria ruído.
      .filter((v) => v.modelo.finalidade !== 'DEMONSTRACAO')
      .map((v) => ({
        versaoId: v.id,
        modeloNome: v.modelo.nome,
        versao: v.versao,
        publicado: true,
        grupos: v.grupos.map((g) => ({
          classificacaoId: g.classificacaoId,
          titulo: g.classificacao.nome,
          peso: Number(g.peso),
        })),
        questoes: v.perguntas.map((ap) => ({
          perguntaId: ap.perguntaId,
          classificacaoId: ap.pergunta.classificacaoId,
        })),
      }));
  }

  /**
   * ⭐ Grava o arranjo inteiro. Ver a trava 2 no cabeçalho.
   *
   * ⚠️ **Não valida como se fosse publicar.** Rascunho meio montado é o estado
   * normal de quem está montando: barrar "classificação sem questão" aqui
   * impediria o RH de criar a classificação antes de escolher as questões dela,
   * que é a ordem natural. O que é erro na publicação vem junto na resposta,
   * como `problemasParaPublicar`, para a tela mostrar o que falta — sem impedir
   * de salvar.
   */
  async gravar(versaoId: string, entrada: ArranjoEntrada, usuarioId: string) {
    const versao = await this.prisma.modeloVersao.findUnique({
      where: { id: versaoId },
      include: { modelo: true },
    });
    if (!versao) throw new NotFoundException('Versão não encontrada.');
    if (versao.publicadoEm !== null) {
      throw new BadRequestException(
        `A v${versao.versao} de ${versao.modelo.nome} está PUBLICADA e não se edita — dela saem ` +
          'notas. Duplique-a para um rascunho e mexa lá.',
      );
    }

    await this.assertEntradaCoerente(entrada);

    await this.prisma.$transaction(async (tx) => {
      await tx.arranjoGrupo.deleteMany({ where: { modeloVersaoId: versaoId } });
      await tx.arranjoPergunta.deleteMany({ where: { modeloVersaoId: versaoId } });
      if (entrada.grupos.length) {
        await tx.arranjoGrupo.createMany({
          data: entrada.grupos.map((g, ordem) => ({
            modeloVersaoId: versaoId,
            classificacaoId: g.classificacaoId,
            peso: g.peso,
            ordem,
          })),
        });
      }
      if (entrada.questoes.length) {
        await tx.arranjoPergunta.createMany({
          data: entrada.questoes.map((q, ordem) => ({
            modeloVersaoId: versaoId,
            perguntaId: q.perguntaId,
            ordem,
          })),
        });
      }
    });

    const depois = await this.ler(versaoId);
    await this.auditoria.registrar({
      entidade: 'ModeloVersao',
      entidadeId: versaoId,
      acao: 'MONTAR_ARRANJO',
      usuarioId,
      valorNovo: {
        grupos: entrada.grupos.length,
        questoes: entrada.questoes.length,
        somaDeclarada: depois.somaDeclarada,
        somaDerivada: depois.somaDerivada,
      },
    });
    return depois;
  }

  // ── privados ──────────────────────────────────────────────────────────────

  /**
   * ⚠️ O que é recusado ao SALVAR, e por quê. A lista é curta de propósito:
   * são só as coisas que tornariam o rascunho impossível de interpretar, não as
   * que o tornam incompleto.
   */
  private async assertEntradaCoerente(entrada: ArranjoEntrada) {
    const problemas: string[] = [];

    const classificacoes = new Set(entrada.grupos.map((g) => g.classificacaoId));
    if (classificacoes.size !== entrada.grupos.length) {
      problemas.push('A mesma classificação aparece duas vezes no arranjo.');
    }
    const perguntas = new Set(entrada.questoes.map((q) => q.perguntaId));
    if (perguntas.size !== entrada.questoes.length) {
      problemas.push('A mesma questão aparece duas vezes no arranjo.');
    }
    for (const g of entrada.grupos) {
      if (!(g.peso > 0)) {
        problemas.push(
          `Peso ${g.peso} numa classificação. Para deixá-la de fora, remova-a do arranjo — ` +
            'peso zero faria o avaliador responder à toa.',
        );
        break;
      }
    }
    if (problemas.length) throw new BadRequestException(problemas);

    // Referências que não existem: o banco recusaria com erro de FK, que é
    // ilegível para quem está montando a tela.
    const [existemC, existemQ] = await Promise.all([
      this.prisma.classificacao.count({ where: { id: { in: [...classificacoes] } } }),
      this.prisma.pergunta.count({ where: { id: { in: [...perguntas] } } }),
    ]);
    if (existemC !== classificacoes.size) {
      throw new BadRequestException('Uma das classificações do arranjo não existe mais.');
    }
    if (existemQ !== perguntas.size) {
      throw new BadRequestException('Uma das questões do arranjo não existe mais.');
    }
  }

  private async carregar(versaoId: string) {
    const versao = await this.prisma.modeloVersao.findUnique({
      where: { id: versaoId },
      include: {
        modelo: true,
        grupos: { include: { classificacao: true }, orderBy: { ordem: 'asc' } },
        perguntas: {
          include: { pergunta: { include: { alternativas: true, classificacao: true } } },
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
    const nomes = new Map(
      versao.perguntas.map((ap) => [ap.pergunta.classificacaoId, ap.pergunta.classificacao.nome]),
    );
    return { versao, arranjo, nomes };
  }

  private montarResposta(
    versao: Awaited<ReturnType<ArranjoService['carregar']>>['versao'],
    arranjo: ArranjoParaPublicacao,
    nomes: Map<string, string>,
    outrosPerfis: PerfilComparavel[],
    publicadaDestePerfil: PerfilComparavel | null,
  ): ArranjoDeEdicao {
    // Derivados por questão. Se o arranjo estiver pela metade, vem vazio e o
    // peso de cada questão sai `null` — "sem peso", nunca zero.
    let derivados = new Map<string, number>();
    try {
      derivados = new Map(
        pesosDerivados(
          arranjo.questoes.map((q) => ({
            perguntaId: q.perguntaId,
            classificacaoId: q.classificacaoId,
            ordem: q.ordem,
          })),
          arranjo.grupos.map((g) => ({ classificacaoId: g.classificacaoId, peso: g.peso })),
        ).map((d) => [d.perguntaId, d.peso]),
      );
    } catch {
      /* arranjo incompleto — tratado como peso `null` por questão. */
    }

    return {
      versaoId: versao.id,
      modeloId: versao.modeloId,
      modeloNome: versao.modelo.nome,
      versao: versao.versao,
      publicado: versao.publicadoEm !== null,
      somaDeclarada: somaDeclarada(arranjo.grupos),
      somaDerivada: somaDerivada(arranjo),
      pontuacaoMaxima: pontuacaoMaximaDoArranjoCompleto(arranjo),
      grupos: somatorioPorGrupo(arranjo),
      questoes: arranjo.questoes.map((q) => ({
        perguntaId: q.perguntaId,
        codigo: q.codigo,
        enunciado: q.enunciado,
        ativa: q.ativa,
        classificacaoId: q.classificacaoId,
        classificacaoNome:
          arranjo.grupos.find((g) => g.classificacaoId === q.classificacaoId)?.titulo ??
          nomes.get(q.classificacaoId) ??
          '—',
        ordem: q.ordem,
        peso: derivados.get(q.perguntaId) ?? null,
        maiorValor: q.alternativas.length ? Math.max(...q.alternativas.map((a) => a.valor)) : 0,
      })),
      problemasParaPublicar: validarArranjoParaPublicacao(arranjo),
      avisosDeComparabilidade: avisosDeComparabilidade(
        {
          versaoId: versao.id,
          modeloNome: versao.modelo.nome,
          versao: versao.versao,
          publicado: versao.publicadoEm !== null,
          grupos: arranjo.grupos,
          questoes: arranjo.questoes.map((q) => ({
            perguntaId: q.perguntaId,
            classificacaoId: q.classificacaoId,
          })),
        },
        outrosPerfis,
        publicadaDestePerfil,
      ),
    };
  }
}
