import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { LicencaService } from './licenca.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { GestaoTiRole } from '../common/decorators/gestao-ti-role.decorator.js';
import { CreateLicencaDto } from './dto/create-licenca.dto.js';
import { UpdateLicencaDto } from './dto/update-licenca.dto.js';
import { AtribuirUsuarioDto } from './dto/atribuir-usuario.dto.js';
import { StatusLicenca } from '@prisma/client';

@Controller('licencas')
@UseGuards(JwtAuthGuard, GestaoTiGuard, RolesGuard)
export class LicencaController {
  constructor(private readonly service: LicencaService) {}

  @Get()
  findAll(
    @GestaoTiRole() role: string,
    @Query('softwareId') softwareId?: string,
    @Query('status') status?: StatusLicenca,
    @Query('vencendoEm') vencendoEm?: string,
  ) {
    return this.service.findAll(
      {
        softwareId,
        status,
        vencendoEm: vencendoEm ? parseInt(vencendoEm) : undefined,
      },
      role,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @GestaoTiRole() role: string) {
    return this.service.findOne(id, role);
  }

  @Post()
  @Roles('ADMIN', 'GESTOR_TI')
  create(@Body() dto: CreateLicencaDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'GESTOR_TI')
  update(@Param('id') id: string, @Body() dto: UpdateLicencaDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/renovar')
  @Roles('ADMIN', 'GESTOR_TI')
  renovar(@Param('id') id: string) {
    return this.service.renovar(id);
  }

  @Post(':id/inativar')
  @Roles('ADMIN', 'GESTOR_TI')
  inativar(@Param('id') id: string) {
    return this.service.inativar(id);
  }

  // ─── Usuarios da Licenca ────────────────────────────────

  @Get(':id/usuarios')
  listarUsuarios(@Param('id') id: string) {
    return this.service.listarUsuariosLicenca(id);
  }

  @Post(':id/usuarios')
  @Roles('ADMIN', 'GESTOR_TI')
  atribuirUsuario(
    @Param('id') id: string,
    @Body() dto: AtribuirUsuarioDto,
  ) {
    return this.service.atribuirUsuario(id, dto.usuarioId);
  }

  @Delete(':id/usuarios/:usuarioId')
  @Roles('ADMIN', 'GESTOR_TI')
  desatribuirUsuario(
    @Param('id') id: string,
    @Param('usuarioId') usuarioId: string,
  ) {
    return this.service.desatribuirUsuario(id, usuarioId);
  }
}
