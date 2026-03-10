import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { OrdemServicoService } from './ordem-servico.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { CreateOsDto } from './dto/create-os.dto.js';
import { UpdateOsDto } from './dto/update-os.dto.js';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';
import { StatusOS } from '@prisma/client';

@Controller('ordens-servico')
@UseGuards(JwtAuthGuard, GestaoTiGuard, RolesGuard)
export class OrdemServicoController {
  constructor(private readonly service: OrdemServicoService) {}

  @Get()
  findAll(@Query('status') status?: StatusOS, @Query('filialId') filialId?: string) {
    return this.service.findAll(status, filialId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'FINANCEIRO')
  create(@Body() dto: CreateOsDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'FINANCEIRO')
  update(@Param('id') id: string, @Body() dto: UpdateOsDto) {
    return this.service.update(id, dto);
  }

  // Workflow
  @Post(':id/iniciar')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'FINANCEIRO')
  iniciar(@Param('id') id: string) {
    return this.service.iniciar(id);
  }

  @Post(':id/encerrar')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'FINANCEIRO')
  encerrar(@Param('id') id: string, @Body() body: { observacoes?: string }) {
    return this.service.encerrar(id, body.observacoes);
  }

  @Post(':id/cancelar')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'FINANCEIRO')
  cancelar(@Param('id') id: string) {
    return this.service.cancelar(id);
  }

  // Chamados N:N
  @Post(':id/chamados')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'FINANCEIRO')
  vincularChamado(@Param('id') id: string, @Body() body: { chamadoId: string }) {
    return this.service.vincularChamado(id, body.chamadoId);
  }

  @Delete(':id/chamados/:chamadoId')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'FINANCEIRO')
  desvincularChamado(@Param('id') id: string, @Param('chamadoId') chamadoId: string) {
    return this.service.desvincularChamado(id, chamadoId);
  }

  // Tecnicos N:N
  @Post(':id/tecnicos')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'FINANCEIRO')
  adicionarTecnico(@Param('id') id: string, @Body() body: { tecnicoId: string }) {
    return this.service.adicionarTecnico(id, body.tecnicoId);
  }

  @Delete(':id/tecnicos/:tecnicoId')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'FINANCEIRO')
  removerTecnico(@Param('id') id: string, @Param('tecnicoId') tecnicoId: string) {
    return this.service.removerTecnico(id, tecnicoId);
  }
}
