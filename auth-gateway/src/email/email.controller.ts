import { Body, Controller, Post } from '@nestjs/common';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Public } from '../common/decorators/public.decorator';
import { EmailService } from './email.service';

class SendEmailDto {
  @IsArray()
  @ArrayMaxSize(50)
  @IsEmail({}, { each: true })
  to!: string[];

  @IsString()
  @MaxLength(200)
  subject!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200000)
  html?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  @ValidateIf((o) => !o.html)
  text?: string;

  @IsOptional()
  @IsEmail()
  replyTo?: string;
}

/**
 * Endpoint interno usado pelos demais backends (Gestão TI, Fiscal, etc) pra
 * disparar e-mail transacional sem precisar de credenciais SMTP duplicadas.
 *
 * Acesso: rede docker interna apenas — Nginx bloqueia `/api/v1/internal/*` (403).
 * Sem JWT entre serviços; controle é de rede (mesmo padrão do alert-notifier).
 */
@Controller('api/v1/internal/email')
export class EmailInternalController {
  constructor(private readonly emailService: EmailService) {}

  @Post('send')
  @Public()
  async send(@Body() dto: SendEmailDto) {
    return this.emailService.send(dto);
  }
}
