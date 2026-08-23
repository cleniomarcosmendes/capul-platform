import { IsBoolean, IsDateString, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

// ---- Workflow do planejamento (coordenador decide) ----
export class DecidirPlanejamentoDto {
  @IsIn(['APROVADO', 'AJUSTADO', 'REJEITADO'])
  decisao!: 'APROVADO' | 'AJUSTADO' | 'REJEITADO';
  @IsOptional() @IsString() @MaxLength(500) comentario?: string;
}

/** Cancelamento por força maior (depois do aval). Motivo OBRIGATÓRIO: é o único
 *  rastro de por que a viagem aprovada não aconteceu. */
export class CancelarPlanejamentoDto {
  @IsString() @IsNotEmpty() @MaxLength(500) motivo!: string;
}

/** Devolver o planejamento aprovado/em execução para reconfiguração (volta a
 *  AJUSTADO). Comentário OBRIGATÓRIO — diz o que mudar. */
export class DevolverPlanejamentoDto {
  @IsString() @IsNotEmpty() @MaxLength(500) comentario!: string;
}

/**
 * Conclusão do planejamento. `confirmarPendentes` é o "sim, pode encerrar assim" para o
 * caso de haver visita ainda PLANEJADA — sem ele o backend recusa e diz quantas são.
 */
export class ConcluirPlanejamentoDto {
  @IsOptional() @IsBoolean() confirmarPendentes?: boolean;
}

// ---- Adiantamento (mensal, vários) ----
export class LancarAdiantamentoDto {
  @IsString() @IsNotEmpty() @MaxLength(40) supervisorId!: string;
  @IsInt() @Min(200001) @Max(209912) mesReferencia!: number;
  @IsNumber() @Min(0.01) valor!: number;
  @IsOptional() @IsDateString() data?: string;
  @IsOptional() @IsString() @MaxLength(255) observacao?: string;
}

// Decisão do coordenador sobre um adiantamento PENDENTE (auto-serviço do supervisor).
export class DecidirAdiantamentoDto {
  @IsIn(['APROVAR', 'REJEITAR'])
  decisao!: 'APROVAR' | 'REJEITAR';
  @IsOptional() @IsString() @MaxLength(500) motivo?: string;
}

// ---- Cadastro de Supervisor de Área + vínculo com o coordenador (Fase 6a) ----
export class CriarSupervisorDto {
  @IsString() @IsNotEmpty() @MaxLength(20) matricula!: string;
  @IsString() @IsNotEmpty() @MaxLength(120) nome!: string;
  // Departamento (core.departamento.id) a que este representante pertence — define o
  // escopo do Supervisor de Departamento. Opcional no contrato (ADMIN pode omitir);
  // o Supervisor de Departamento só grava um dos SEUS departamentos.
  @IsOptional() @IsString() @MaxLength(40) departamentoId?: string;
  // Usuário do sistema (core.usuarios) que coordena este supervisor. Opcional.
  @IsOptional() @IsString() @MaxLength(40) coordenadorId?: string;
}
export class AtualizarSupervisorDto {
  @IsOptional() @IsString() @MaxLength(120) nome?: string;
  // '' = tirar do departamento; senão troca (para um depto do próprio escopo).
  @IsOptional() @IsString() @MaxLength(40) departamentoId?: string;
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
  // Representante JÁ CADASTRADO no time (aba Equipe) — o gestor/Supervisor de
  // Departamento seleciona pelo NOME, sem senha (identidade vem do cadastro; a
  // autorização é o escopo do gestor + auditoria). Caminho preferido no desktop.
  @IsOptional() @IsString() @MaxLength(40) supervisorRegistroId?: string;
  // Legado/fallback: supervisor identificado por matrícula+senha (loginPortal). O
  // nome é resolvido no Protheus (não confiar no client). Mantido p/ retrocompat.
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
  // Geolocalização da visita (GPS do app, igual às paradas da frota).
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
  // Qualidade/consolidação (Fase A geo): precisão do GPS (m), confirmação de estar NO
  // local e o local do cliente que esta marcação ajuda a consolidar.
  @IsOptional() @IsInt() @Min(0) precisaoM?: number;
  @IsOptional() @IsBoolean() noLocal?: boolean;
  @IsOptional() @IsString() @MaxLength(40) localClienteId?: string;
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
  // Justificativa da visita PULADA (o app exige ao pular). Ignorada se REALIZADA.
  @IsOptional() @IsString() @MaxLength(500) motivoPulada?: string;
  @IsOptional() @IsDateString() dataVisita?: string;
  // GPS capturado no momento do apontamento em campo (REALIZADA).
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
  // Qualidade/consolidação (Fase A geo): precisão do GPS (m), confirmação de estar NO
  // local e o local do cliente que esta marcação ajuda a consolidar.
  @IsOptional() @IsInt() @Min(0) precisaoM?: number;
  @IsOptional() @IsBoolean() noLocal?: boolean;
  @IsOptional() @IsString() @MaxLength(40) localClienteId?: string;
}

// ---- Despesa da viagem do supervisor (compõe a RDV) ----
export class LancarDespesaSupervisorDto {
  @IsString() @IsNotEmpty() @MaxLength(40) tipoDespesaId!: string;
  @Type(() => Number) @IsNumber() @Min(0.01) valor!: number; // @Type: multipart manda string
  @IsOptional() @IsDateString() data?: string;
  @IsOptional() @IsString() @MaxLength(120) fornecedor?: string;
  @IsOptional() @IsString() @MaxLength(500) observacao?: string;
  // Veículo DESTA despesa (categoria VEÍCULO). Ausente = herda o do planejamento;
  // informado = a pessoa usou outro carro nesta viagem.
  @IsOptional() @IsString() @MaxLength(40) veiculoId?: string;
  // Fila offline do app: dedup no reenvio (chave única na despesa).
  @IsOptional() @IsString() @MaxLength(64) idempotencyKey?: string;
}

// ---- Administração (Fase 5): correções do gestor ----
export class EditarDespesaSupervisorDto {
  @IsOptional() @IsString() @MaxLength(40) tipoDespesaId?: string;
  // Corrige o carro de UMA despesa (o combustível foi no outro veículo).
  @IsOptional() @IsString() @MaxLength(40) veiculoId?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.01) valor?: number; // @Type: multipart manda string
  @IsOptional() @IsDateString() data?: string;
  @IsOptional() @IsString() @MaxLength(120) fornecedor?: string;
  @IsOptional() @IsString() @MaxLength(500) observacao?: string;
}
/** Troca o veículo do planejamento. '' (vazio) = remover o vínculo ("este mês vou
 *  de carro próprio"). Só vale daqui pra frente: despesa já lançada não é repontada. */
export class DefinirVeiculoPlanejamentoDto {
  @IsOptional() @IsString() @MaxLength(40) veiculoId?: string;
}
// Edição de visita reusa o AdicionarVisitaDto (todos os campos já opcionais).

/** Define quem responde por um departamento no RDV (aba Equipe). Só ADMIN escreve —
 *  ver `definirSupervisorDepartamento`. */
export class DefinirSupervisorDepartamentoDto {
  @IsString() @IsNotEmpty() @MaxLength(40) usuarioId!: string;
}
