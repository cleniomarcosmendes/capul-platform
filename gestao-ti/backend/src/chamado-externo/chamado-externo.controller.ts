import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ChamadoExternoService } from './chamado-externo.service.js';
import { CreateChamadoExternoDto, UpdateChamadoExternoDto } from './dto/create-chamado-externo.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { GestaoTiRole } from '../common/decorators/gestao-ti-role.decorator.js';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';
import { assertStaffEmDepto } from '../common/helpers/departamento-filter.helper.js';
import { ROLES_GESTORES, ROLES_TI } from '../common/constants/roles.constant.js';
import { FuncionalidadeGuard } from '../common/guards/funcionalidade.guard.js';
import { RequiresFuncionalidade } from '../common/decorators/requires-funcionalidade.decorator.js';

const READERS = [...ROLES_TI];
const WRITERS = [...ROLES_GESTORES];

@Controller('chamados-externos')
@UseGuards(JwtAuthGuard, GestaoTiGuard, RolesGuard, FuncionalidadeGuard)
@RequiresFuncionalidade('INDICADOR_ESTRATEGICO')
export class ChamadoExternoController {
  constructor(private readonly service: ChamadoExternoService) {}

  @Get()
  @Roles(...READERS)
  list(
    @Query('ano') ano?: string,
    @Query('mes') mes?: string,
    @Query('softwareId') softwareId?: string,
    @CurrentUser() user?: JwtPayload,
    @GestaoTiRole() role?: string,
  ) {
    return this.service.list({
      ano: ano ? parseInt(ano, 10) : undefined,
      mes: mes ? parseInt(mes, 10) : undefined,
      softwareId,
    }, user, role);
  }

  @Get(':id')
  @Roles(...READERS)
  async findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const reg = await this.service.findOne(id);
    // S15.7 (27/05) — gate STAFF do depto (bypass OVERSIGHT). departamentoId
    // pode ser NULL em registros legados pré-Onda 1 — nesse caso, libera (não
    // havia dono atribuível).
    if (reg.departamentoId) assertStaffEmDepto(user, reg.departamentoId);
    return reg;
  }

  @Post()
  @Roles(...WRITERS)
  create(@Body() dto: CreateChamadoExternoDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub, user);
  }

  @Patch(':id')
  @Roles(...WRITERS)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateChamadoExternoDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(...WRITERS)
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.remove(id, user);
  }
}
