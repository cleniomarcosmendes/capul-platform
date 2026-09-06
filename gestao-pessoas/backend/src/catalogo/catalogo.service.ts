/**
 * CATÁLOGO — as listas de apoio das telas do RH.
 *
 * Só leitura. Existe porque montar uma Aplicação exige escolher, na mesma tela,
 * um modelo publicado, os critérios do catálogo e os centros de custo do
 * público — e nenhuma dessas listas tinha por onde ser buscada.
 *
 * ⭐ Os centros de custo saem de `rh.colaborador`, não de uma tabela de
 * cadastro: o que interessa para montar o público é onde há GENTE hoje, com a
 * mesma definição de "ativo" que o sync e a designação usam
 * (`common/elegibilidade.ts`). Uma lista de centros do ERP traria dezenas de
 * códigos vazios e esconderia o que importa — quantas pessoas cada um tem.
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SITUACOES_ELEGIVEIS } from '../common/elegibilidade.js';
import { resolverRegistrado } from '../calculo/resolvers/registry.js';

export interface VersaoDeModelo {
  id: string;
  versao: number;
  publicadoEm: Date | null;
  pontuacaoMaxima: number | null;
  grupos: number;
  perguntas: number;
}

export interface ModeloDoCatalogo {
  id: string;
  nome: string;
  descricao: string | null;
  finalidade: string;
  ativo: boolean;
  versoes: VersaoDeModelo[];
}

export interface CriterioDoCatalogo {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  origem: string;
  tipoValor: string;
  codigoCalculo: string | null;
  unidade: string | null;
  ativo: boolean;
  faixas: number;
  /**
   * ⚠️ false = o critério está no catálogo mas NÃO tem resolver no backend.
   * Usá-lo numa Aplicação devolveria vazio para o ciclo inteiro, em silêncio —
   * por isso a tela precisa poder dizer isso ANTES da escolha, e não só na
   * recusa da abertura do ciclo.
   */
  utilizavel: boolean;
  motivoIndisponivel: string | null;
}

export interface CentroCustoDoCatalogo {
  filial: string;
  centroCusto: string;
  descricao: string | null;
  pessoas: number;
}

@Injectable()
export class CatalogoService {
  constructor(private readonly prisma: PrismaService) {}

  async modelos(): Promise<ModeloDoCatalogo[]> {
    const modelos = await this.prisma.modelo.findMany({
      orderBy: { nome: 'asc' },
      include: {
        versoes: {
          orderBy: { versao: 'desc' },
          include: { grupos: { select: { _count: { select: { perguntas: true } } } } },
        },
      },
    });

    return modelos.map((m) => ({
      id: m.id,
      nome: m.nome,
      descricao: m.descricao,
      finalidade: m.finalidade,
      ativo: m.ativo,
      versoes: m.versoes.map((v) => ({
        id: v.id,
        versao: v.versao,
        publicadoEm: v.publicadoEm,
        pontuacaoMaxima: v.pontuacaoMaxima === null ? null : Number(v.pontuacaoMaxima),
        grupos: v.grupos.length,
        perguntas: v.grupos.reduce((s, g) => s + g._count.perguntas, 0),
      })),
    }));
  }

  async criterios(): Promise<CriterioDoCatalogo[]> {
    const criterios = await this.prisma.criterio.findMany({
      orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
      include: { _count: { select: { faixas: true } } },
    });

    return criterios.map((c) => {
      const semResolver = c.origem === 'CALCULADO' && !resolverRegistrado(c.codigoCalculo);
      const semFaixa = c._count.faixas === 0;
      return {
        id: c.id,
        codigo: c.codigo,
        nome: c.nome,
        descricao: c.descricao,
        origem: c.origem,
        tipoValor: c.tipoValor,
        codigoCalculo: c.codigoCalculo,
        unidade: c.unidade,
        ativo: c.ativo,
        faixas: c._count.faixas,
        utilizavel: c.ativo && !semResolver && !semFaixa,
        motivoIndisponivel: !c.ativo
          ? 'Critério inativo.'
          : semResolver
            ? `Sem resolver registrado no backend para "${c.codigoCalculo ?? '(vazio)'}" — ` +
              'usá-lo deixaria o critério vazio para o ciclo inteiro.'
            : semFaixa
              ? 'Sem faixas cadastradas — não há como pontuar.'
              : null,
      };
    });
  }

  /** Centros de custo com gente hoje, para montar o público da Aplicação. */
  async centrosDeCusto(): Promise<CentroCustoDoCatalogo[]> {
    const linhas = await this.prisma.colaborador.groupBy({
      by: ['filial', 'centroCusto', 'centroCustoDescricao'],
      where: { situacao: { in: SITUACOES_ELEGIVEIS as never[] }, centroCusto: { not: null } },
      _count: { _all: true },
    });

    return linhas
      .map((l) => ({
        filial: l.filial,
        centroCusto: l.centroCusto as string,
        descricao: l.centroCustoDescricao,
        pessoas: l._count._all,
      }))
      .sort((a, b) => a.filial.localeCompare(b.filial) || a.centroCusto.localeCompare(b.centroCusto));
  }

  /**
   * Busca de colaborador — é assim que a gestora escolhe um avaliador que a
   * régua de centro de custo não encontrou. Limite fixo: uma lista de 1.036
   * nomes num `<select>` não é escolha, é rolagem.
   *
   * ⭐⭐ ESTA LISTA NÃO MARCA A PRÓPRIA LINHA, e é decisão registrada
   * (06/09/2026) — não esquecimento. Não "corrija" a ausência.
   *
   * Duas razões, e a segunda é a que decide:
   *
   * 1. `restrita` quer dizer **"esta AVALIAÇÃO é sua"**. Aqui a linha é uma
   *    PESSOA: não há avaliação, avaliador, status nem nota sobre o que a marca
   *    pudesse falar. Marcar seria responder uma pergunta que ninguém fez.
   *
   * 2. Esta busca é usada na Designação para **escolher QUEM AVALIA** — e a
   *    gestora se escolher ali é legítimo: ela avalia 13 pessoas. Um "você" na
   *    linha dela sinalizaria como suspeito um ato inteiramente normal, que é o
   *    oposto do que a marca existe para fazer.
   *
   * As listas que marcam são as que carregam uma avaliação ou o vínculo que a
   * origina: `/resultados`, a fila, a Designação, o público da aplicação e a
   * lista de um avaliador. Ver `avaliacao/separacao-funcoes.ts`.
   */
  async colaboradores(busca: string | undefined) {
    const termo = (busca ?? '').trim();
    return this.prisma.colaborador.findMany({
      where: {
        situacao: { in: SITUACOES_ELEGIVEIS as never[] },
        ...(termo
          ? {
              OR: [
                { nome: { contains: termo, mode: 'insensitive' as const } },
                { matricula: { contains: termo } },
              ],
            }
          : {}),
      },
      orderBy: { nome: 'asc' },
      take: 30,
      select: {
        id: true,
        matricula: true,
        nome: true,
        filial: true,
        centroCusto: true,
        centroCustoDescricao: true,
        cargoDescricao: true,
      },
    });
  }
}
