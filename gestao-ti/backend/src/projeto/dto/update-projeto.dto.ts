import {
  IsString,
  IsEnum,
  IsDateString,
  IsOptional,
  IsUUID,
  IsNumber,
  MaxLength,
} from 'class-validator';
import { TipoProjeto, ModoProjeto, StatusProjeto } from '@prisma/client';

export class UpdateProjetoDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
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
  @MaxLength(5000)
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
  @MaxLength(2000)
  observacoes?: string;

  @IsOptional()
  @IsUUID()
  tipoProjetoId?: string;
}
