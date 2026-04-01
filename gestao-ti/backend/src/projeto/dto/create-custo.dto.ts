import { IsString, IsOptional, IsNumber, IsDateString, IsEnum, Min, MaxLength } from 'class-validator';
import { CategoriaCusto } from '@prisma/client';

export class CreateCustoDto {
  @IsString()
  @MaxLength(5000)
  descricao: string;

  @IsEnum(CategoriaCusto)
  categoria: CategoriaCusto;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valorPrevisto?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valorRealizado?: number;

  @IsOptional()
  @IsDateString()
  data?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacoes?: string;
}
