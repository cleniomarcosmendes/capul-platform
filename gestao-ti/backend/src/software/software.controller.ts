import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { SoftwareService } from './software.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CreateSoftwareDto } from './dto/create-software.dto.js';
import { UpdateSoftwareDto, UpdateStatusSoftwareDto } from './dto/update-software.dto.js';
import { CreateModuloDto } from './dto/create-modulo.dto.js';
import { UpdateModuloDto, UpdateStatusModuloDto } from './dto/update-modulo.dto.js';
import { TipoSoftware, Criticidade, StatusSoftware } from '@prisma/client';

@Controller('softwares')
@UseGuards(JwtAuthGuard, GestaoTiGuard, RolesGuard)
export class SoftwareController {
  constructor(private readonly service: SoftwareService) {}

  // ─── Software CRUD ────────────────────────────────────────

  @Get()
  findAll(
    @Query('tipo') tipo?: TipoSoftware,
    @Query('criticidade') criticidade?: Criticidade,
    @Query('status') status?: StatusSoftware,
    @Query('equipeId') equipeId?: string,
  ) {
    return this.service.findAll({ tipo, criticidade, status, equipeId });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'GESTOR_TI')
  create(@Body() dto: CreateSoftwareDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'GESTOR_TI')
  update(@Param('id') id: string, @Body() dto: UpdateSoftwareDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'GESTOR_TI')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusSoftwareDto) {
    return this.service.updateStatus(id, dto.status);
  }

  @Delete(':id')
  @Roles('ADMIN', 'GESTOR_TI')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // ─── Software ↔ Filial ────────────────────────────────────

  @Post(':id/filiais')
  @Roles('ADMIN', 'GESTOR_TI')
  addFilial(@Param('id') id: string, @Body('filialId') filialId: string) {
    return this.service.addFilial(id, filialId);
  }

  @Delete(':id/filiais/:filialId')
  @Roles('ADMIN', 'GESTOR_TI')
  removeFilial(@Param('id') id: string, @Param('filialId') filialId: string) {
    return this.service.removeFilial(id, filialId);
  }

  // ─── Módulos ──────────────────────────────────────────────

  @Get(':id/modulos')
  findModulos(@Param('id') id: string) {
    return this.service.findModulos(id);
  }

  @Post(':id/modulos')
  @Roles('ADMIN', 'GESTOR_TI')
  createModulo(@Param('id') id: string, @Body() dto: CreateModuloDto) {
    return this.service.createModulo(id, dto);
  }

  @Patch(':id/modulos/:moduloId')
  @Roles('ADMIN', 'GESTOR_TI')
  updateModulo(
    @Param('id') id: string,
    @Param('moduloId') moduloId: string,
    @Body() dto: UpdateModuloDto,
  ) {
    return this.service.updateModulo(id, moduloId, dto);
  }

  @Patch(':id/modulos/:moduloId/status')
  @Roles('ADMIN', 'GESTOR_TI')
  updateModuloStatus(
    @Param('id') id: string,
    @Param('moduloId') moduloId: string,
    @Body() dto: UpdateStatusModuloDto,
  ) {
    return this.service.updateModuloStatus(id, moduloId, dto.status);
  }

  // ─── Módulo ↔ Filial ─────────────────────────────────────

  @Post(':id/modulos/:moduloId/filiais')
  @Roles('ADMIN', 'GESTOR_TI')
  addModuloFilial(
    @Param('id') id: string,
    @Param('moduloId') moduloId: string,
    @Body('filialId') filialId: string,
  ) {
    return this.service.addModuloFilial(id, moduloId, filialId);
  }

  @Delete(':id/modulos/:moduloId/filiais/:filialId')
  @Roles('ADMIN', 'GESTOR_TI')
  removeModuloFilial(
    @Param('id') id: string,
    @Param('moduloId') moduloId: string,
    @Param('filialId') filialId: string,
  ) {
    return this.service.removeModuloFilial(id, moduloId, filialId);
  }
}
