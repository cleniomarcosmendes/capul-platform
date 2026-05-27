import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { CatalogoServicoService } from './catalogo-servico.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { FuncionalidadeGuard } from '../common/guards/funcionalidade.guard.js';
import { RequiresFuncionalidade } from '../common/decorators/requires-funcionalidade.decorator.js';
import { CreateCatalogoDto } from './dto/create-catalogo.dto.js';
import { UpdateCatalogoDto } from './dto/update-catalogo.dto.js';
import { UpdateStatusDto } from '../equipe/dto/update-status.dto.js';
import { StatusGeral } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { GestaoTiRole } from '../common/decorators/gestao-ti-role.decorator.js';
import { WorkspaceAtivo } from '../common/decorators/workspace-ativo.decorator.js';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';
import { assertStaffEmDepto } from '../common/helpers/departamento-filter.helper.js';

@Controller('catalogo-servicos')
@UseGuards(JwtAuthGuard, GestaoTiGuard, RolesGuard, FuncionalidadeGuard)
@RequiresFuncionalidade('CHAMADO')
export class CatalogoServicoController {
  constructor(private readonly service: CatalogoServicoService) {}

  @Get()
  findAll(
    @Query('equipeId') equipeId?: string,
    @Query('status') status?: StatusGeral,
    @CurrentUser() user?: JwtPayload,
    @GestaoTiRole() role?: string,
    @WorkspaceAtivo() workspaceAtivoId?: string | null,
  ) {
    return this.service.findAll(equipeId, status, user, role, workspaceAtivoId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const item = await this.service.findOne(id);
    // S15.7 (27/05) — gate STAFF do depto da equipe (bypass OVERSIGHT).
    assertStaffEmDepto(user, item.equipe?.departamentoId ?? null);
    return item;
  }

  @Post()
  @Roles('ADMIN', 'GESTOR')
  create(@Body() dto: CreateCatalogoDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @Roles('ADMIN', 'GESTOR')
  update(@Param('id') id: string, @Body() dto: UpdateCatalogoDto, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, dto, user);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'GESTOR')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto, @CurrentUser() user: JwtPayload) {
    return this.service.updateStatus(id, dto.status, user);
  }

  @Delete(':id')
  @Roles('ADMIN', 'GESTOR')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.remove(id, user);
  }
}
