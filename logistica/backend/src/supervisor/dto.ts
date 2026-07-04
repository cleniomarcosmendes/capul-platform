import { IsBoolean, IsDateString, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

// ---- Workflow do planejamento (coordenador decide) ----
export class DecidirPlanejamentoDto {
  @IsIn(['APROVADO', 'AJUSTADO', 'REJEITADO'])
  decisao!: 'APROVADO' | 'AJUSTADO' | 'REJEITADO';
  @IsOptional() @IsString() @MaxLength(500) comentario?: string;
}

// ---- Adiantamento (mensal, vários) ----
export class LancarAdiantamentoDto {
  @IsString() @IsNotEmpty() @MaxLength(40) supervisorId!: string;
  @IsInt() @Min(200001) @Max(209912) mesReferencia!: number;
  @IsNumber() @Min(0.01) valor!: number;
  @IsOptional() @IsDateString() data?: string;
  @IsOptional() @IsString() @MaxLength(255) observacao?: string;
}

// ---- Cadastro de Supervisor de Área + vínculo com o coordenador (Fase 6a) ----
export class CriarSupervisorDto {
  @IsString() @IsNotEmpty() @MaxLength(20) matricula!: string;
  @IsString() @IsNotEmpty() @MaxLength(120) nome!: string;
  // Usuário do sistema (core.usuarios) que coordena este supervisor. Opcional.
  @IsOptional() @IsString() @MaxLength(40) coordenadorId?: string;
}
export class AtualizarSupervisorDto {
  @IsOptional() @IsString() @MaxLength(120) nome?: string;
  // '' = desvincular o coordenador; senão troca.
  @IsOptional() @IsString() @MaxLength(40) coordenadorId?: string;
  @IsOptional() @IsBoolean() ativo?: boolean;
}

// ---- Atividade de visita (catálogo) ----
export class CriarAtividadeDto {
  @IsString() @IsNotEmpty() @MaxLength(80) nome!: string;
}
export class AtualizarAtividadeDto {
  @IsOptional() @IsString() @MaxLength(80) nome?: string;
  @IsOptional() @IsBoolean() ativo?: boolean;
}

// ---- Viagem mensal do supervisor (container da RDV) ----
export class CriarViagemSupervisorDto {
  // Mês de referência no formato AAAAMM (ex.: 202605). Mês validado no service.
  @IsInt() @Min(200001) @Max(209912) mesReferencia!: number;
  @IsOptional() @IsNumber() @Min(0) adiantamento?: number;
  @IsOptional() @IsString() @MaxLength(40) veiculoId?: string;
  // Supervisor de área (funcionário Protheus) dono da viagem — identifica-se por
  // matrícula+senha (loginPortal). O nome é resolvido no Protheus (não confiar no client).
  @IsOptional() @IsString() @MaxLength(20) supervisorMatricula?: string;
  @IsOptional() @IsString() supervisorSenha?: string;
  @IsOptional() @IsString() @MaxLength(120) supervisorNome?: string;
}

// ---- Visita (parada) da viagem do supervisor ----
export class AdicionarVisitaDto {
  @IsOptional() @IsString() @MaxLength(40) atividadeId?: string;
  // Cliente/sócio Protheus (estruturado) ou prospect (só nome).
  @IsOptional() @IsString() @MaxLength(20) clienteMatricula?: string;
  @IsOptional() @IsString() @MaxLength(120) clienteNome?: string;
  @IsOptional() @IsString() @MaxLength(120) municipio?: string;
  @IsOptional() @IsString() @MaxLength(120) propriedade?: string;
  @IsOptional() @IsString() @MaxLength(200) local?: string;
  @IsOptional() @IsString() @MaxLength(500) observacao?: string;
  @IsOptional() @IsDateString() dataVisita?: string;
  // Fila offline do app: dedup no reenvio (chave única na parada).
  @IsOptional() @IsString() @MaxLength(64) idempotencyKey?: string;
}

// ---- Decisão do coordenador sobre a despesa (6d) ----
export class DecidirDespesaDto {
  @IsIn(['APROVADA', 'CONTESTADA'])
  decisao!: 'APROVADA' | 'CONTESTADA';
  @IsOptional() @IsString() @MaxLength(500) motivo?: string;
}

// ---- Apontamento da visita (6c): PLANEJADA → REALIZADA/PULADA ----
export class ApontarVisitaDto {
  @IsIn(['REALIZADA', 'PULADA'])
  status!: 'REALIZADA' | 'PULADA';
  @IsOptional() @IsString() @MaxLength(40) atividadeId?: string;
  @IsOptional() @IsString() @MaxLength(500) observacao?: string;
  @IsOptional() @IsDateString() dataVisita?: string;
}

// ---- Despesa da viagem do supervisor (compõe a RDV) ----
export class LancarDespesaSupervisorDto {
  @IsString() @IsNotEmpty() @MaxLength(40) tipoDespesaId!: string;
  @Type(() => Number) @IsNumber() @Min(0.01) valor!: number; // @Type: multipart manda string
  @IsOptional() @IsDateString() data?: string;
  @IsOptional() @IsString() @MaxLength(120) fornecedor?: string;
  @IsOptional() @IsString() @MaxLength(500) observacao?: string;
  // Fila offline do app: dedup no reenvio (chave única na despesa).
  @IsOptional() @IsString() @MaxLength(64) idempotencyKey?: string;
}

// ---- Administração (Fase 5): correções do gestor ----
export class EditarViagemSupervisorDto {
  @IsOptional() @IsNumber() @Min(0) adiantamento?: number;
}
export class EditarDespesaSupervisorDto {
  @IsOptional() @IsString() @MaxLength(40) tipoDespesaId?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.01) valor?: number; // @Type: multipart manda string
  @IsOptional() @IsDateString() data?: string;
  @IsOptional() @IsString() @MaxLength(120) fornecedor?: string;
  @IsOptional() @IsString() @MaxLength(500) observacao?: string;
}
// Edição de visita reusa o AdicionarVisitaDto (todos os campos já opcionais).
