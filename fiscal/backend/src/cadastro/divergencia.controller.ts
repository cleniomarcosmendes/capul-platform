import {
  Body,
  Controller,
  Get,
  Param,
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
import type { CriticidadeDivergencia, StatusDivergencia } from '@prisma/client';

interface ListarQuery {
  status?: StatusDivergencia;
  criticidade?: CriticidadeDivergencia;
  uf?: string;
  limit?: string;
  offset?: string;
}

interface AtualizarDto {
  status: 'RESOLVIDA' | 'IGNORADA';
  motivo?: string;
}

/**
 * Gerencia divergências detectadas entre Protheus e SEFAZ durante o cruzamento
 * cadastral (`fiscal.cadastro_divergencia`). Alimentadas pelo CruzamentoWorker
 * quando uma diferença de campo (razão social, IE, CNAE, endereço, situação)
 * é identificada entre SA1010/SA2010 e o CCC SEFAZ.
 */
@Controller('divergencias')
@UseGuards(JwtAuthGuard, FiscalGuard, RolesGuard)
export class DivergenciaController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RoleMinima('ANALISTA_CADASTRO')
  async listar(@Query() q: ListarQuery) {
    const take = Math.min(Number(q.limit ?? '50'), 200);
    const skip = Math.max(Number(q.offset ?? '0'), 0);

    const contribuinteFilter = q.uf ? { uf: q.uf.toUpperCase() } : undefined;

    const where = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.criticidade ? { criticidade: q.criticidade } : {}),
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

  @Get(':id')
  @RoleMinima('ANALISTA_CADASTRO')
  async obter(@Param('id') id: string) {
    const div = await this.prisma.cadastroDivergencia.findUnique({
      where: { id },
      include: { contribuinte: true },
    });
    if (!div) throw new NotFoundException(`Divergência ${id} não encontrada`);
    return div;
  }

  @Patch(':id')
  @RoleMinima('ANALISTA_CADASTRO')
  async atualizar(
    @Param('id') id: string,
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
}
