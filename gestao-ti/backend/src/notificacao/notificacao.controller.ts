import {
  Controller, Get, Patch, Delete, Param, Query, UseGuards,
} from '@nestjs/common';
import { NotificacaoService } from './notificacao.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@Controller('notificacoes')
@UseGuards(JwtAuthGuard, GestaoTiGuard)
export class NotificacaoController {
  constructor(private readonly service: NotificacaoService) {}

  @Get()
  findAll(
    @CurrentUser('sub') userId: string,
    @Query('lida') lida?: string,
  ) {
    const lidaBool = lida === 'true' ? true : lida === 'false' ? false : undefined;
    return this.service.findAll(userId, lidaBool);
  }

  @Get('count')
  countNaoLidas(@CurrentUser('sub') userId: string) {
    return this.service.countNaoLidas(userId);
  }

  @Patch('ler-todas')
  marcarTodasLidas(@CurrentUser('sub') userId: string) {
    return this.service.marcarTodasLidas(userId);
  }

  @Patch(':id/lida')
  marcarLida(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.service.marcarLida(id, userId);
  }

  @Delete(':id')
  remover(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.service.remover(id, userId);
  }
}
