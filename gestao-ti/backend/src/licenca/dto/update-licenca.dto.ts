import { IsString, IsOptional, IsEnum, IsInt, IsNumber, Min, IsDateString } from 'class-validator';
import { ModeloLicenca } from '@prisma/client';

export class UpdateLicencaDto {
  @IsOptional()
  @IsEnum(ModeloLicenca)
  modeloLicenca?: ModeloLicenca;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantidade?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valorTotal?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valorUnitario?: number;

  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @IsOptional()
  @IsDateString()
  dataVencimento?: string;

  @IsOptional()
  @IsString()
  chaveSerial?: string;

  @IsOptional()
  @IsString()
  fornecedor?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;
}
