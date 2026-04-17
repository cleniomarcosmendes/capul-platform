import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AlertasService } from './alertas.service.js';
import { MailTransportService } from './mail-transport.service.js';
import { DestinatariosResolver } from './destinatarios.resolver.js';
import { DigestTemplate } from './templates/digest.template.js';

/**
 * Alertas consolidados (digest) — Onda 2 item 8 do addendum v1.5.
 *
 * Responsabilidades:
 *   - Resolver destinatários DINÂMICOS no momento do envio (via role
 *     GESTOR_FISCAL no schema core) — sem lista estática.
 *   - Enviar um único e-mail consolidado por execução de cruzamento
 *     (semanal-auto, diaria-auto, manual, bootstrap).
 *   - Fallback para FISCAL_FALLBACK_EMAIL quando zero gestores estão
 *     configurados.
 *   - Persistir trilha em fiscal.alerta_enviado.
 */
@Module({
  imports: [ConfigModule],
  providers: [AlertasService, MailTransportService, DestinatariosResolver, DigestTemplate],
  exports: [AlertasService, MailTransportService, DestinatariosResolver],
})
export class AlertasModule {}
