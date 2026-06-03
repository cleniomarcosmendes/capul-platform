import {
  IsString, IsNotEmpty, IsOptional, IsEnum, IsInt, IsNumber, Min,
  IsDateString, MaxLength, Matches, IsArray, ValidateNested, IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ModeloLicenca } from '@prisma/client';

// Um ITEM da compra = uma licença.
export class LicencaItemDto {
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
  valorUnitario?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  chaveSerial?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacoes?: string;

  // Depto Licença Alocada — POR licença (livre, qualquer depto da empresa).
  @IsString()
  @IsNotEmpty({ message: 'Informe o Depto Licença Alocada do item' })
  departamentoId: string;
}

export class CreateLicencaCompraDto {
  // Número da NF. Ignorado quando semNota=true (vira "S/N").
  @IsOptional()
  @IsString()
  @MaxLength(20)
  numero?: string;

  // Registrada SEM nota fiscal → numero="S/N", chave/fornecedor opcionais.
  @IsOptional()
  @IsBoolean()
  semNota?: boolean;

  @IsDateString({}, { message: 'Data de lançamento inválida' })
  dataLancamento: string;

  @IsOptional()
  @IsDateString({}, { message: 'Data de vencimento inválida' })
  dataVencimento?: string;

  @IsOptional()
  @IsString()
  fornecedorId?: string;

  // Texto livre p/ fornecedor sem cadastro (denormalizado nas licenças).
  @IsOptional()
  @IsString()
  @MaxLength(200)
  fornecedor?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{44}$/, { message: 'Chave NF-e deve ter exatamente 44 dígitos numéricos' })
  chaveNfe?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacao?: string;

  @IsArray({ message: 'Adicione ao menos uma licença' })
  @ValidateNested({ each: true })
  @Type(() => LicencaItemDto)
  itens: LicencaItemDto[];
}
