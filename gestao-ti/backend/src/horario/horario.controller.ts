import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { HorarioService } from './horario.service.js';
import { UpsertHorarioDto } from './dto/horario.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';

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
  findAll(@CurrentUser() user: JwtPayload) {
    return this.service.findAll(user);
  }

  @Get(':usuarioId')
  getByUsuario(
    @Param('usuarioId') usuarioId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.getByUsuario(usuarioId, user);
  }

  @Post()
  upsert(@Body() dto: UpsertHorarioDto, @CurrentUser() user: JwtPayload) {
    return this.service.upsertByUsuario(dto, user);
  }

  @Delete(':usuarioId')
  remove(
    @Param('usuarioId') usuarioId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.remove(usuarioId, user);
  }
}
