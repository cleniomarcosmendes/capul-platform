import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { TipoAnexo } from '@prisma/client';

export class CreateAnexoDto {
  @IsString()
  @MaxLength(200)
  titulo: string;

  @IsString()
  @MaxLength(500)
  url: string;

  @IsOptional()
  @IsEnum(TipoAnexo)
  tipo?: TipoAnexo;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  tamanho?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descricao?: string;
}
