import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ConfiguradorAdminGuard } from './configurador-admin.guard';
import { PresencaService } from './presenca.service';

interface AuthUser {
  id: string;
  username: string;
}

/**
 * Endpoints relacionados a presenca de usuarios online e avisos da plataforma.
 *
 *  POST /auth/heartbeat              — chamado pelo frontend a cada 60s
 *                                      (qualquer usuario autenticado)
 *  GET  /auth/admin/usuarios-online  — lista usuarios online (CONFIGURADOR ADMIN)
 *  POST /auth/admin/aviso-plataforma — cria/atualiza aviso (CONFIGURADOR ADMIN)
 *  GET  /auth/admin/aviso-plataforma — le aviso atual (CONFIGURADOR ADMIN)
 *  DELETE /auth/admin/aviso-plataforma — limpa aviso (CONFIGURADOR ADMIN)
 */
@Controller('api/v1/auth')
export class PresencaController {
  constructor(private readonly presenca: PresencaService) {}

  /**
   * Heartbeat: marca usuario como online por 120s e devolve aviso ativo
   * (se houver) pra frontend exibir banner.
   */
  @Post('heartbeat')
  @UseGuards(JwtAuthGuard)
  async heartbeat(@CurrentUser() user: AuthUser) {
    return this.presenca.heartbeat(user.id);
  }

  @Get('admin/usuarios-online')
  @UseGuards(JwtAuthGuard, ConfiguradorAdminGuard)
  async listarOnline() {
    const usuarios = await this.presenca.listarOnline();
    return { total: usuarios.length, usuarios };
  }

  @Post('admin/aviso-plataforma')
  @UseGuards(JwtAuthGuard, ConfiguradorAdminGuard)
  async definirAviso(
    @Body() dto: { mensagem: string; ttlSegundos?: number },
  ) {
    return this.presenca.definirAviso(
      dto.mensagem,
      dto.ttlSegundos ?? 1800,
    );
  }

  @Get('admin/aviso-plataforma')
  @UseGuards(JwtAuthGuard, ConfiguradorAdminGuard)
  async lerAviso() {
    const aviso = await this.presenca.lerAviso();
    return { aviso };
  }

  @Delete('admin/aviso-plataforma')
  @UseGuards(JwtAuthGuard, ConfiguradorAdminGuard)
  async limparAviso() {
    await this.presenca.limparAviso();
    return { ok: true };
  }
}
