import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { TipoClienteEntrega } from '@prisma/client';

export class CupomDto {
  @IsOptional() @IsString() @MaxLength(60)
  numeroCupom?: string;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  valor?: number;
}

export class CreateEntregaDto {
  @IsString() @MaxLength(40)
  filialId!: string; // filial consulente/operadora (contexto do operador) — UUID core.filiais

  @IsEnum(TipoClienteEntrega)
  tipoCliente!: TipoClienteEntrega;

  @IsOptional() @IsString() @MaxLength(30)
  matricula?: string; // IDENTIFICADO

  @IsOptional() @IsString()
  clienteLocalId?: string; // RECORRENTE_LOCAL

  @IsString() @MinLength(2) @MaxLength(120)
  destinatarioNome!: string;

  @IsOptional() @IsString() @MaxLength(20)
  telefone?: string;

  // Endereço: ou referencia um EnderecoEntrega (snapshot tirado dele —
  // autoritativo), ou informa os campos do snapshot direto (eventual/ad-hoc).
  @IsOptional() @IsString()
  enderecoEntregaId?: string;

  @IsOptional() @IsString() @MaxLength(150) endLogradouro?: string;
  @IsOptional() @IsString() @MaxLength(20) endNumero?: string;
  @IsOptional() @IsString() @MaxLength(80) endComplemento?: string;
  @IsOptional() @IsString() @MaxLength(80) endBairro?: string;
  @IsOptional() @IsString() @MaxLength(80) endCidade?: string;
  @IsOptional() @IsString() @MaxLength(2) endUf?: string;
  @IsOptional() @IsString() @MaxLength(9) endCep?: string;
  @IsOptional() @IsString() @MaxLength(150) endReferencia?: string;

  @IsOptional() @IsString() @MaxLength(60)
  horario?: string;

  @IsOptional() @IsString() @MaxLength(500)
  observacoes?: string;

  @IsInt() @Min(1)
  quantidadeVolumes!: number;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CupomDto)
  cupons?: CupomDto[];
}

export class CancelarEntregaDto {
  @IsOptional() @IsString() @MaxLength(255)
  motivo?: string;
}
