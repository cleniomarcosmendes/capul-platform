import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { LicencaService } from './licenca.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { GestaoTiRole } from '../common/decorators/gestao-ti-role.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';
import { assertStaffEmDepto } from '../common/helpers/departamento-filter.helper.js';
import { CreateLicencaDto } from './dto/create-licenca.dto.js';
import { UpdateLicencaDto } from './dto/update-licenca.dto.js';
import { AtribuirUsuarioDto } from './dto/atribuir-usuario.dto.js';
import { CreateCategoriaLicencaDto, UpdateCategoriaLicencaDto } from './dto/create-categoria-licenca.dto.js';
import { StatusLicenca } from '@prisma/client';
import { ROLES_TI } from '../common/constants/roles.constant.js';
import { FuncionalidadeGuard } from '../common/guards/funcionalidade.guard.js';
import { RequiresFuncionalidade } from '../common/decorators/requires-funcionalidade.decorator.js';

@Controller('licencas')
@UseGuards(JwtAuthGuard, GestaoTiGuard, RolesGuard, FuncionalidadeGuard)
@RequiresFuncionalidade('LICENCA')
export class LicencaController {
  constructor(private readonly service: LicencaService) {}

  // ─── Categorias de Licenca ────────────────────────────────

  @Get('categorias')
  findAllCategorias(@Query('status') status?: string) {
    return this.service.findAllCategorias(status);
  }

  @Post('categorias')
  @Roles('ADMIN', 'GESTOR')
  createCategoria(@Body() dto: CreateCategoriaLicencaDto) {
    return this.service.createCategoria(dto);
  }

  @Patch('categorias/:id')
  @Roles('ADMIN', 'GESTOR')
  updateCategoria(@Param('id') id: string, @Body() dto: UpdateCategoriaLicencaDto) {
    return this.service.updateCategoria(id, dto);
  }

  @Delete('categorias/:id')
  @Roles('ADMIN', 'GESTOR')
  removeCategoria(@Param('id') id: string) {
    return this.service.removeCategoria(id);
  }

  // ─── Licencas ───────────────────────────────────────────

  @Get()
  findAll(
    @GestaoTiRole() role: string,
    @CurrentUser() user: JwtPayload,
    @Query('softwareId') softwareId?: string,
    @Query('status') status?: StatusLicenca,
    @Query('vencendoEm') vencendoEm?: string,
    @Query('categoriaId') categoriaId?: string,
    @Query('avulsas') avulsas?: string,
    @Query('departamentoId') departamentoId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.findAll(
      {
        softwareId,
        status,
        vencendoEm: vencendoEm ? parseInt(vencendoEm) : undefined,
        categoriaId,
        avulsas: avulsas === 'true',
        departamentoId,
        page: page ? parseInt(page, 10) : undefined,
        pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      },
      role,
      user,
    );
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @GestaoTiRole() role: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const licenca = (await this.service.findOne(id, role)) as { departamentoId: string | null };
    // S15.7 (27/05) — gate STAFF do depto (bypass OVERSIGHT).
    assertStaffEmDepto(user, licenca.departamentoId);
    return licenca;
  }

  @Post()
  @Roles(...ROLES_TI)
  create(@Body() dto: CreateLicencaDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @Roles(...ROLES_TI)
  update(@Param('id') id: string, @Body() dto: UpdateLicencaDto, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, dto, user);
  }

  @Post(':id/renovar')
  @Roles(...ROLES_TI)
  renovar(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.renovar(id, user);
  }

  @Post(':id/inativar')
  @Roles(...ROLES_TI)
  inativar(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.inativar(id, user);
  }

  @Delete(':id')
  @Roles(...ROLES_TI)
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.remove(id, user);
  }

  // ─── Usuarios da Licenca ────────────────────────────────

  @Get(':id/usuarios')
  listarUsuarios(@Param('id') id: string) {
    return this.service.listarUsuariosLicenca(id);
  }

  @Post(':id/usuarios')
  @Roles(...ROLES_TI)
  atribuirUsuario(
    @Param('id') id: string,
    @Body() dto: AtribuirUsuarioDto,
  ) {
    return this.service.atribuirUsuario(id, dto.usuarioId);
  }

  @Delete(':id/usuarios/:usuarioId')
  @Roles(...ROLES_TI)
  desatribuirUsuario(
    @Param('id') id: string,
    @Param('usuarioId') usuarioId: string,
  ) {
    return this.service.desatribuirUsuario(id, usuarioId);
  }
}
