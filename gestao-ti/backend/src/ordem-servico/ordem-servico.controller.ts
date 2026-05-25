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
import { FuncionalidadeGuard } from '../common/guards/funcionalidade.guard.js';
import { RequiresFuncionalidade } from '../common/decorators/requires-funcionalidade.decorator.js';
import { StatusOS } from '@prisma/client';

@Controller('ordens-servico')
@UseGuards(JwtAuthGuard, GestaoTiGuard, RolesGuard, FuncionalidadeGuard)
@RequiresFuncionalidade('OS')
export class OrdemServicoController {
  constructor(private readonly service: OrdemServicoService) {}

  @Get()
  findAll(
    @Query('status') status?: StatusOS,
    @Query('filialId') filialId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @CurrentUser() user?: JwtPayload,
    @GestaoTiRole() role?: string,
  ) {
    return this.service.findAll(
      status,
      filialId,
      page ? parseInt(page, 10) : undefined,
      pageSize ? parseInt(pageSize, 10) : undefined,
      user,
      role,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'GESTOR', 'SUPORTE')
  create(@Body() dto: CreateOsDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @Roles('ADMIN', 'GESTOR', 'SUPORTE')
  update(@Param('id') id: string, @Body() dto: UpdateOsDto, @CurrentUser() user: JwtPayload, @GestaoTiRole() role: string) {
    return this.service.update(id, dto, user.sub, role, user);
  }

  // Workflow
  @Post(':id/iniciar')
  @Roles('ADMIN', 'GESTOR', 'SUPORTE')
  iniciar(@Param('id') id: string, @CurrentUser() user: JwtPayload, @GestaoTiRole() role: string) {
    return this.service.iniciar(id, user.sub, role, user);
  }

  @Post(':id/encerrar')
  @Roles('ADMIN', 'GESTOR', 'SUPORTE')
  encerrar(@Param('id') id: string, @Body() body: { observacoes?: string }, @CurrentUser() user: JwtPayload, @GestaoTiRole() role: string) {
    return this.service.encerrar(id, body.observacoes, user.sub, role, user);
  }

  @Post(':id/cancelar')
  @Roles('ADMIN', 'GESTOR', 'SUPORTE')
  cancelar(@Param('id') id: string, @CurrentUser() user: JwtPayload, @GestaoTiRole() role: string) {
    return this.service.cancelar(id, user.sub, role, user);
  }

  // Comentarios
  @Post(':id/comentar')
  comentar(@Param('id') id: string, @Body() body: { descricao: string }, @CurrentUser() user: JwtPayload, @GestaoTiRole() role: string) {
    return this.service.comentar(id, body.descricao, user.sub, role, user);
  }

  @Patch(':id/comentarios/:historicoId')
  editarComentario(
    @Param('id') id: string,
    @Param('historicoId') historicoId: string,
    @Body() body: { descricao: string },
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.editarComentario(id, historicoId, body.descricao, user.sub, role, user);
  }

  // Chamados N:N
  @Post(':id/chamados')
  @Roles('ADMIN', 'GESTOR', 'SUPORTE')
  vincularChamado(@Param('id') id: string, @Body() body: { chamadoId: string }, @CurrentUser() user: JwtPayload, @GestaoTiRole() role: string) {
    return this.service.vincularChamado(id, body.chamadoId, user.sub, role, user);
  }

  @Delete(':id/chamados/:chamadoId')
  @Roles('ADMIN', 'GESTOR', 'SUPORTE')
  desvincularChamado(@Param('id') id: string, @Param('chamadoId') chamadoId: string, @CurrentUser() user: JwtPayload, @GestaoTiRole() role: string) {
    return this.service.desvincularChamado(id, chamadoId, user.sub, role, user);
  }

  // Tecnicos N:N
  @Post(':id/tecnicos')
  @Roles('ADMIN', 'GESTOR', 'SUPORTE')
  adicionarTecnico(@Param('id') id: string, @Body() body: { tecnicoId: string }) {
    return this.service.adicionarTecnico(id, body.tecnicoId);
  }

  @Delete(':id/tecnicos/:tecnicoId')
  @Roles('ADMIN', 'GESTOR', 'SUPORTE')
  removerTecnico(@Param('id') id: string, @Param('tecnicoId') tecnicoId: string) {
    return this.service.removerTecnico(id, tecnicoId);
  }
}
