import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsDateString,
  IsInt,
  MaxLength,
  Min,
} from 'class-validator';
import { TipoContrato } from '@prisma/client';

export class CreateContratoDto {
  @IsString()
  @IsNotEmpty({ message: 'Titulo e obrigatorio' })
  @MaxLength(200)
  titulo: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsEnum(TipoContrato, { message: 'Tipo de contrato invalido' })
  tipo: TipoContrato;

  @IsString()
  @IsNotEmpty({ message: 'Fornecedor e obrigatorio' })
  @MaxLength(200)
  fornecedor: string;

  @IsOptional()
  @IsString()
  @MaxLength(18)
  cnpjFornecedor?: string;

  @IsNumber({}, { message: 'Valor total deve ser um numero' })
  @Min(0)
  valorTotal: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valorMensal?: number;

  @IsDateString({}, { message: 'Data de inicio invalida' })
  dataInicio: string;

  @IsDateString({}, { message: 'Data de fim invalida' })
  dataFim: string;

  @IsOptional()
  @IsDateString()
  dataAssinatura?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  indiceReajuste?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  percentualReajuste?: number;

  @IsOptional()
  @IsBoolean()
  renovacaoAutomatica?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  diasAlertaVencimento?: number;

  @IsOptional()
  @IsString()
  softwareId?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;
}
