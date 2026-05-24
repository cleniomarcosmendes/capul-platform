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
  @IsDateString()
  fim?: string;

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

  // Workspace Onda 3 S2 (24/05) — permite TI realocar a parada pra outro
  // depto via UI <DepartamentoField> (alocação ≠ lançamento; lançamento é
  // imutável). Backend valida que departamentoId ∈ deptos_user em S10.
  @IsOptional()
  @IsUUID()
  departamentoId?: string;
}
