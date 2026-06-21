import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * SAC Fase 3 — atualização da config OPERACIONAL do poller IMAP. Só toggles que
 * o admin gerencia pela tela; a CONEXÃO (host/usuário/senha) vem do ambiente.
 */
export class UpdateSacEmailConfigDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  pauseSync?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  mailboxFolder?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  pollIntervalMinutes?: number;
}
