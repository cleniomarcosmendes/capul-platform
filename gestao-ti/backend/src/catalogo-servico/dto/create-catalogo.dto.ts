import { IsString, IsNotEmpty, IsOptional, IsInt, Min, IsEnum, MaxLength } from 'class-validator';
import { Prioridade } from '@prisma/client';

export class CreateCatalogoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nome: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descricao?: string;

  @IsString()
  @IsNotEmpty()
  equipeId: string;

  @IsOptional()
  @IsEnum(Prioridade)
  prioridadePadrao?: Prioridade;

  @IsOptional()
  @IsInt()
  @Min(1)
  slaPadraoHoras?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  ordem?: number;
}
