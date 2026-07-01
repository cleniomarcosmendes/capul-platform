import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// ---- Atividade de visita (catálogo) ----
export class CriarAtividadeDto {
  @IsString() @IsNotEmpty() @MaxLength(80) nome!: string;
}
export class AtualizarAtividadeDto {
  @IsOptional() @IsString() @MaxLength(80) nome?: string;
  @IsOptional() @IsBoolean() ativo?: boolean;
}

// ---- Região (N:N com município) ----
export class MunicipioDto {
  @IsString() @IsNotEmpty() @MaxLength(120) municipio!: string;
  @IsOptional() @IsString() @MaxLength(2) uf?: string;
}
export class CriarRegiaoDto {
  @IsString() @IsNotEmpty() @MaxLength(80) nome!: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MunicipioDto) municipios?: MunicipioDto[];
}
export class AtualizarRegiaoDto {
  @IsOptional() @IsString() @MaxLength(80) nome?: string;
  @IsOptional() @IsBoolean() ativo?: boolean;
  // Se vier, SUBSTITUI a lista de municípios da região (replace).
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MunicipioDto) municipios?: MunicipioDto[];
}

// ---- Viagem mensal do supervisor (container da RDV) ----
export class CriarViagemSupervisorDto {
  // Mês de referência no formato AAAAMM (ex.: 202605). Mês validado no service.
  @IsInt() @Min(200001) @Max(209912) mesReferencia!: number;
  @IsOptional() @IsString() @MaxLength(40) regiaoId?: string;
  @IsOptional() @IsNumber() @Min(0) adiantamento?: number;
  @IsOptional() @IsString() @MaxLength(40) veiculoId?: string;
  // Supervisor de área (funcionário Protheus) dono da viagem.
  @IsOptional() @IsString() @MaxLength(20) supervisorMatricula?: string;
  @IsOptional() @IsString() @MaxLength(120) supervisorNome?: string;
}
