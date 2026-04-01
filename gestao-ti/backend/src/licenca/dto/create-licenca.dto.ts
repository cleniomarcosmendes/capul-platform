import { IsString, IsNotEmpty, IsOptional, IsEnum, IsInt, IsNumber, Min, IsDateString, MaxLength } from 'class-validator';
import { ModeloLicenca } from '@prisma/client';

export class CreateLicencaDto {
  @IsString()
  @IsNotEmpty({ message: 'Software e obrigatorio' })
  softwareId: string;

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
  @MaxLength(200)
  chaveSerial?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  fornecedor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacoes?: string;
}
