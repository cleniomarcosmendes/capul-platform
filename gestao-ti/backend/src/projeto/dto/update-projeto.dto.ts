import {
  IsString,
  IsEnum,
  IsDateString,
  IsOptional,
  IsUUID,
  IsNumber,
} from 'class-validator';
import { TipoProjeto, ModoProjeto, StatusProjeto } from '@prisma/client';

export class UpdateProjetoDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsEnum(TipoProjeto)
  tipo?: TipoProjeto;

  @IsOptional()
  @IsEnum(ModoProjeto)
  modo?: ModoProjeto;

  @IsOptional()
  @IsEnum(StatusProjeto)
  status?: StatusProjeto;

  @IsOptional()
  @IsUUID()
  softwareId?: string;

  @IsOptional()
  @IsUUID()
  contratoId?: string;

  @IsOptional()
  @IsUUID()
  responsavelId?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @IsOptional()
  @IsDateString()
  dataFimPrevista?: string;

  @IsOptional()
  @IsNumber()
  custoPrevisto?: number;

  @IsOptional()
  @IsNumber()
  custoRealizado?: number;

  @IsOptional()
  @IsString()
  observacoes?: string;
}
