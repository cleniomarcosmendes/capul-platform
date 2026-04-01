import { IsString, IsOptional, IsUUID, IsEnum, IsDateString, MaxLength } from 'class-validator';
import { StatusPendencia, PrioridadePendencia } from '@prisma/client';

export class UpdatePendenciaDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  titulo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descricao?: string;

  @IsOptional()
  @IsEnum(StatusPendencia)
  status?: StatusPendencia;

  @IsOptional()
  @IsEnum(PrioridadePendencia)
  prioridade?: PrioridadePendencia;

  @IsOptional()
  @IsUUID()
  faseId?: string;

  @IsOptional()
  @IsUUID()
  responsavelId?: string;

  @IsOptional()
  @IsDateString()
  dataLimite?: string;
}
