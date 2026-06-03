import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { LicencaCompraService } from './licenca-compra.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';
import { CreateLicencaCompraDto } from './dto/create-licenca-compra.dto.js';
import { UpdateLicencaCompraDto } from './dto/update-licenca-compra.dto.js';
import { ROLES_TI } from '../common/constants/roles.constant.js';
import { FuncionalidadeGuard } from '../common/guards/funcionalidade.guard.js';
import { RequiresFuncionalidade } from '../common/decorators/requires-funcionalidade.decorator.js';

@Controller('licenca-compras')
@UseGuards(JwtAuthGuard, GestaoTiGuard, RolesGuard, FuncionalidadeGuard)
@RequiresFuncionalidade('LICENCA')
export class LicencaCompraController {
  constructor(private readonly service: LicencaCompraService) {}

  @Get()
  findAll(
    @Query('busca') busca?: string,
    @Query('fornecedorId') fornecedorId?: string,
    @Query('semNota') semNota?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.findAll({
      busca,
      fornecedorId,
      semNota: semNota === 'true' ? true : semNota === 'false' ? false : undefined,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(...ROLES_TI)
  create(@Body() dto: CreateLicencaCompraDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @Roles(...ROLES_TI)
  update(@Param('id') id: string, @Body() dto: UpdateLicencaCompraDto, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(...ROLES_TI)
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.remove(id, user);
  }
}
