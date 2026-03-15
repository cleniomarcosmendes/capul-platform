import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { HorarioService } from './horario.service.js';
import { UpsertHorarioDto } from './dto/horario.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard.js';

@Controller('horarios-trabalho')
@UseGuards(JwtAuthGuard, GestaoTiGuard)
export class HorarioController {
  constructor(private readonly service: HorarioService) {}

  @Get('default')
  getDefault() {
    return this.service.getDefault();
  }

  @Post('default')
  updateDefault(@Body() dto: UpsertHorarioDto) {
    return this.service.updateDefault(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':usuarioId')
  getByUsuario(@Param('usuarioId') usuarioId: string) {
    return this.service.getByUsuario(usuarioId);
  }

  @Post()
  upsert(@Body() dto: UpsertHorarioDto) {
    return this.service.upsertByUsuario(dto);
  }

  @Delete(':usuarioId')
  remove(@Param('usuarioId') usuarioId: string) {
    return this.service.remove(usuarioId);
  }
}
