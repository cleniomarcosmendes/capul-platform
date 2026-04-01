import {
  IsString, IsNotEmpty, IsEnum, IsOptional, MaxLength, IsUUID, IsBoolean,
} from 'class-validator';
import { CategoriaArtigo } from '@prisma/client';

export class CreateArtigoDto {
  @IsString() @IsNotEmpty() @MaxLength(300)
  titulo: string;

  @IsString() @IsNotEmpty() @MaxLength(50000)
  conteudo: string;

  @IsOptional() @IsString() @MaxLength(500)
  resumo?: string;

  @IsEnum(CategoriaArtigo)
  categoria: CategoriaArtigo;

  @IsOptional() @IsString() @MaxLength(500)
  tags?: string;

  @IsOptional() @IsUUID()
  softwareId?: string;

  @IsOptional() @IsUUID()
  equipeTiId?: string;

  @IsOptional() @IsBoolean()
  publica?: boolean;
}
