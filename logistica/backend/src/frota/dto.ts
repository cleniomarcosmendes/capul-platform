import { ArrayNotEmpty, IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { TipoManutencao } from '@prisma/client';

export class BuscarCondutorDto {
  @IsString() @IsNotEmpty() @MaxLength(20)
  matricula!: string;
}

// Validação matrícula+senha que SEMPRE responde 200 (mesmo padrão do Chamado
// PADRAO no workspace) — o resultado vai no corpo {valida, motivo}, nunca como
// 401 (que faria o interceptor deslogar p/ o Hub).
export class ValidarCondutorDto {
  @IsString() @IsNotEmpty() @MaxLength(20)
  matricula!: string;

  @IsString() @IsNotEmpty()
  senha!: string;
}

export class SaidaFrotaDto {
  @IsString() @IsNotEmpty() @MaxLength(20)
  matricula!: string;

  @IsString() @IsNotEmpty()
  senha!: string;

  @IsString() @IsNotEmpty()
  veiculoId!: string;

  @IsInt() @Min(0)
  kmInicial!: number;

  // Finalidade/destino da viagem (texto livre — vai em observacoesSaida).
  @IsOptional() @IsString() @MaxLength(255)
  finalidade?: string;

  @IsOptional() @IsString() @MaxLength(120)
  localSaida?: string;

  @IsOptional() @IsString() @MaxLength(40)
  departamentoSolicitanteId?: string;

  // Rota planejada (opcional): locais das visitas — nascem como PLANEJADA.
  @IsOptional() @IsArray() @IsString({ each: true })
  paradasPlanejadas?: string[];
}

/**
 * Saída registrada por usuário INDIVIDUAL (já autenticado) — NÃO pede matrícula
 * nem senha: o condutor é o próprio usuário logado (matrícula resolvida do core).
 */
export class SaidaIndividualDto {
  @IsString() @IsNotEmpty()
  veiculoId!: string;

  @IsInt() @Min(0)
  kmInicial!: number;

  @IsOptional() @IsString() @MaxLength(255)
  finalidade?: string;

  @IsOptional() @IsString() @MaxLength(120)
  localSaida?: string;

  @IsOptional() @IsString() @MaxLength(40)
  departamentoSolicitanteId?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  paradasPlanejadas?: string[];
}

/**
 * Saída registrada pela PORTARIA (exceção) — usuário autorizado aponta a viagem
 * ao condutor escolhido na busca por nome, SEM a senha dele. matrícula+nome vêm
 * do resultado do infoPortal (não digitados livremente).
 */
export class SaidaPortariaDto {
  @IsString() @IsNotEmpty() @MaxLength(20)
  condutorMatricula!: string;

  @IsString() @IsNotEmpty() @MaxLength(120)
  condutorNome!: string;

  @IsString() @IsNotEmpty()
  veiculoId!: string;

  @IsInt() @Min(0)
  kmInicial!: number;

  @IsOptional() @IsString() @MaxLength(255)
  finalidade?: string;

  @IsOptional() @IsString() @MaxLength(120)
  localSaida?: string;

  @IsOptional() @IsString() @MaxLength(40)
  departamentoSolicitanteId?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  paradasPlanejadas?: string[];
}

export class RetornoFrotaDto {
  // PADRÃO usa o token de condutor (header) → matrícula/senha ficam opcionais.
  // INDIVIDUAL/fallback ainda envia matrícula+senha (validado no service).
  @IsOptional() @IsString() @MaxLength(20)
  matricula?: string;

  @IsOptional() @IsString()
  senha?: string;

  @IsInt() @Min(0)
  kmFinal!: number;

  @IsOptional() @IsString() @MaxLength(255)
  observacoes?: string;
}

/** Registro de uma parada (ponto de rota) da viagem de frota — log do "caderno". */
export class AddParadaDto {
  @IsString() @IsNotEmpty() @MaxLength(120)
  local!: string;

  @IsOptional() @IsInt() @Min(0)
  km?: number;

  @IsOptional() @IsString() @MaxLength(255)
  observacao?: string;

  @IsOptional() @IsNumber()
  latitude?: number;

  @IsOptional() @IsNumber()
  longitude?: number;

  // Idempotência (fila offline): reenvio com a mesma chave não duplica.
  @IsOptional() @IsString() @MaxLength(60)
  idempotencyKey?: string;
}

/** Cadastro de local/ponto de parada (pick-list do planejamento). */
export class CriarLocalParadaDto {
  @IsString() @IsNotEmpty() @MaxLength(120)
  nome!: string;

  // Escopo (vazio = global). filialId vazio = todas as filiais. veiculoId e
  // departamentoId são mutuamente exclusivos (a UI garante).
  @IsOptional() @IsString() @MaxLength(40)
  filialId?: string;

  @IsOptional() @IsString() @MaxLength(40)
  departamentoId?: string;

  @IsOptional() @IsString() @MaxLength(40)
  veiculoId?: string;
}
export class AtualizarLocalParadaDto {
  @IsOptional() @IsString() @MaxLength(120)
  nome?: string;

  @IsOptional() @IsBoolean()
  ativo?: boolean;

  // Escopo — string vazia limpa (vira global/todas); undefined não toca.
  @IsOptional() @IsString() @MaxLength(40)
  filialId?: string;

  @IsOptional() @IsString() @MaxLength(40)
  departamentoId?: string;

  @IsOptional() @IsString() @MaxLength(40)
  veiculoId?: string;
}

/** Planejamento de paradas (visitas) — lista de locais (texto livre). */
export class PlanejarParadasDto {
  @IsArray() @ArrayNotEmpty() @IsString({ each: true })
  locais!: string[];
}

/** Check-in numa parada planejada → REALIZADA (KM + GPS opcional + obs). */
export class CheckinParadaDto {
  @IsOptional() @IsString() @MaxLength(120)
  local?: string;

  @IsOptional() @IsInt() @Min(0)
  km?: number;

  @IsOptional() @IsString() @MaxLength(255)
  observacao?: string;

  @IsOptional() @IsNumber()
  latitude?: number;

  @IsOptional() @IsNumber()
  longitude?: number;
}

/** Registrar manutenção feita — reseta o contador preventivo do veículo. */
export class RegistrarManutencaoDto {
  // KM do odômetro na manutenção (default: kmAtual do veículo).
  @IsOptional() @IsInt() @Min(0)
  km?: number;

  // Intervalo até a próxima (default: o intervalo cadastrado no veículo).
  @IsOptional() @IsInt() @Min(0)
  intervaloKm?: number;

  @IsOptional() @IsString() @MaxLength(255)
  observacao?: string;

  // PREVENTIVA (do ciclo por KM) ou CORRETIVA/excepcional. Default PREVENTIVA.
  @IsOptional() @IsEnum(TipoManutencao)
  tipo?: TipoManutencao;

  @IsOptional() @IsNumber() @Min(0)
  custo?: number;

  // Reinicia o ciclo preventivo (próxima = km + intervalo)? Se omitido, o service
  // usa true p/ PREVENTIVA e false p/ CORRETIVA.
  @IsOptional() @IsBoolean()
  reiniciarCiclo?: boolean;

  @IsOptional() @IsDateString()
  data?: string;
}

/** Ajuste/fechamento por GESTOR_FROTA ou supervisor do veículo (sem senha do condutor). */
export class AjusteGestorDto {
  @IsOptional() @IsInt() @Min(0)
  kmInicial?: number;

  @IsOptional() @IsInt() @Min(0)
  kmFinal?: number;

  @IsOptional() @IsString() @MaxLength(255)
  observacoesSaida?: string;

  @IsOptional() @IsString() @MaxLength(255)
  observacoesChegada?: string;

  // true = fecha a viagem (CONCLUIDA) com o kmFinal informado.
  @IsOptional()
  concluir?: boolean;
}
