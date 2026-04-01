import { IsString, IsOptional, IsUUID, IsEnum, IsDateString, MaxLength } from 'class-validator';
import { PrioridadePendencia } from '@prisma/client';

export class CreatePendenciaDto {
  @IsString()
  @MaxLength(200)
  titulo: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descricao?: string;

  @IsOptional()
  @IsEnum(PrioridadePendencia)
  prioridade?: PrioridadePendencia;

  @IsOptional()
  @IsUUID()
  faseId?: string;

  @IsUUID()
  responsavelId: string;

  @IsOptional()
  @IsDateString()
  dataLimite?: string;
}
