import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { AtivoService } from './ativo.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CreateAtivoDto } from './dto/create-ativo.dto.js';
import { UpdateAtivoDto, UpdateStatusAtivoDto } from './dto/update-ativo.dto.js';
import { AddAtivoSoftwareDto } from './dto/add-ativo-software.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';

@Controller('ativos')
@UseGuards(JwtAuthGuard, GestaoTiGuard, RolesGuard)
export class AtivoController {
  constructor(private readonly service: AtivoService) {}

  @Get()
  findAll(
    @Query('tipo') tipo?: string,
    @Query('status') status?: string,
    @Query('filialId') filialId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.findAll({
      tipo,
      status,
      filialId,
      search,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'GESTOR')
  create(@Body() dto: CreateAtivoDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @Roles('ADMIN', 'GESTOR')
  update(@Param('id') id: string, @Body() dto: UpdateAtivoDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'GESTOR')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusAtivoDto) {
    return this.service.updateStatus(id, dto.status);
  }

  @Delete(':id')
  @Roles('ADMIN', 'GESTOR')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  @Get(':id/softwares')
  listSoftwares(@Param('id') id: string) {
    return this.service.listSoftwares(id);
  }

  @Post(':id/softwares')
  @Roles('ADMIN', 'GESTOR')
  addSoftware(@Param('id') id: string, @Body() dto: AddAtivoSoftwareDto) {
    return this.service.addSoftware(id, dto);
  }

  @Delete(':id/softwares/:softwareId')
  @Roles('ADMIN', 'GESTOR')
  removeSoftware(@Param('id') id: string, @Param('softwareId') softwareId: string) {
    return this.service.removeSoftware(id, softwareId);
  }
}
