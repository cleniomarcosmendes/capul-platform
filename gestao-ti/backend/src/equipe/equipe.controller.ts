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
import { CreateEquipeDto } from './dto/create-equipe.dto.js';
import { UpdateEquipeDto } from './dto/update-equipe.dto.js';
import { UpdateStatusDto } from './dto/update-status.dto.js';
import { AddMembroDto } from './dto/add-membro.dto.js';
import { UpdateMembroDto } from './dto/update-membro.dto.js';
import { StatusGeral } from '@prisma/client';

@Controller('equipes')
@UseGuards(JwtAuthGuard, GestaoTiGuard, RolesGuard)
export class EquipeController {
  constructor(private readonly equipeService: EquipeService) {}

  @Get()
  findAll(@Query('status') status?: StatusGeral) {
    return this.equipeService.findAll(status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.equipeService.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'GESTOR_TI')
  create(@Body() dto: CreateEquipeDto) {
    return this.equipeService.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'GESTOR_TI')
  update(@Param('id') id: string, @Body() dto: UpdateEquipeDto) {
    return this.equipeService.update(id, dto);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'GESTOR_TI')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.equipeService.updateStatus(id, dto.status);
  }

  // ---- Membros ----

  @Post(':id/membros')
  @Roles('ADMIN', 'GESTOR_TI')
  addMembro(@Param('id') id: string, @Body() dto: AddMembroDto) {
    return this.equipeService.addMembro(id, dto);
  }

  @Patch(':id/membros/:membroId')
  @Roles('ADMIN', 'GESTOR_TI')
  updateMembro(
    @Param('id') id: string,
    @Param('membroId') membroId: string,
    @Body() dto: UpdateMembroDto,
  ) {
    return this.equipeService.updateMembro(id, membroId, dto);
  }

  @Delete(':id/membros/:membroId')
  @Roles('ADMIN', 'GESTOR_TI')
  removeMembro(
    @Param('id') id: string,
    @Param('membroId') membroId: string,
  ) {
    return this.equipeService.removeMembro(id, membroId);
  }
}
