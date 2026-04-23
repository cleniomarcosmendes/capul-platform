import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { FiscalGuard } from '../common/guards/fiscal.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { RoleMinima } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { FiscalAuthenticatedUser } from '../common/interfaces/jwt-payload.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CadastroDivergencia,
  CriticidadeDivergencia,
  StatusDivergencia,
} from '@prisma/client';

interface ListarQuery {
  status?: StatusDivergencia;
  criticidade?: CriticidadeDivergencia;
  uf?: string;
  /** Filtra contribuintes que tenham pelo menos 1 divergência neste campo. */
  campo?: string;
  limit?: string;
  offset?: string;
}

interface AtualizarDto {
  status: 'RESOLVIDA' | 'IGNORADA';
  motivo?: string;
}

interface AcaoEmLoteDto {
  motivo?: string;
}

/** Ordem lógica: CRITICA > ALTA > MEDIA > BAIXA. Usado para calcular criticidadeMax. */
const CRITICIDADE_PESO: Record<CriticidadeDivergencia, number> = {
  CRITICA: 4,
  ALTA: 3,
  MEDIA: 2,
  BAIXA: 1,
};

/**
 * Gerencia divergências detectadas entre Protheus e SEFAZ durante o cruzamento
 * cadastral (`fiscal.cadastro_divergencia`). Alimentadas pelo CruzamentoWorker
 * quando uma diferença de campo (razão social, IE, CNAE, endereço, situação)
 * é identificada entre SA1010/SA2010 e o CCC SEFAZ.
 *
 * Duas visões disponíveis:
 *   - `/divergencias` — lista plana (1 linha = 1 campo divergente). Útil para
 *     relatório analítico filtrado por campo.
 *   - `/divergencias/por-contribuinte` — agrupada (1 linha = 1 contribuinte com
 *     suas N divergências). É o fluxo operacional: analista corrige o cadastro
 *     completo no Protheus de uma vez, resolvendo todas as divergências do
 *     contribuinte em lote.
 */
@Controller('divergencias')
@UseGuards(JwtAuthGuard, FiscalGuard, RolesGuard)
export class DivergenciaController {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- Visão plana (1 linha = 1 divergência) ----------

  @Get()
  @RoleMinima('GESTOR_FISCAL')
  async listar(@Query() q: ListarQuery) {
    const take = Math.min(Number(q.limit ?? '50'), 200);
    const skip = Math.max(Number(q.offset ?? '0'), 0);

    const contribuinteFilter = q.uf ? { uf: q.uf.toUpperCase() } : undefined;

    const where = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.criticidade ? { criticidade: q.criticidade } : {}),
      ...(q.campo ? { campo: q.campo } : {}),
      ...(contribuinteFilter ? { contribuinte: contribuinteFilter } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.cadastroDivergencia.findMany({
        where,
        take,
        skip,
        orderBy: [{ criticidade: 'desc' }, { detectadaEm: 'desc' }],
        include: {
          contribuinte: {
            select: { cnpj: true, uf: true, razaoSocial: true, situacao: true },
          },
        },
      }),
      this.prisma.cadastroDivergencia.count({ where }),
    ]);

    return { total, take, skip, items };
  }

  // ---------- Visão agrupada por contribuinte ----------

  /**
   * Retorna divergências agrupadas por contribuinte. Cada item contém o
   * contribuinte completo, TODAS as divergências dele (independente do filtro
   * `campo`, para dar contexto ao analista), criticidadeMax, total e data da
   * divergência mais antiga.
   *
   * Decisão de design sobre filtro `campo`: ele filtra QUAIS contribuintes
   * aparecem (precisa ter pelo menos 1 divergência no campo), mas NÃO filtra
   * quais divergências são exibidas dentro de cada contribuinte — o analista
   * vai ajustar o cadastro completo no ERP, então ver só o campo filtrado
   * seria enganoso e levaria a ajustes parciais.
   *
   * Paginação é por contribuinte, não por divergência.
   * Ordem: criticidadeMax DESC (ALTA primeiro), detectadaMaisAntiga ASC.
   */
  @Get('por-contribuinte')
  @RoleMinima('GESTOR_FISCAL')
  async listarPorContribuinte(@Query() q: ListarQuery) {
    const take = Math.min(Number(q.limit ?? '50'), 200);
    const skip = Math.max(Number(q.offset ?? '0'), 0);

    // 1) Descobrir os contribuinteIds que têm ao menos 1 divergência matching
    //    os filtros (incluindo o opcional `campo`).
    const contribuinteFilter = q.uf ? { uf: q.uf.toUpperCase() } : undefined;
    const divergenciaMatchWhere = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.criticidade ? { criticidade: q.criticidade } : {}),
      ...(q.campo ? { campo: q.campo } : {}),
      ...(contribuinteFilter ? { contribuinte: contribuinteFilter } : {}),
    };

    const contribuintesComMatch = await this.prisma.cadastroDivergencia.groupBy({
      by: ['contribuinteId'],
      where: divergenciaMatchWhere,
    });
    const idsAlvo = contribuintesComMatch.map((g) => g.contribuinteId);

    if (idsAlvo.length === 0) {
      return { total: 0, take, skip, items: [] };
    }

    // 2) Buscar TODAS as divergências desses contribuintes (sem filtro de
    //    campo — contexto completo) que ainda estejam no status filtrado
    //    (ou ABERTA como default, se status não foi informado).
    //    Se o usuário filtrou explicitamente por status=RESOLVIDA/IGNORADA,
    //    respeitamos — facilita auditoria histórica.
    const statusParaExibir = q.status ?? 'ABERTA';
    const divergenciasCompletas = await this.prisma.cadastroDivergencia.findMany({
      where: {
        contribuinteId: { in: idsAlvo },
        status: statusParaExibir,
      },
      include: {
        contribuinte: {
          select: {
            id: true,
            cnpj: true,
            uf: true,
            razaoSocial: true,
            nomeFantasia: true,
            inscricaoEstadual: true,
            situacao: true,
            enderecoMunicipio: true,
            vinculosProtheus: true,
          },
        },
      },
      orderBy: [{ criticidade: 'desc' }, { detectadaEm: 'asc' }],
    });

    // 3) Agrupar em memória. Volume baixo (~110 divergências hoje, <50 contribuintes)
    //    torna o overhead desprezível; se escalar, migrar para raw SQL com window.
    const grupos = new Map<
      string,
      {
        contribuinte: (typeof divergenciasCompletas)[number]['contribuinte'];
        divergencias: CadastroDivergencia[];
      }
    >();

    for (const d of divergenciasCompletas) {
      const existing = grupos.get(d.contribuinteId);
      if (existing) {
        existing.divergencias.push(d);
      } else {
        grupos.set(d.contribuinteId, {
          contribuinte: d.contribuinte,
          divergencias: [d],
        });
      }
    }

    // 4) Computar agregados por contribuinte
    const contribuinteInfos = Array.from(grupos.values()).map((g) => {
      const criticidadeMaxPeso = Math.max(
        ...g.divergencias.map((d) => CRITICIDADE_PESO[d.criticidade]),
      );
      const criticidadeMax =
        Object.entries(CRITICIDADE_PESO).find(([, p]) => p === criticidadeMaxPeso)?.[0] ??
        'MEDIA';
      const detectadaEmMaisAntiga = g.divergencias.reduce(
        (min, d) => (d.detectadaEm < min ? d.detectadaEm : min),
        g.divergencias[0].detectadaEm,
      );
      return {
        contribuinte: g.contribuinte,
        divergencias: g.divergencias,
        total: g.divergencias.length,
        criticidadeMax,
        detectadaEmMaisAntiga,
      };
    });

    // 5) Ordenar: criticidade DESC (ALTA primeiro), detectada ASC (mais antiga primeiro)
    contribuinteInfos.sort((a, b) => {
      const diffCrit =
        CRITICIDADE_PESO[b.criticidadeMax as CriticidadeDivergencia] -
        CRITICIDADE_PESO[a.criticidadeMax as CriticidadeDivergencia];
      if (diffCrit !== 0) return diffCrit;
      return a.detectadaEmMaisAntiga.getTime() - b.detectadaEmMaisAntiga.getTime();
    });

    // 6) Paginar e totalizar
    const totalContribuintes = contribuinteInfos.length;
    const totalDivergencias = contribuinteInfos.reduce((s, c) => s + c.total, 0);
    const itemsPaginados = contribuinteInfos.slice(skip, skip + take);

    return {
      total: totalContribuintes,
      totalDivergencias,
      take,
      skip,
      items: itemsPaginados,
    };
  }

  // ---------- Obter / atualizar individual ----------

  @Get(':id')
  @RoleMinima('GESTOR_FISCAL')
  async obter(@Param('id', new ParseUUIDPipe()) id: string) {
    const div = await this.prisma.cadastroDivergencia.findUnique({
      where: { id },
      include: { contribuinte: true },
    });
    if (!div) throw new NotFoundException(`Divergência ${id} não encontrada`);
    return div;
  }

  @Patch(':id')
  @RoleMinima('GESTOR_FISCAL')
  async atualizar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: AtualizarDto,
    @CurrentUser() user: FiscalAuthenticatedUser,
  ) {
    if (body.status !== 'RESOLVIDA' && body.status !== 'IGNORADA') {
      throw new BadRequestException('status deve ser RESOLVIDA ou IGNORADA');
    }
    return this.prisma.cadastroDivergencia.update({
      where: { id },
      data: {
        status: body.status,
        resolvidaEm: new Date(),
        resolvidaPor: user.id,
      },
    });
  }

  // ---------- Ações em lote por contribuinte ----------

  /**
   * Resolve TODAS as divergências ABERTAs do contribuinte de uma vez.
   * Reflete o fluxo operacional real: analista ajusta o cadastro completo
   * no Protheus (razão, IE, endereço) simultaneamente — faz sentido fechar
   * todas as divergências do contribuinte em 1 clique.
   *
   * Só mexe em ABERTAs; RESOLVIDAs / IGNORADAs pré-existentes permanecem
   * intactas para manter trilha de auditoria.
   */
  @Patch('por-contribuinte/:contribuinteId/resolver-todas')
  @RoleMinima('GESTOR_FISCAL')
  async resolverTodasDoContribuinte(
    @Param('contribuinteId', new ParseUUIDPipe()) contribuinteId: string,
    @Body() _body: AcaoEmLoteDto,
    @CurrentUser() user: FiscalAuthenticatedUser,
  ) {
    return this.atualizarEmLote(contribuinteId, 'RESOLVIDA', user.id);
  }

  @Patch('por-contribuinte/:contribuinteId/ignorar-todas')
  @RoleMinima('GESTOR_FISCAL')
  async ignorarTodasDoContribuinte(
    @Param('contribuinteId', new ParseUUIDPipe()) contribuinteId: string,
    @Body() _body: AcaoEmLoteDto,
    @CurrentUser() user: FiscalAuthenticatedUser,
  ) {
    return this.atualizarEmLote(contribuinteId, 'IGNORADA', user.id);
  }

  private async atualizarEmLote(
    contribuinteId: string,
    novoStatus: 'RESOLVIDA' | 'IGNORADA',
    userId: string,
  ) {
    // Guard: contribuinte existe?
    const contribuinte = await this.prisma.cadastroContribuinte.findUnique({
      where: { id: contribuinteId },
      select: { id: true, cnpj: true },
    });
    if (!contribuinte) {
      throw new NotFoundException(`Contribuinte ${contribuinteId} não encontrado`);
    }

    const result = await this.prisma.cadastroDivergencia.updateMany({
      where: { contribuinteId, status: 'ABERTA' },
      data: {
        status: novoStatus,
        resolvidaEm: new Date(),
        resolvidaPor: userId,
      },
    });

    return {
      contribuinteId,
      cnpj: contribuinte.cnpj,
      novoStatus,
      divergenciasAtualizadas: result.count,
    };
  }
}
