import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { StatusFase } from '@prisma/client';

export class CreateFaseDto {
  @IsString()
  nome: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsNumber()
  ordem: number;

  @IsOptional()
  @IsEnum(StatusFase)
  status?: StatusFase;

  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @IsOptional()
  @IsDateString()
  dataFimPrevista?: string;

  @IsOptional()
  @IsDateString()
  dataFimReal?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;
}
