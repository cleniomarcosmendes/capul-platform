import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { OrdemServicoService } from './ordem-servico.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { GestaoTiRole } from '../common/decorators/gestao-ti-role.decorator.js';
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
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  create(@Body() dto: CreateOsDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  update(@Param('id') id: string, @Body() dto: UpdateOsDto, @CurrentUser() user: JwtPayload, @GestaoTiRole() role: string) {
    return this.service.update(id, dto, user.sub, role);
  }

  // Workflow
  @Post(':id/iniciar')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  iniciar(@Param('id') id: string, @CurrentUser() user: JwtPayload, @GestaoTiRole() role: string) {
    return this.service.iniciar(id, user.sub, role);
  }

  @Post(':id/encerrar')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  encerrar(@Param('id') id: string, @Body() body: { observacoes?: string }, @CurrentUser() user: JwtPayload, @GestaoTiRole() role: string) {
    return this.service.encerrar(id, body.observacoes, user.sub, role);
  }

  @Post(':id/cancelar')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  cancelar(@Param('id') id: string, @CurrentUser() user: JwtPayload, @GestaoTiRole() role: string) {
    return this.service.cancelar(id, user.sub, role);
  }

  // Comentarios
  @Post(':id/comentar')
  comentar(@Param('id') id: string, @Body() body: { descricao: string }, @CurrentUser() user: JwtPayload, @GestaoTiRole() role: string) {
    return this.service.comentar(id, body.descricao, user.sub, role);
  }

  // Chamados N:N
  @Post(':id/chamados')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  vincularChamado(@Param('id') id: string, @Body() body: { chamadoId: string }, @CurrentUser() user: JwtPayload, @GestaoTiRole() role: string) {
    return this.service.vincularChamado(id, body.chamadoId, user.sub, role);
  }

  @Delete(':id/chamados/:chamadoId')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  desvincularChamado(@Param('id') id: string, @Param('chamadoId') chamadoId: string, @CurrentUser() user: JwtPayload, @GestaoTiRole() role: string) {
    return this.service.desvincularChamado(id, chamadoId, user.sub, role);
  }

  // Tecnicos N:N
  @Post(':id/tecnicos')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  adicionarTecnico(@Param('id') id: string, @Body() body: { tecnicoId: string }) {
    return this.service.adicionarTecnico(id, body.tecnicoId);
  }

  @Delete(':id/tecnicos/:tecnicoId')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  removerTecnico(@Param('id') id: string, @Param('tecnicoId') tecnicoId: string) {
    return this.service.removerTecnico(id, tecnicoId);
  }
}
