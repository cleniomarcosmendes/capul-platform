import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { OrdemServicoService } from './ordem-servico.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { CreateOsDto } from './dto/create-os.dto.js';
import { UpdateOsDto } from './dto/update-os.dto.js';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';
import { StatusOS } from '@prisma/client';

@Controller('ordens-servico')
@UseGuards(JwtAuthGuard, GestaoTiGuard, RolesGuard)
export class OrdemServicoController {
  constructor(private readonly service: OrdemServicoService) {}

  @Get()
  findAll(@Query('status') status?: StatusOS, @Query('filialId') filialId?: string) {
    return this.service.findAll(status, filialId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO')
  create(@Body() dto: CreateOsDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO')
  update(@Param('id') id: string, @Body() dto: UpdateOsDto) {
    return this.service.update(id, dto);
  }
}
