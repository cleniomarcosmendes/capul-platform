import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsDateString,
  IsInt,
  MaxLength,
  Min,
} from 'class-validator';
import { TipoContrato, StatusContrato } from '@prisma/client';

export class UpdateContratoDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  titulo?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsEnum(TipoContrato)
  tipo?: TipoContrato;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  fornecedor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(18)
  cnpjFornecedor?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valorTotal?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valorMensal?: number;

  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @IsOptional()
  @IsDateString()
  dataFim?: string;

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

export class UpdateStatusContratoDto {
  @IsEnum(StatusContrato, { message: 'Status invalido' })
  status: StatusContrato;
}
