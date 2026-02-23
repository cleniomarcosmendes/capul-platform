import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { TipoAnexo } from '@prisma/client';

export class CreateAnexoDto {
  @IsString()
  @MaxLength(200)
  titulo: string;

  @IsString()
  url: string;

  @IsOptional()
  @IsEnum(TipoAnexo)
  tipo?: TipoAnexo;

  @IsOptional()
  @IsString()
  tamanho?: string;

  @IsOptional()
  @IsString()
  descricao?: string;
}
