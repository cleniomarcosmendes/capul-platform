import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { SoftwareService } from './software.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CreateSoftwareDto } from './dto/create-software.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { GestaoTiRole } from '../common/decorators/gestao-ti-role.decorator.js';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';
import { FuncionalidadeGuard } from '../common/guards/funcionalidade.guard.js';
import { RequiresFuncionalidade } from '../common/decorators/requires-funcionalidade.decorator.js';
import { UpdateSoftwareDto, UpdateStatusSoftwareDto } from './dto/update-software.dto.js';
import { CreateModuloDto } from './dto/create-modulo.dto.js';
import { UpdateModuloDto, UpdateStatusModuloDto } from './dto/update-modulo.dto.js';
import { TipoSoftware, Criticidade, StatusSoftware } from '@prisma/client';

@Controller('softwares')
@UseGuards(JwtAuthGuard, GestaoTiGuard, RolesGuard, FuncionalidadeGuard)
@RequiresFuncionalidade('SOFTWARE')
export class SoftwareController {
  constructor(private readonly service: SoftwareService) {}

  // ─── Software CRUD ────────────────────────────────────────

  @Get()
  findAll(
    @Query('tipo') tipo?: TipoSoftware,
    @Query('criticidade') criticidade?: Criticidade,
    @Query('status') status?: StatusSoftware,
    @Query('equipeId') equipeId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @CurrentUser() user?: JwtPayload,
    @GestaoTiRole() role?: string,
  ) {
    return this.service.findAll({
      tipo,
      criticidade,
      status,
      equipeId,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    }, user, role);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'GESTOR')
  create(@Body() dto: CreateSoftwareDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @Roles('ADMIN', 'GESTOR')
  update(@Param('id') id: string, @Body() dto: UpdateSoftwareDto, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, dto, user);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'GESTOR')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusSoftwareDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateStatus(id, dto.status, user);
  }

  @Delete(':id')
  @Roles('ADMIN', 'GESTOR')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.remove(id, user);
  }

  // ─── Software ↔ Filial ────────────────────────────────────

  @Post(':id/filiais')
  @Roles('ADMIN', 'GESTOR')
  addFilial(@Param('id') id: string, @Body('filialId') filialId: string) {
    return this.service.addFilial(id, filialId);
  }

  @Delete(':id/filiais/:filialId')
  @Roles('ADMIN', 'GESTOR')
  removeFilial(@Param('id') id: string, @Param('filialId') filialId: string) {
    return this.service.removeFilial(id, filialId);
  }

  // ─── Módulos ──────────────────────────────────────────────

  @Get(':id/modulos')
  findModulos(@Param('id') id: string) {
    return this.service.findModulos(id);
  }

  @Post(':id/modulos')
  @Roles('ADMIN', 'GESTOR')
  createModulo(@Param('id') id: string, @Body() dto: CreateModuloDto) {
    return this.service.createModulo(id, dto);
  }

  @Patch(':id/modulos/:moduloId')
  @Roles('ADMIN', 'GESTOR')
  updateModulo(
    @Param('id') id: string,
    @Param('moduloId') moduloId: string,
    @Body() dto: UpdateModuloDto,
  ) {
    return this.service.updateModulo(id, moduloId, dto);
  }

  @Patch(':id/modulos/:moduloId/status')
  @Roles('ADMIN', 'GESTOR')
  updateModuloStatus(
    @Param('id') id: string,
    @Param('moduloId') moduloId: string,
    @Body() dto: UpdateStatusModuloDto,
  ) {
    return this.service.updateModuloStatus(id, moduloId, dto.status);
  }

  // ─── Módulo ↔ Filial ─────────────────────────────────────

  @Post(':id/modulos/:moduloId/filiais')
  @Roles('ADMIN', 'GESTOR')
  addModuloFilial(
    @Param('id') id: string,
    @Param('moduloId') moduloId: string,
    @Body('filialId') filialId: string,
  ) {
    return this.service.addModuloFilial(id, moduloId, filialId);
  }

  @Delete(':id/modulos/:moduloId/filiais/:filialId')
  @Roles('ADMIN', 'GESTOR')
  removeModuloFilial(
    @Param('id') id: string,
    @Param('moduloId') moduloId: string,
    @Param('filialId') filialId: string,
  ) {
    return this.service.removeModuloFilial(id, moduloId, filialId);
  }
}
