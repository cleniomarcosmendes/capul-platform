import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { SlaService } from './sla.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { FuncionalidadeGuard } from '../common/guards/funcionalidade.guard.js';
import { RequiresFuncionalidade } from '../common/decorators/requires-funcionalidade.decorator.js';
import { CreateSlaDto } from './dto/create-sla.dto.js';
import { UpdateSlaDto } from './dto/update-sla.dto.js';
import { UpdateStatusDto } from '../equipe/dto/update-status.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { GestaoTiRole } from '../common/decorators/gestao-ti-role.decorator.js';
import { WorkspaceAtivo } from '../common/decorators/workspace-ativo.decorator.js';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';

@Controller('sla')
@UseGuards(JwtAuthGuard, GestaoTiGuard, RolesGuard, FuncionalidadeGuard)
@RequiresFuncionalidade('CHAMADO')
export class SlaController {
  constructor(private readonly service: SlaService) {}

  @Get()
  findAll(
    @Query('equipeId') equipeId?: string,
    @CurrentUser() user?: JwtPayload,
    @GestaoTiRole() role?: string,
    @WorkspaceAtivo() workspaceAtivoId?: string | null,
  ) {
    return this.service.findAll(equipeId, user, role, workspaceAtivoId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'GESTOR')
  create(@Body() dto: CreateSlaDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @Roles('ADMIN', 'GESTOR')
  update(@Param('id') id: string, @Body() dto: UpdateSlaDto, @CurrentUser() user: JwtPayload) {
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
