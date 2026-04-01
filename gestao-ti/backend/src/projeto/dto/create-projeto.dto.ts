import {
  IsString,
  IsEnum,
  IsDateString,
  IsOptional,
  IsUUID,
  IsNumber,
  MaxLength,
} from 'class-validator';
import { TipoProjeto, ModoProjeto } from '@prisma/client';

export class CreateProjetoDto {
  @IsString()
  @MaxLength(200)
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
  @IsString()
  @MaxLength(2000)
  observacoes?: string;
}
