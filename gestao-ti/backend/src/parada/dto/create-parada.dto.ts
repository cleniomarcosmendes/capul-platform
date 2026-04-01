import {
  IsString,
  IsEnum,
  IsDateString,
  IsOptional,
  IsArray,
  ArrayMinSize,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { TipoParada, ImpactoParada } from '@prisma/client';

export class CreateParadaDto {
  @IsString()
  @MaxLength(200)
  titulo: string;

  @IsEnum(TipoParada)
  tipo: TipoParada;

  @IsEnum(ImpactoParada)
  impacto: ImpactoParada;

  @IsDateString()
  inicio: string;

  @IsOptional()
  @IsDateString()
  fim?: string;

  @IsUUID()
  softwareId: string;

  @IsOptional()
  @IsUUID()
  softwareModuloId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  filialIds: string[];

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
