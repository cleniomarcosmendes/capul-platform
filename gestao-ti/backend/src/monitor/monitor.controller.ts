import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { MonitorService } from './monitor.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@Controller('monitor')
@UseGuards(JwtAuthGuard, GestaoTiGuard)
export class MonitorController {
  constructor(private readonly monitorService: MonitorService) {}

  @Get('meus-itens')
  getMeusItens(@CurrentUser('sub') userId: string) {
    return this.monitorService.getMeusItens(userId);
  }

  @Post('encerrar-todos')
  encerrarTodos(@CurrentUser('sub') userId: string) {
    return this.monitorService.encerrarTodosTimers(userId);
  }

  @Post('iniciar-chamado/:chamadoId')
  iniciarChamado(
    @Param('chamadoId') chamadoId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.monitorService.iniciarTimerChamado(chamadoId, userId);
  }

  @Post('iniciar-atividade/:atividadeId')
  iniciarAtividade(
    @Param('atividadeId') atividadeId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.monitorService.iniciarTimerAtividade(atividadeId, userId);
  }
}
