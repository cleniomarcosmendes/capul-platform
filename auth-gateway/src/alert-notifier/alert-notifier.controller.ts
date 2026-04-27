import { Body, Controller, Post } from '@nestjs/common';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { Public } from '../common/decorators/public.decorator';
import { AlertNotifierService } from './alert-notifier.service';
import type { AlertSeverity } from './alert-notifier.service';

class NotifyDto {
  @IsIn(['info', 'warn', 'error', 'critical'])
  severity!: AlertSeverity;

  @IsString()
  title!: string;

  @IsString()
  message!: string;

  @IsString()
  source!: string;

  @IsOptional()
  context?: Record<string, unknown>;
}

/**
 * Endpoint interno chamado por outros backends da plataforma (fiscal, gestao-ti,
 * inventario) pra disparar alerta sem precisar de credenciais SMTP/webhook.
 *
 * Acesso: rede docker interna apenas (Nginx nao expõe `/api/v1/internal/*`).
 * Marcado como @Public porque não há JWT entre serviços; controle é de rede.
 */
@Controller('api/v1/internal/alerts')
export class AlertNotifierInternalController {
  constructor(private readonly notifier: AlertNotifierService) {}

  @Post('notify')
  @Public()
  async notify(@Body() dto: NotifyDto) {
    return this.notifier.notify(dto);
  }
}
