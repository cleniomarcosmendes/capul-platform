import {
  IsString,
  IsEnum,
  IsDateString,
  IsOptional,
  IsUUID,
  IsNumber,
} from 'class-validator';
import { TipoProjeto, ModoProjeto } from '@prisma/client';

export class CreateProjetoDto {
  @IsString()
  nome: string;

  @IsEnum(TipoProjeto)
  tipo: TipoProjeto;

  @IsOptional()
  @IsEnum(ModoProjeto)
  modo?: ModoProjeto;

  @IsOptional()
  @IsUUID()
  projetoPaiId?: string;

  @IsOptional()
  @IsUUID()
  softwareId?: string;

  @IsOptional()
  @IsUUID()
  contratoId?: string;

  @IsUUID()
  responsavelId: string;

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
  @IsString()
  observacoes?: string;
}
