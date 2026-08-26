import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EquipeService } from './equipe.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { GestaoTiRole } from '../common/decorators/gestao-ti-role.decorator.js';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';
import { FuncionalidadeGuard } from '../common/guards/funcionalidade.guard.js';
import { RequiresFuncionalidade } from '../common/decorators/requires-funcionalidade.decorator.js';
import { CreateEquipeDto } from './dto/create-equipe.dto.js';
import { UpdateEquipeDto } from './dto/update-equipe.dto.js';
import { UpdateStatusDto } from './dto/update-status.dto.js';
import { AddMembroDto } from './dto/add-membro.dto.js';
import { UpdateMembroDto } from './dto/update-membro.dto.js';
import { StatusGeral } from '@prisma/client';

@Controller('equipes')
@UseGuards(JwtAuthGuard, GestaoTiGuard, RolesGuard, FuncionalidadeGuard)
@RequiresFuncionalidade('EQUIPE')
export class EquipeController {
  constructor(private readonly equipeService: EquipeService) {}

  @Get()
  findAll(@Query('status') status?: StatusGeral) {
    return this.equipeService.findAll(status);
  }

  /**
   * Retorna equipes disponiveis para vincular a contratos.
   * ADMIN/GESTOR_TI: todas as equipes ativas.
   * Outros: apenas equipes onde o usuario pode gerir contratos.
   */
  @Get('para-contratos')
  @Roles('ADMIN', 'GESTOR', 'SUPORTE')
  findEquipesParaContratos(
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.equipeService.findEquipesParaContratos(user.sub, role, user);
  }

  /**
   * S15.4 (27/05) — Lista equipes pra TELA DE CONFIGURAÇÃO (`/equipes`).
   * Restrita a deptos onde user é STAFF, bypass via OVERSIGHT_PLATAFORMA.
   * Endpoint separado do `GET /equipes` (global) — este é só pra UI admin.
   */
  @Get('config')
  @Roles('ADMIN', 'GESTOR', 'SUPORTE')
  findAllParaConfig(
    @Query('status') status: StatusGeral | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.equipeService.findAllParaConfig(status, user);
  }

  /**
   * S15.4 (27/05) — Detalhe de equipe pra TELA DE CONFIGURAÇÃO. Exige STAFF
   * no depto da equipe (bypass via OVERSIGHT). Para ver membros em outras
   * telas (ex: ChamadoDetalhePage), continuar usando `GET /equipes/:id`.
   */
  @Get(':id/config')
  @Roles('ADMIN', 'GESTOR', 'SUPORTE')
  findOneParaConfig(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.equipeService.findOneParaConfig(id, user);
  }

  /**
   * Equipes SELECIONÁVEIS na ABERTURA de chamado — aplica visibilidade
   * pública/privada por departamento (ver `findSelecionaveis`). Distinto do
   * `GET /equipes` (global, usado pela transferência). Sem @Roles: qualquer
   * usuário que pode abrir chamado consulta (o filtro já protege as privadas).
   */
  @Get('abertura')
  findSelecionaveis(
    @Query('status') status: StatusGeral | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.equipeService.findSelecionaveis(user, status ?? 'ATIVO');
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.equipeService.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'GESTOR')
  create(@Body() dto: CreateEquipeDto, @CurrentUser() user: JwtPayload) {
    return this.equipeService.create(dto, user);
  }

  @Patch(':id')
  @Roles('ADMIN', 'GESTOR')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEquipeDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.equipeService.update(id, dto, user);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'GESTOR')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.equipeService.updateStatus(id, dto.status, user);
  }

  // ---- Membros ----

  @Post(':id/membros')
  @Roles('ADMIN', 'GESTOR')
  addMembro(
    @Param('id') id: string,
    @Body() dto: AddMembroDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.equipeService.addMembro(id, dto, user);
  }

  @Patch(':id/membros/:membroId')
  @Roles('ADMIN', 'GESTOR')
  updateMembro(
    @Param('id') id: string,
    @Param('membroId') membroId: string,
    @Body() dto: UpdateMembroDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.equipeService.updateMembro(id, membroId, dto, user);
  }

  @Delete(':id')
  @Roles('ADMIN', 'GESTOR')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.equipeService.remove(id, user);
  }

  @Delete(':id/membros/:membroId')
  @Roles('ADMIN', 'GESTOR')
  removeMembro(
    @Param('id') id: string,
    @Param('membroId') membroId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.equipeService.removeMembro(id, membroId, user);
  }
}
