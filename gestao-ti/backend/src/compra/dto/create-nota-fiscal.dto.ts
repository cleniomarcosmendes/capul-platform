import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsDateString,
  IsArray,
  ValidateNested,
  IsInt,
  IsNumber,
  Min,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class NotaFiscalItemDto {
  @IsString({ message: 'Produto obrigatorio' })
  @IsNotEmpty({ message: 'Produto obrigatorio' })
  produtoId: string;

  @IsInt({ message: 'Quantidade deve ser um numero inteiro' })
  @Min(1, { message: 'Quantidade minima e 1' })
  quantidade: number;

  @IsNumber({}, { message: 'Valor unitario obrigatorio' })
  @Min(0.01, { message: 'Valor unitario deve ser maior que zero' })
  valorUnitario: number;

  @IsString({ message: 'Centro de custo obrigatorio' })
  @IsNotEmpty({ message: 'Centro de custo obrigatorio' })
  centroCustoId: string;

  @IsOptional()
  @IsString()
  projetoId?: string;

  @IsOptional()
  @IsString()
  observacao?: string;
}

export class CreateNotaFiscalDto {
  @IsString({ message: 'Numero da NF obrigatorio' })
  @IsNotEmpty({ message: 'Numero da NF obrigatorio' })
  @MaxLength(20, { message: 'Numero da NF deve ter no maximo 20 caracteres' })
  numero: string;

  @IsDateString({}, { message: 'Data de lancamento invalida' })
  dataLancamento: string;

  @IsOptional()
  @IsDateString({}, { message: 'Data de vencimento invalida' })
  dataVencimento?: string;

  @IsString({ message: 'Fornecedor obrigatorio' })
  @IsNotEmpty({ message: 'Fornecedor obrigatorio' })
  fornecedorId: string;

  @IsOptional()
  @IsString()
  observacao?: string;

  @IsOptional()
  @IsString()
  equipeId?: string;

  @IsArray({ message: 'Itens obrigatorios' })
  @ValidateNested({ each: true })
  @Type(() => NotaFiscalItemDto)
  itens: NotaFiscalItemDto[];
}

export class UpdateNotaFiscalDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  numero?: string;

  @IsOptional()
  @IsDateString()
  dataLancamento?: string;

  @IsOptional()
  @IsDateString()
  dataVencimento?: string;

  @IsOptional()
  @IsString()
  fornecedorId?: string;

  @IsOptional()
  @IsString()
  observacao?: string;

  @IsOptional()
  @IsString()
  @IsIn(['REGISTRADA', 'CONFERIDA', 'CANCELADA'])
  status?: string;

  @IsOptional()
  @IsString()
  equipeId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NotaFiscalItemDto)
  itens?: NotaFiscalItemDto[];
}
