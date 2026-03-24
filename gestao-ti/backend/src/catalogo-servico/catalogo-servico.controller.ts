import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { CatalogoServicoService } from './catalogo-servico.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CreateCatalogoDto } from './dto/create-catalogo.dto.js';
import { UpdateCatalogoDto } from './dto/update-catalogo.dto.js';
import { UpdateStatusDto } from '../equipe/dto/update-status.dto.js';
import { StatusGeral } from '@prisma/client';

@Controller('catalogo-servicos')
@UseGuards(JwtAuthGuard, GestaoTiGuard, RolesGuard)
export class CatalogoServicoController {
  constructor(private readonly service: CatalogoServicoService) {}

  @Get()
  findAll(@Query('equipeId') equipeId?: string, @Query('status') status?: StatusGeral) {
    return this.service.findAll(equipeId, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'GESTOR_TI')
  create(@Body() dto: CreateCatalogoDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'GESTOR_TI')
  update(@Param('id') id: string, @Body() dto: UpdateCatalogoDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'GESTOR_TI')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.service.updateStatus(id, dto.status);
  }

  @Delete(':id')
  @Roles('ADMIN', 'GESTOR_TI')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
