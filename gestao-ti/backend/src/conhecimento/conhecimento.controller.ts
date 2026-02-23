import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ConhecimentoService } from './conhecimento.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { CreateArtigoDto } from './dto/create-artigo.dto.js';
import { UpdateArtigoDto, UpdateStatusArtigoDto } from './dto/update-artigo.dto.js';

@Controller('conhecimento')
@UseGuards(JwtAuthGuard, GestaoTiGuard, RolesGuard)
export class ConhecimentoController {
  constructor(private readonly service: ConhecimentoService) {}

  @Get()
  findAll(
    @Query('categoria') categoria?: string,
    @Query('status') status?: string,
    @Query('softwareId') softwareId?: string,
    @Query('equipeTiId') equipeTiId?: string,
    @Query('search') search?: string,
  ) {
    return this.service.findAll({ categoria, status, softwareId, equipeTiId, search });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'DESENVOLVEDOR')
  create(@Body() dto: CreateArtigoDto, @CurrentUser('sub') autorId: string) {
    return this.service.create(dto, autorId);
  }

  @Patch(':id')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'DESENVOLVEDOR')
  update(@Param('id') id: string, @Body() dto: UpdateArtigoDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'DESENVOLVEDOR')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusArtigoDto) {
    return this.service.updateStatus(id, dto.status);
  }

  @Delete(':id')
  @Roles('ADMIN', 'GESTOR_TI')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
