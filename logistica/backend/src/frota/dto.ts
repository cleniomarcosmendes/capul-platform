import { ArrayNotEmpty, IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TipoManutencao } from '@prisma/client';

// Parada PLANEJADA da rota (na saída e no planejar): local + cliente opcional. O cliente
// (SA1) faz a parada de ENTREGA alimentar a consolidação da localização do local (geo).
export class ParadaPlanejadaDto {
  @IsString() @IsNotEmpty() @MaxLength(120) local!: string;
  @IsOptional() @IsString() @MaxLength(20) clienteMatricula?: string;
  @IsOptional() @IsString() @MaxLength(120) clienteNome?: string;
  // Fazenda (zona rural): se preenchida, a entrega alimenta a geo da propriedade (mesmo
  // local do supervisor). Vazia = entrega urbana (endereço preciso, sem aprender).
  @IsOptional() @IsString() @MaxLength(120) propriedade?: string;
}

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

/**
 * Data/hora REAL da saída (ISO 8601). Opcional — sem ela vale o instante do
 * registro, que é o caso normal. Existe para o lançamento retroativo: quem saiu
 * às pressas sem registrar informa depois a hora de verdade, e o KM rodado deixa
 * de vir acompanhado de uma duração de minutos.
 *
 * NÃO precisa de migration nem de flag: `viagem.criadoEm` continua sendo o
 * carimbo imutável de QUANDO foi registrado. Retroativo = `dataHoraSaida`
 * anterior a `criadoEm`. As duas verdades ficam no banco, separadas.
 */
export class SaidaFrotaDto {
  @IsOptional() @IsDateString()
  dataHoraSaida?: string;

  // Adiantamento (opcional) já na SAÍDA — "para viajar, a 1ª coisa é o adiantamento".
  // Editável depois no detalhe da viagem (até o acerto encerrar).
  @IsOptional() @IsNumber() @Min(0)
  adiantamento?: number;

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

  // Vincula a saída a um planejamento RDV (viagem SUPERVISOR). Opcional; se vazio,
  // o backend tenta auto-vincular pelo RDV do mês do condutor (pela matrícula).
  @IsOptional() @IsString() @MaxLength(40)
  rdvViagemId?: string;

  // Rota planejada (opcional): locais das visitas — nascem como PLANEJADA.
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ParadaPlanejadaDto)
  paradasPlanejadas?: ParadaPlanejadaDto[];
}

/**
 * Saída registrada por usuário INDIVIDUAL (já autenticado) — NÃO pede matrícula
 * nem senha: o condutor é o próprio usuário logado (matrícula resolvida do core).
 */
export class SaidaIndividualDto {
  /**
   * Matrícula informada na hora — SÓ usada quando o usuário logado não tem
   * matrícula no cadastro (`core.usuarios.matricula`). SEM senha, de propósito:
   * o login INDIVIDUAL já autenticou a pessoa, e cobrar uma segunda senha (a do
   * portal RH) seria redundante. A senha existe para o login PADRAO, que é
   * compartilhado por colaboradores que não são usuários da plataforma.
   * Mesma regra do RETORNO individual (decisão 17/07, `a40a761`).
   */
  @IsOptional() @IsString() @MaxLength(20)
  matricula?: string;

  /** Data/hora REAL da saída — ver comentário em SaidaFrotaDto. */
  @IsOptional() @IsDateString()
  dataHoraSaida?: string;

  // Adiantamento (opcional) já na saída — editável depois no detalhe da viagem.
  @IsOptional() @IsNumber() @Min(0)
  adiantamento?: number;

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

  // Vincula a saída a um planejamento RDV (viagem SUPERVISOR). Opcional; se vazio,
  // o backend tenta auto-vincular pelo RDV do mês do condutor (pela matrícula).
  @IsOptional() @IsString() @MaxLength(40)
  rdvViagemId?: string;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ParadaPlanejadaDto)
  paradasPlanejadas?: ParadaPlanejadaDto[];
}

/**
 * Saída registrada pela PORTARIA (exceção) — usuário autorizado aponta a viagem
 * ao condutor escolhido na busca por nome, SEM a senha dele. matrícula+nome vêm
 * do resultado do infoPortal (não digitados livremente).
 */
export class SaidaPortariaDto {
  // Adiantamento (opcional) já na saída — editável depois no detalhe da viagem.
  @IsOptional() @IsNumber() @Min(0)
  adiantamento?: number;

  @IsString() @IsNotEmpty() @MaxLength(20)
  condutorMatricula!: string;

  @IsString() @IsNotEmpty() @MaxLength(120)
  condutorNome!: string;

  // Porteiro que registra (identifica-se por matrícula+senha — Protheus loginPortal).
  @IsString() @IsNotEmpty() @MaxLength(20)
  porteiroMatricula!: string;

  @IsString() @IsNotEmpty()
  porteiroSenha!: string;

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

  // Vincula a saída a um planejamento RDV (viagem SUPERVISOR). Opcional; se vazio,
  // o backend tenta auto-vincular pelo RDV do mês do condutor (pela matrícula).
  @IsOptional() @IsString() @MaxLength(40)
  rdvViagemId?: string;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ParadaPlanejadaDto)
  paradasPlanejadas?: ParadaPlanejadaDto[];
}

/** Retorno pela PORTARIA: encerra a rota com KM final SEM a senha do motorista; o
 *  porteiro identifica-se por matrícula+senha (accountability). */
export class RetornoPortariaDto {
  @IsInt() @Min(0)
  kmFinal!: number;

  @IsString() @IsNotEmpty() @MaxLength(20)
  porteiroMatricula!: string;

  @IsString() @IsNotEmpty()
  porteiroSenha!: string;

  @IsOptional() @IsString() @MaxLength(255)
  observacoes?: string;
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

  /** Data/hora REAL da chegada (ISO 8601). Opcional — sem ela vale o instante do
   *  registro. Simétrica à `dataHoraSaida`; o service exige que seja >= a saída. */
  @IsOptional() @IsDateString()
  dataHoraChegada?: string;

  @IsOptional() @IsString() @MaxLength(255)
  observacoes?: string;
}

/** Cancelamento de uma saída registrada errada (EM_CURSO → CANCELADA). */
export class CancelarSaidaDto {
  @IsString() @IsNotEmpty() @MaxLength(255)
  motivo!: string;
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

  // Geo Fase A: cliente (SA1) + FAZENDA (propriedade) + qualidade da marcação. SÓ entrega
  // na fazenda (zona rural) alimenta a geo — cidade tem endereço preciso (Google/Waze).
  // A fazenda é o MESMO local aprendido nas visitas do supervisor.
  @IsOptional() @IsString() @MaxLength(20) clienteMatricula?: string;
  @IsOptional() @IsString() @MaxLength(120) clienteNome?: string;
  @IsOptional() @IsString() @MaxLength(120) propriedade?: string;
  @IsOptional() @IsInt() @Min(0) precisaoM?: number;
  @IsOptional() @IsBoolean() noLocal?: boolean;
  @IsOptional() @IsString() @MaxLength(40) localClienteId?: string;

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
  @IsArray() @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => ParadaPlanejadaDto)
  paradas!: ParadaPlanejadaDto[];
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

  // Geo Fase A: cliente (SA1) + FAZENDA (propriedade) + qualidade da marcação. SÓ entrega
  // na fazenda alimenta a geo (cidade tem endereço preciso). Fazenda = mesmo local do supervisor.
  @IsOptional() @IsString() @MaxLength(20) clienteMatricula?: string;
  @IsOptional() @IsString() @MaxLength(120) clienteNome?: string;
  @IsOptional() @IsString() @MaxLength(120) propriedade?: string;
  @IsOptional() @IsInt() @Min(0) precisaoM?: number;
  @IsOptional() @IsBoolean() noLocal?: boolean;
  @IsOptional() @IsString() @MaxLength(40) localClienteId?: string;
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

  // Adiantamento (único) da viagem — base do "acerto" (despesas × adiantamento).
  @IsOptional() @IsNumber() @Min(0)
  adiantamento?: number;

  // true = fecha a viagem (CONCLUIDA) com o kmFinal informado.
  @IsOptional()
  concluir?: boolean;
}
