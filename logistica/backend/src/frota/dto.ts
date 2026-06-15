import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

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
}

export class RetornoFrotaDto {
  @IsString() @IsNotEmpty() @MaxLength(20)
  matricula!: string;

  @IsString() @IsNotEmpty()
  senha!: string;

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
