import { Controller, Delete, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DispositivoSessaoService } from './dispositivo-sessao.service';

/**
 * Gestão dos próprios dispositivos logados (app mobile). Self-service — o
 * usuário vê e revoga as próprias sessões. (Revogação por admin de TI fica
 * para um passo futuro, com decisão de quem pode revogar de terceiros.)
 */
@Controller('api/v1/core/dispositivos')
@UseGuards(JwtAuthGuard)
export class DispositivoSessaoController {
  constructor(private readonly sessoes: DispositivoSessaoService) {}

  @Get()
  meus(@CurrentUser('sub') usuarioId: string) {
    return this.sessoes.listarMeus(usuarioId);
  }

  // Rotas específicas ANTES da rota com :id (ordem importa no matching).
  @Delete('todas')
  revogarTodas(@CurrentUser('sub') usuarioId: string) {
    return this.sessoes.revogarTodasDoUsuario(usuarioId, usuarioId);
  }

  @Delete('device/:deviceId')
  revogarDevice(@Param('deviceId') deviceId: string, @CurrentUser('sub') usuarioId: string) {
    return this.sessoes.revogarDispositivo(deviceId, usuarioId, usuarioId);
  }

  @Delete(':id')
  revogar(@Param('id') id: string, @CurrentUser('sub') usuarioId: string) {
    return this.sessoes.revogarSessao(id, usuarioId, usuarioId);
  }
}
