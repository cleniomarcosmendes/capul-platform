/**
 * ⭐⭐ VERSÕES DO MODELO — duplicar para rascunho, e descartar rascunho.
 *
 * A Etapa 2 do editor. Antes dela **não existia nenhuma versão em rascunho** no
 * módulo: as quatro nasceram publicadas, pelo seed. É por isso que a guarda
 * "aplicação só sobre versão publicada" entrou ANTES desta peça e não depois —
 * até aqui ela não tinha o que barrar, e uma guarda que nunca é exercitada é
 * uma guarda que ninguém sabe se funciona.
 *
 * ⚠️ O que se duplica é o ARRANJO, não as questões. Depois do acervo (11/09) a
 * questão é global: duas versões apontam para a MESMA `Pergunta`. Copiar a
 * questão criaria uma segunda cópia do enunciado, que envelheceria sozinha — é
 * exatamente o que a unificação desfez (39 linhas para 15).
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import {
  efeitoDeDescartar,
  efeitoDeDuplicar,
  type Efeito,
} from './efeito-de-versionar.js';

export interface VersaoDoModelo {
  id: string;
  modeloId: string;
  modeloNome: string;
  versao: number;
  publicadoEm: Date | null;
  aplicacoesQueUsam: number;
  totalGrupos: number;
  totalQuestoes: number;
  /** Soma dos pesos das classificações — a pontuação do questionário. */
  somaDosPesos: number;
  /**
   * ⭐⭐ É a versão VIGENTE deste perfil? A de maior número entre as publicadas.
   *
   * ⚠️ **Duas publicadas ao mesmo tempo é DESENHO, não defeito.** A Aplicação
   * aponta para uma versão ESPECÍFICA (`modeloVersaoId`) — as 8 do
   * Administrativo apontam para a v1. Se publicar a v2 despublicasse a v1,
   * essas 8 ficariam sem instrumento e as notas já calculadas sobre ela
   * ficariam sem régua. Versão publicada é permanente, pela mesma razão que
   * `efeitoDeDescartar` recusa apagá-la.
   *
   * O que faltava não era guarda: era **dizer qual vale**. A varredura viu v1 e
   * v2 publicadas no mesmo dia, sem hora e sem marca, e não tinha como saber.
   */
  vigente: boolean;
  /** O que acontece se pedir para descartar. A tela lê para desabilitar. */
  efeitoDeDescartar: Efeito;
}

@Injectable()
export class VersaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** As versões de um modelo, com o que a tela precisa para decidir o que oferecer. */
  async doModelo(modeloId: string): Promise<VersaoDoModelo[]> {
    const modelo = await this.prisma.modelo.findUnique({
      where: { id: modeloId },
      include: {
        versoes: {
          orderBy: { versao: 'desc' },
          include: {
            grupos: { select: { peso: true } },
            _count: { select: { perguntas: true, aplicacoes: true } },
          },
        },
      },
    });
    if (!modelo) throw new NotFoundException('Modelo não encontrado.');

    /**
     * ⚠️ A VIGENTE é a de MAIOR NÚMERO entre as publicadas, não a de data mais
     * recente: duas podem ser publicadas no mesmo minuto (foi o caso da
     * varredura), e aí a data não desempata. O número da versão é monotônico
     * por construção (`max + 1`).
     */
    const vigenteId = modelo.versoes
      .filter((v) => v.publicadoEm !== null)
      .sort((a, b) => b.versao - a.versao)[0]?.id;

    return modelo.versoes.map((v) => ({
      vigente: v.id === vigenteId,
      id: v.id,
      modeloId: modelo.id,
      modeloNome: modelo.nome,
      versao: v.versao,
      publicadoEm: v.publicadoEm,
      aplicacoesQueUsam: v._count.aplicacoes,
      totalGrupos: v.grupos.length,
      totalQuestoes: v._count.perguntas,
      somaDosPesos: v.grupos.reduce((s, g) => s + Number(g.peso), 0),
      efeitoDeDescartar: efeitoDeDescartar({
        modeloNome: modelo.nome,
        versao: v.versao,
        publicada: v.publicadoEm !== null,
        aplicacoesQueUsam: v._count.aplicacoes,
      }),
    }));
  }

  /** A prévia do duplicar — a MESMA função que o ato consulta. */
  async previaDeDuplicar(versaoOrigemId: string): Promise<Efeito> {
    return (await this.contextoDeDuplicar(versaoOrigemId)).efeito;
  }

  private async contextoDeDuplicar(versaoOrigemId: string) {
    const origem = await this.prisma.modeloVersao.findUnique({
      where: { id: versaoOrigemId },
      include: { modelo: true },
    });
    if (!origem) throw new NotFoundException('Versão de origem não encontrada.');

    const rascunho = await this.prisma.modeloVersao.findFirst({
      where: { modeloId: origem.modeloId, publicadoEm: null },
      orderBy: { versao: 'desc' },
      select: { versao: true },
    });

    return {
      origem,
      efeito: efeitoDeDuplicar({
        modeloNome: origem.modelo.nome,
        versaoOrigem: origem.versao,
        rascunhoExistente: rascunho,
      }),
    };
  }

  /**
   * ⭐ DUPLICAR — o rascunho nasce IDÊNTICO à origem.
   *
   * Idêntico é o requisito, não uma comodidade: o portão desta etapa é que o
   * rascunho tenha **os mesmos 44 pesos efetivos** da versão original. Como o
   * peso da questão é derivado (`peso_da_classificação ÷ questões`), copiar os
   * `ArranjoGrupo` com o mesmo peso e os `ArranjoPergunta` com a mesma ordem
   * basta — e é o único jeito que continua batendo quando alguém acrescentar
   * uma questão depois.
   */
  async duplicar(versaoOrigemId: string, usuarioId: string) {
    const { origem, efeito } = await this.contextoDeDuplicar(versaoOrigemId);
    if (efeito.acao === 'RECUSAR') throw new BadRequestException(efeito.frase);

    const [grupos, perguntas, maior] = await Promise.all([
      this.prisma.arranjoGrupo.findMany({ where: { modeloVersaoId: origem.id } }),
      this.prisma.arranjoPergunta.findMany({ where: { modeloVersaoId: origem.id } }),
      this.prisma.modeloVersao.findFirst({
        where: { modeloId: origem.modeloId },
        orderBy: { versao: 'desc' },
        select: { versao: true },
      }),
    ]);

    const nova = await this.prisma.$transaction(async (tx) => {
      const criada = await tx.modeloVersao.create({
        data: {
          modeloId: origem.modeloId,
          versao: (maior?.versao ?? origem.versao) + 1,
          /**
           * ⚠️ `publicadoEm` e `pontuacaoMaxima` ficam NULOS de propósito.
           * A pontuação máxima é gravada na PUBLICAÇÃO, calculada do arranjo
           * final; copiar a da origem gravaria um número que descreve outro
           * arranjo, e ele passaria a "conferir" contra o recalculado errado.
           */
        },
      });
      if (grupos.length) {
        await tx.arranjoGrupo.createMany({
          data: grupos.map((g) => ({
            modeloVersaoId: criada.id,
            classificacaoId: g.classificacaoId,
            peso: g.peso,
            ordem: g.ordem,
          })),
        });
      }
      if (perguntas.length) {
        await tx.arranjoPergunta.createMany({
          data: perguntas.map((p) => ({
            modeloVersaoId: criada.id,
            perguntaId: p.perguntaId,
            ordem: p.ordem,
          })),
        });
      }
      return criada;
    });

    await this.auditoria.registrar({
      entidade: 'ModeloVersao',
      entidadeId: nova.id,
      acao: 'DUPLICAR',
      usuarioId,
      valorAnterior: { versaoOrigemId: origem.id, versao: origem.versao },
      valorNovo: {
        versao: nova.versao,
        grupos: grupos.length,
        questoes: perguntas.length,
      },
    });

    return {
      id: nova.id,
      modeloId: nova.modeloId,
      versao: nova.versao,
      grupos: grupos.length,
      questoes: perguntas.length,
    };
  }

  /** DESCARTAR um rascunho. Ato irreversível — a frase diz o que se perde. */
  async descartar(versaoId: string, usuarioId: string) {
    const versao = await this.prisma.modeloVersao.findUnique({
      where: { id: versaoId },
      include: { modelo: true, _count: { select: { aplicacoes: true } } },
    });
    if (!versao) throw new NotFoundException('Versão não encontrada.');

    const efeito = efeitoDeDescartar({
      modeloNome: versao.modelo.nome,
      versao: versao.versao,
      publicada: versao.publicadoEm !== null,
      aplicacoesQueUsam: versao._count.aplicacoes,
    });
    if (efeito.acao === 'RECUSAR') throw new BadRequestException(efeito.frase);

    const apagados = await this.prisma.$transaction(async (tx) => {
      const g = await tx.arranjoGrupo.deleteMany({ where: { modeloVersaoId: versaoId } });
      const p = await tx.arranjoPergunta.deleteMany({ where: { modeloVersaoId: versaoId } });
      await tx.modeloVersao.delete({ where: { id: versaoId } });
      return { grupos: g.count, questoes: p.count };
    });

    await this.auditoria.registrar({
      entidade: 'ModeloVersao',
      entidadeId: versaoId,
      acao: 'DESCARTAR',
      usuarioId,
      valorAnterior: {
        modelo: versao.modelo.nome,
        versao: versao.versao,
        ...apagados,
      },
    });

    return { ok: true, ...apagados };
  }
}
