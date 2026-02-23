import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { StatusOS } from '@prisma/client';

export class UpdateOsDto {
  @IsOptional()
  @IsString()
  titulo?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsEnum(StatusOS)
  status?: StatusOS;

  @IsOptional()
  @IsDateString()
  dataAgendamento?: string;

  @IsOptional()
  @IsDateString()
  dataExecucao?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;
}
