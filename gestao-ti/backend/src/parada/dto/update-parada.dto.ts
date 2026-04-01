import {
  IsString,
  IsEnum,
  IsDateString,
  IsOptional,
  IsArray,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { TipoParada, ImpactoParada } from '@prisma/client';

export class UpdateParadaDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  titulo?: string;

  @IsOptional()
  @IsEnum(TipoParada)
  tipo?: TipoParada;

  @IsOptional()
  @IsEnum(ImpactoParada)
  impacto?: ImpactoParada;

  @IsOptional()
  @IsDateString()
  inicio?: string;

  @IsOptional()
  @IsUUID()
  softwareId?: string;

  @IsOptional()
  @IsUUID()
  softwareModuloId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  filialIds?: string[];

  @IsOptional()
  @IsUUID()
  motivoParadaId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descricao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacoes?: string;
}
