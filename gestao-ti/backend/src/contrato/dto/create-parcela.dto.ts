import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsInt,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateParcelaDto {
  @IsInt()
  @Min(1, { message: 'Numero da parcela deve ser >= 1' })
  numero: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  descricao?: string;

  @IsNumber({}, { message: 'Valor deve ser um numero' })
  @Min(0)
  valor: number;

  @IsDateString({}, { message: 'Data de vencimento invalida' })
  dataVencimento: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  notaFiscal?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacoes?: string;
}
