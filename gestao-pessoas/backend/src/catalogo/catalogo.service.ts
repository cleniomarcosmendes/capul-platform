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
import { pontuacaoMaxima, somatorioPorGrupo } from '../modelo/publicacao.validator.js';
import { NotFoundException } from '@nestjs/common';

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

/**
 * ⭐ O INSTRUMENTO INTEIRO, para LER — não para montar.
 *
 * Existe porque `modelos()` devolve `perguntas: 11`, uma CONTAGEM, e a gestora
 * de RH precisa responder se as 44 perguntas herdadas do RD8010 servem para o
 * ciclo. Sem isto a pergunta não tinha como ser feita: o texto das perguntas não
 * tinha caminho nenhum, nem em tela nem em API — só no `prisma/seed.ts`.
 *
 * ⚠️ Leitura pura, e deliberadamente **não é o editor**. O editor é outro
 * trabalho (semanas); esta é a peça de um dia que destrava a decisão dele.
 */
export interface AlternativaDoInstrumento {
  id: string;
  descricao: string;
  valor: number;
  ordem: number;
  codigoOrigem: string | null;
  /** A de maior valor da pergunta — é ela que define a pontuação máxima. */
  maiorValor: boolean;
}

export interface PerguntaDoInstrumento {
  id: string;
  enunciado: string;
  ordem: number;
  peso: number;
  codigoOrigem: string | null;
  /** `peso × maior valor` — quanto esta pergunta vale no denominador. */
  pontuacaoMaxima: number;
  /** Fração do peso total do questionário, em %. */
  percentualDoPeso: number;
  alternativas: AlternativaDoInstrumento[];
}

export interface GrupoDoInstrumento {
  id: string;
  titulo: string;
  ordem: number;
  /**
   * ⚠️ Grupo NÃO tem peso próprio (decisão de 05/09): isto é a SOMA dos pesos
   * das perguntas dele. Vai junto porque é o balanço que o RH precisa enxergar
   * para julgar o instrumento — e vem de `somatorioPorGrupo`, a mesma função
   * que a futura tela de montagem vai usar.
   */
  pesoTotal: number;
  percentual: number;
  perguntas: PerguntaDoInstrumento[];
}

export interface InstrumentoCompleto {
  modeloId: string;
  modeloNome: string;
  descricao: string | null;
  finalidade: string;
  ativo: boolean;
  versaoId: string;
  versao: number;
  publicadoEm: Date | null;
  /** Gravada na publicação. Fica ao lado da recalculada, para conferência. */
  pontuacaoMaximaGravada: number | null;
  /** Recalculada agora, sobre as perguntas que estão no banco. */
  pontuacaoMaximaCalculada: number;
  somaDosPesos: number;
  totalGrupos: number;
  totalPerguntas: number;
  totalAlternativas: number;
  /** Quantas aplicações usam esta versão — quem lê precisa saber se está em uso. */
  aplicacoesQueUsam: number;
  grupos: GrupoDoInstrumento[];
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

  /**
   * O instrumento inteiro de UMA versão. Ver `InstrumentoCompleto`.
   *
   * ⭐ A pontuação máxima vem em DUAS colunas — a gravada na publicação e a
   * recalculada agora, pela mesma `pontuacaoMaxima()` que a publicação usa.
   * Iguais, é conferência; diferentes, alguém mexeu no banco por fora e a nota
   * de todo mundo está saindo sobre um denominador que não é o do instrumento.
   * Mostrar só uma delas esconderia exatamente o caso que importa.
   */
  async instrumento(versaoId: string): Promise<InstrumentoCompleto> {
    const v = await this.prisma.modeloVersao.findUnique({
      where: { id: versaoId },
      include: {
        modelo: true,
        _count: { select: { aplicacoes: true } },
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
    });
    if (!v) throw new NotFoundException('Versão de modelo não encontrada.');

    // A forma que `publicacao.validator` consome — os dois cálculos saem dela.
    const paraValidador = v.grupos.map((g) => ({
      titulo: g.titulo,
      perguntas: g.perguntas.map((p) => ({
        enunciado: p.enunciado,
        peso: Number(p.peso),
        alternativas: p.alternativas.map((a) => ({ valor: Number(a.valor) })),
      })),
    }));
    const balanco = new Map(somatorioPorGrupo(paraValidador).map((g) => [g.titulo, g]));
    const somaDosPesos = v.grupos
      .flatMap((g) => g.perguntas)
      .reduce((s, p) => s + Number(p.peso), 0);

    return {
      modeloId: v.modeloId,
      modeloNome: v.modelo.nome,
      descricao: v.modelo.descricao,
      finalidade: v.modelo.finalidade,
      ativo: v.modelo.ativo,
      versaoId: v.id,
      versao: v.versao,
      publicadoEm: v.publicadoEm,
      pontuacaoMaximaGravada: v.pontuacaoMaxima === null ? null : Number(v.pontuacaoMaxima),
      pontuacaoMaximaCalculada: pontuacaoMaxima(paraValidador),
      somaDosPesos,
      totalGrupos: v.grupos.length,
      totalPerguntas: v.grupos.reduce((s, g) => s + g.perguntas.length, 0),
      totalAlternativas: v.grupos.reduce(
        (s, g) => s + g.perguntas.reduce((t, p) => t + p.alternativas.length, 0),
        0,
      ),
      aplicacoesQueUsam: v._count.aplicacoes,
      grupos: v.grupos.map((g) => ({
        id: g.id,
        titulo: g.titulo,
        ordem: g.ordem,
        pesoTotal: balanco.get(g.titulo)?.pesoTotal ?? 0,
        percentual: balanco.get(g.titulo)?.percentual ?? 0,
        perguntas: g.perguntas.map((p) => {
          const valores = p.alternativas.map((a) => Number(a.valor));
          const maior = valores.length ? Math.max(...valores) : 0;
          const peso = Number(p.peso);
          return {
            id: p.id,
            enunciado: p.enunciado,
            ordem: p.ordem,
            peso,
            codigoOrigem: p.codigoOrigem,
            pontuacaoMaxima: peso * maior,
            percentualDoPeso: somaDosPesos > 0 ? (peso / somaDosPesos) * 100 : 0,
            alternativas: p.alternativas.map((a) => ({
              id: a.id,
              descricao: a.descricao,
              valor: Number(a.valor),
              ordem: a.ordem,
              codigoOrigem: a.codigoOrigem,
              maiorValor: Number(a.valor) === maior,
            })),
          };
        }),
      })),
    };
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
