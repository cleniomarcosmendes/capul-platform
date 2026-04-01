import { IsString, IsOptional, IsNumber, IsDateString, IsEnum, Min, MaxLength } from 'class-validator';
import { StatusCotacao } from '@prisma/client';

export class CreateCotacaoDto {
  @IsString()
  @MaxLength(200)
  fornecedor: string;

  @IsNumber()
  @Min(0)
  valor: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descricao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  moeda?: string;

  @IsOptional()
  @IsDateString()
  dataRecebimento?: string;

  @IsOptional()
  @IsDateString()
  validade?: string;

  @IsOptional()
  @IsEnum(StatusCotacao)
  status?: StatusCotacao;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacoes?: string;
}
