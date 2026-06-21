import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { SacTemplateService } from './sac-template.service.js';
import { CreateSacTemplateDto, UpdateSacTemplateDto } from './dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';

/**
 * SAC 4b — respostas prontas. Listagem dos ATIVOS liberada pra quem responde
 * SAC (inclui SUPORTE); a gestão (todos + mutações) é de admin/gestor.
 */
@Controller('sac-templates')
@UseGuards(JwtAuthGuard, GestaoTiGuard, RolesGuard)
export class SacTemplateController {
  constructor(private readonly service: SacTemplateService) {}

  // Consumido pelo seletor do card "Responder ao cliente" (atendentes).
  @Get()
  @Roles('ADMIN', 'GESTOR', 'SUPORTE')
  listarAtivos() {
    return this.service.listarAtivos();
  }

  @Get('todos')
  @Roles('ADMIN', 'GESTOR')
  listarTodos() {
    return this.service.listarTodos();
  }

  @Post()
  @Roles('ADMIN', 'GESTOR')
  criar(@Body() dto: CreateSacTemplateDto) {
    return this.service.criar(dto);
  }

  @Put(':id')
  @Roles('ADMIN', 'GESTOR')
  atualizar(@Param('id') id: string, @Body() dto: UpdateSacTemplateDto) {
    return this.service.atualizar(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'GESTOR')
  remover(@Param('id') id: string) {
    return this.service.remover(id);
  }
}
