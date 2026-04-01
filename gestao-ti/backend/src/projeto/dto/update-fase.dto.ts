import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { StatusFase } from '@prisma/client';

export class UpdateFaseDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descricao?: string;

  @IsOptional()
  @IsNumber()
  ordem?: number;

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
  @MaxLength(2000)
  observacoes?: string;
}
