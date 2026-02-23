import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ChamadoService } from './chamado.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { GestaoTiRole } from '../common/decorators/gestao-ti-role.decorator.js';
import { CreateChamadoDto } from './dto/create-chamado.dto.js';
import { TransferirEquipeDto, TransferirTecnicoDto } from './dto/transferir-chamado.dto.js';
import { ComentarioChamadoDto } from './dto/comentario-chamado.dto.js';
import { ResolverChamadoDto, ReabrirChamadoDto, CsatDto } from './dto/resolver-chamado.dto.js';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';
import { StatusChamado, Visibilidade } from '@prisma/client';

@Controller('chamados')
@UseGuards(JwtAuthGuard, GestaoTiGuard, RolesGuard)
export class ChamadoController {
  constructor(private readonly service: ChamadoService) {}

  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
    @Query('status') status?: StatusChamado,
    @Query('equipeId') equipeId?: string,
    @Query('visibilidade') visibilidade?: Visibilidade,
    @Query('meusChamados') meusChamados?: string,
    @Query('projetoId') projetoId?: string,
    @Query('filialId') filialId?: string,
  ) {
    return this.service.findAll(user, role, {
      status,
      equipeId,
      visibilidade,
      meusChamados: meusChamados === 'true',
      projetoId,
      filialId,
    });
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.findOne(id, user, role);
  }

  @Post()
  create(
    @Body() dto: CreateChamadoDto,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.create(dto, user, role);
  }

  @Post(':id/assumir')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'DESENVOLVEDOR')
  assumir(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.assumir(id, user);
  }

  @Post(':id/transferir-equipe')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'DESENVOLVEDOR')
  transferirEquipe(
    @Param('id') id: string,
    @Body() dto: TransferirEquipeDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.transferirEquipe(id, dto, user);
  }

  @Post(':id/transferir-tecnico')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO')
  transferirTecnico(
    @Param('id') id: string,
    @Body() dto: TransferirTecnicoDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.transferirTecnico(id, dto, user);
  }

  @Post(':id/comentar')
  comentar(
    @Param('id') id: string,
    @Body() dto: ComentarioChamadoDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.comentar(id, dto, user);
  }

  @Patch(':id/resolver')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'DESENVOLVEDOR')
  resolver(
    @Param('id') id: string,
    @Body() dto: ResolverChamadoDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.resolver(id, dto, user);
  }

  @Patch(':id/fechar')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'DESENVOLVEDOR')
  fechar(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.fechar(id, user);
  }

  @Post(':id/reabrir')
  reabrir(
    @Param('id') id: string,
    @Body() dto: ReabrirChamadoDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.reabrir(id, dto, user);
  }

  @Patch(':id/cancelar')
  @Roles('ADMIN', 'GESTOR_TI')
  cancelar(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.cancelar(id, user);
  }

  @Post(':id/avaliar')
  avaliar(
    @Param('id') id: string,
    @Body() dto: CsatDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.avaliar(id, dto, user);
  }
}
