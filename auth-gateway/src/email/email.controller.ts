import { Body, Controller, Post } from '@nestjs/common';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Public } from '../common/decorators/public.decorator';
import { EmailService } from './email.service';

class EmailAttachmentDto {
  @IsString()
  @MaxLength(255)
  filename!: string;

  // base64 de até ~15MB de arquivo (≈ 20M chars). Limita o payload por anexo.
  @IsString()
  @MaxLength(21_000_000)
  contentBase64!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  contentType?: string;
}

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

  @IsOptional()
  @IsEmail()
  from?: string;

  @IsOptional()
  @IsBoolean()
  sac?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => EmailAttachmentDto)
  attachments?: EmailAttachmentDto[];
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
