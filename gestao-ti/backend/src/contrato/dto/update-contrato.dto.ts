import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsDateString,
  IsInt,
  IsIn,
  MaxLength,
  Min,
} from 'class-validator';
import { StatusContrato } from '@prisma/client';

export class UpdateContratoDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  titulo?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsString()
  tipoContratoId?: string;

  @IsOptional()
  @IsString()
  filialId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  numeroContrato?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  fornecedor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  codigoFornecedor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  lojaFornecedor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(15)
  codigoProduto?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  descricaoProduto?: string;

  @IsOptional()
  @IsString()
  fornecedorId?: string;

  @IsOptional()
  @IsString()
  produtoId?: string;

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
  equipeId?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;

  @IsOptional()
  @IsString()
  @IsIn(['FIXO', 'VARIAVEL'])
  modalidadeValor?: string;
}

export class UpdateStatusContratoDto {
  @IsEnum(StatusContrato, { message: 'Status invalido' })
  status: StatusContrato;
}
