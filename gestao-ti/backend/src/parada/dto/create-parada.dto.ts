import {
  IsString,
  IsEnum,
  IsDateString,
  IsOptional,
  IsArray,
  ArrayMinSize,
  IsUUID,
} from 'class-validator';
import { TipoParada, ImpactoParada } from '@prisma/client';

export class CreateParadaDto {
  @IsString()
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
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;
}
