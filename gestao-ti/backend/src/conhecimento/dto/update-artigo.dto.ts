import {
  IsString, IsOptional, IsEnum, MaxLength, IsUUID,
} from 'class-validator';
import { CategoriaArtigo, StatusArtigo } from '@prisma/client';

export class UpdateArtigoDto {
  @IsOptional() @IsString() @MaxLength(300)
  titulo?: string;

  @IsOptional() @IsString()
  conteudo?: string;

  @IsOptional() @IsString() @MaxLength(500)
  resumo?: string;

  @IsOptional() @IsEnum(CategoriaArtigo)
  categoria?: CategoriaArtigo;

  @IsOptional() @IsString() @MaxLength(500)
  tags?: string;

  @IsOptional() @IsUUID()
  softwareId?: string;

  @IsOptional() @IsUUID()
  equipeTiId?: string;
}

export class UpdateStatusArtigoDto {
  @IsEnum(StatusArtigo)
  status: StatusArtigo;
}
