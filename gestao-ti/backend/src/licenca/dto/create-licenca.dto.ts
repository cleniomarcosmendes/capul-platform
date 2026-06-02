import { IsString, IsNotEmpty, IsOptional, IsEnum, IsInt, IsNumber, Min, IsDateString, MaxLength, Matches } from 'class-validator';
import { ModeloLicenca } from '@prisma/client';

export class CreateLicencaDto {
  @IsOptional()
  @IsString()
  softwareId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  nome?: string;

  @IsOptional()
  @IsString()
  categoriaId?: string;

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

  // Chave da NF-e (44 dígitos) que originou a licença — vincula ao módulo
  // Fiscal (rastreabilidade + consulta da NF). Opcional. Pedido 02/06.
  @IsOptional()
  @IsString()
  @Matches(/^\d{44}$/, { message: 'Chave NF-e deve ter exatamente 44 dígitos numéricos' })
  chaveNfe?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  fornecedor?: string;

  // S11 (25/05) — FK p/ FornecedorConfig. Coexiste com `fornecedor` texto.
  @IsOptional()
  @IsString()
  fornecedorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacoes?: string;

  // Workspace Sub-fase 1.6.1 — UI multi-perfil envia depto explícito
  @IsOptional()
  @IsString()
  departamentoId?: string;
}
