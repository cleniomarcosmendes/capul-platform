import {
  IsBoolean, IsDateString, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min,
} from 'class-validator';
import { Type } from 'class-transformer';

// ---- Tipos de despesa (cadastro, gestor de frota) ----
export class CriarTipoDespesaDto {
  @IsString() @IsNotEmpty() @MaxLength(60)
  nome!: string;

  @IsOptional() @IsString() @MaxLength(255)
  descricao?: string;
}

export class AtualizarTipoDespesaDto {
  @IsOptional() @IsString() @MaxLength(60)
  nome?: string;

  @IsOptional() @IsString() @MaxLength(255)
  descricao?: string;

  @IsOptional() @IsBoolean()
  ativo?: boolean;
}

// ---- Fornecedores da despesa (cadastro PRÓPRIO da logística) ----
export class CriarFornecedorDespesaDto {
  @IsString() @IsNotEmpty() @MaxLength(120)
  nome!: string;
}

export class AtualizarFornecedorDespesaDto {
  @IsOptional() @IsString() @MaxLength(120)
  nome?: string;

  @IsOptional() @IsBoolean()
  ativo?: boolean;
}

// ---- Lançamento direto (supervisor/gestor) → já APROVADA ----
export class LancarDespesaDto {
  @IsString() @IsNotEmpty()
  veiculoId!: string;

  @IsOptional() @IsString()
  viagemId?: string;

  @IsString() @IsNotEmpty()
  tipoDespesaId!: string;

  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  valor!: number;

  // ISO date (default: hoje, no service).
  @IsOptional() @IsDateString()
  dataDespesa?: string;

  @IsOptional() @IsString()
  fornecedorId?: string; // ref ao cadastro de fornecedores; vazio = texto livre/NÃO DEFINIDO

  @IsOptional() @IsString() @MaxLength(120)
  fornecedor?: string;

  @IsOptional() @IsString() @MaxLength(255)
  observacao?: string;
}

// ---- Lançamento na viagem em curso → PENDENTE ----
// A viagem já foi aberta pelo condutor autenticado (senha na saída); a despesa
// contextualizada herda o condutor da viagem — NÃO pede senha de novo.
export class LancarDespesaViagemDto {
  @IsString() @IsNotEmpty()
  viagemId!: string;

  @IsString() @IsNotEmpty()
  tipoDespesaId!: string;

  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  valor!: number;

  @IsOptional() @IsString()
  fornecedorId?: string; // ref ao cadastro de fornecedores; vazio = texto livre/NÃO DEFINIDO

  @IsOptional() @IsString() @MaxLength(120)
  fornecedor?: string;

  @IsOptional() @IsString() @MaxLength(255)
  observacao?: string;
}

export class ContestarDespesaDto {
  @IsString() @IsNotEmpty() @MaxLength(255)
  motivo!: string;
}

// Filtro de listagem (querystring).
export class ListarDespesasQuery {
  @IsOptional() @IsString()
  veiculoId?: string;

  @IsOptional() @IsString()
  situacao?: string;

  // Mês de referência (1-12) + ano — opcional, filtra por data_despesa.
  @IsOptional() @IsInt() @Min(1)
  mes?: number;

  @IsOptional() @IsInt()
  ano?: number;
}
