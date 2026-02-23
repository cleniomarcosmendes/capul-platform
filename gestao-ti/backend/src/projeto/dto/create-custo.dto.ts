import { IsString, IsOptional, IsNumber, IsDateString, IsEnum, Min } from 'class-validator';
import { CategoriaCusto } from '@prisma/client';

export class CreateCustoDto {
  @IsString()
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
  observacoes?: string;
}
