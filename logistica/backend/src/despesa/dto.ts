import {
  IsArray, IsBoolean, IsDateString, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString,
  MaxLength, Min, ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

// ---- Tipos de despesa (cadastro, gestor de frota) ----
export class CriarTipoDespesaDto {
  @IsString() @IsNotEmpty() @MaxLength(60)
  nome!: string;

  @IsOptional() @IsString() @MaxLength(255)
  descricao?: string;

  // Default true (no service) — só Abastecimento e afins entram como false.
  @IsOptional() @IsBoolean()
  requerAprovacao?: boolean;
}

export class AtualizarTipoDespesaDto {
  @IsOptional() @IsString() @MaxLength(60)
  nome?: string;

  @IsOptional() @IsString() @MaxLength(255)
  descricao?: string;

  @IsOptional() @IsBoolean()
  requerAprovacao?: boolean;

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

  // Nota fiscal / documento. Vazio + semNota=true → lançamento sem nota.
  @IsOptional() @IsString() @MaxLength(60)
  numeroDocumento?: string;

  @IsOptional() @IsBoolean()
  semNota?: boolean;
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

  // Nota fiscal / documento (ex.: nota de débito da borracharia). Vazio +
  // semNota=true → sem nota.
  @IsOptional() @IsString() @MaxLength(60)
  numeroDocumento?: string;

  @IsOptional() @IsBoolean()
  semNota?: boolean;

  // Idempotência (fila offline): reenvio com a mesma chave não duplica.
  @IsOptional() @IsString() @MaxLength(60)
  idempotencyKey?: string;
}

export class ContestarDespesaDto {
  @IsString() @IsNotEmpty() @MaxLength(255)
  motivo!: string;
}

// ---- Anormalidade (mau uso) — só o gestor da frota marca/desmarca ----
export class MarcarAnormalidadeDto {
  @IsBoolean()
  anormalidade!: boolean;

  @IsOptional() @IsString() @MaxLength(255)
  motivo?: string;
}

// ---- Edição de uma despesa (gestor de frota / supervisor do veículo) ----
// Não altera o veículo (mantém o escopo de supervisão) nem a situação.
export class AtualizarDespesaDto {
  @IsOptional() @IsString()
  tipoDespesaId?: string;

  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  valor?: number;

  @IsOptional() @IsDateString()
  dataDespesa?: string;

  @IsOptional() @IsString()
  fornecedorId?: string; // vazio (string vazia) = limpa o vínculo

  @IsOptional() @IsString() @MaxLength(120)
  fornecedor?: string;

  @IsOptional() @IsString() @MaxLength(255)
  observacao?: string;

  // Nota fiscal / documento (string vazia = limpa). semNota alterna sem-nota.
  @IsOptional() @IsString() @MaxLength(60)
  numeroDocumento?: string;

  @IsOptional() @IsBoolean()
  semNota?: boolean;
}

// ---- Rateio de uma nota: 1 documento → vários TIPOS no mesmo veículo ----
// Cada item vira uma despesa (mesmo veículo/nota, tipo distinto). Lançamento
// direto do supervisor/gestor → cada linha já APROVADA.
export class RateioItemDto {
  @IsString() @IsNotEmpty()
  tipoDespesaId!: string;

  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  valor!: number;
}

export class RatearDespesaDto {
  @IsString() @IsNotEmpty()
  veiculoId!: string;

  @IsOptional() @IsString()
  viagemId?: string;

  // Rateio sempre tem nota (é o que está sendo dividido).
  @IsString() @IsNotEmpty() @MaxLength(60)
  numeroDocumento!: string;

  @IsOptional() @IsDateString()
  dataDespesa?: string;

  @IsOptional() @IsString()
  fornecedorId?: string;

  @IsOptional() @IsString() @MaxLength(120)
  fornecedor?: string;

  @IsOptional() @IsString() @MaxLength(255)
  observacao?: string;

  // Em multipart (com recibo) chega como string JSON — converte antes de validar.
  @Transform(({ value }) => (typeof value === 'string' ? JSON.parse(value) : value))
  @IsArray() @ValidateNested({ each: true }) @Type(() => RateioItemDto)
  itens!: RateioItemDto[];
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
