import { IsOptional, IsString, IsNumber, IsBoolean, IsDateString, MaxLength, Min } from 'class-validator';

export class RenovarContratoDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  indiceReajuste?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  percentualReajuste?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  novoValorTotal?: number;

  @IsOptional()
  @IsDateString()
  novaDataInicio?: string;

  @IsOptional()
  @IsDateString()
  novaDataFim?: string;

  @IsOptional()
  @IsBoolean()
  gerarParcelas?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  quantidadeParcelas?: number;

  @IsOptional()
  @IsDateString()
  primeiroVencimento?: string;
}
