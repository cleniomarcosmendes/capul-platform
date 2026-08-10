import { IsArray, IsIn, IsInt, IsLatitude, IsLongitude, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateViagemDto {
  @IsString() @MaxLength(40)
  filialId!: string;

  // Opcionais no RASCUNHO (12/06): a carga pode ser salva primeiro; veículo e
  // motorista entram depois — o DESPACHO é que exige os dois.
  @IsOptional() @IsString() @MaxLength(40)
  veiculoId?: string;

  @IsOptional() @IsString() @MaxLength(40)
  motoristaId?: string; // colaborador (core.usuarios) que vai conduzir

  // Entregas selecionadas, JÁ na ordem da rota (corte por capacidade = a
  // seleção; ordem = a ordem do array). Vira a lista de paradas.
  @IsOptional() @IsArray() @IsString({ each: true })
  entregaIds?: string[];
}

/**
 * Despacho da rota (DESKTOP). **Não pede KM** — e isso é regra, não esquecimento:
 * KM é leitura do PAINEL do veículo, e o despacho acontece no escritório, às vezes
 * com antecedência. Pedir hodômetro aqui só produz número inventado, e número
 * inventado em KM contamina custo por km e manutenção preventiva. O KM de saída é
 * apontado no APP, por quem está diante do veículo.
 *
 * O campo `kmInicial?` existia aqui e foi REMOVIDO em 09/08: ninguém o enviava, mas
 * era a porta por onde um KM podia entrar sem hodômetro na frente.
 */
export class DespacharViagemDto {
  @IsOptional() @IsString() @MaxLength(120) localSaida?: string;
  @IsOptional() @IsString() @MaxLength(255) observacoesSaida?: string;
}

/** Conclusão da rota — hodômetro de chegada OBRIGATÓRIO (fecha o KM rodado). */
export class ConcluirViagemDto {
  @IsInt() @Min(0) kmFinal!: number;
}

/**
 * Encerramento FORÇADO pelo gestor de entrega (rota pendurada — o entregador
 * esqueceu o retorno). Aqui o KM final é OBRIGATÓRIO (mantém o odômetro íntegro).
 * O gestor decide o destino das entregas ainda não baixadas — não se fabrica
 * "entregue": é um juízo dele (ENTREGUE se de fato saíram; NAO_ENTREGUE senão).
 */
export class ForcarEncerramentoDto {
  @IsInt() @Min(0) kmFinal!: number;
  @IsIn(['ENTREGUE', 'NAO_ENTREGUE']) marcarEntregasComo!: 'ENTREGUE' | 'NAO_ENTREGUE';
  @IsOptional() @IsString() @MaxLength(255) observacoes?: string;
}

/** "Iniciar entrega" no app: o motorista informa o KM de saída (no painel do
 *  veículo). Obrigatório — é o ponto de captura do hodômetro. */
export class IniciarViagemDto {
  @IsInt() @Min(0) kmInicial!: number;
}

/** Payload da sugestão de ordem de rota (Fase 1c). */
export class SugerirOrdemDto {
  @IsString() @MaxLength(40)
  filialId!: string;

  @IsArray() @IsString({ each: true })
  entregaIds!: string[];
}

/** Correção manual da coordenada de uma parada — operador arrastou o pin. */
export class CorrigirLocalDto {
  @IsString() @MaxLength(40)
  filialId!: string;

  @IsString() @MaxLength(40)
  entregaId!: string;

  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;
}

/** Desfaz a correção manual, devolvendo o endereço ao provedor de geocode. */
export class ReverterLocalDto {
  @IsString() @MaxLength(40)
  filialId!: string;

  @IsString() @MaxLength(40)
  entregaId!: string;
}

/** Edição do RASCUNHO: define/troca veículo e motorista (12/06). */
export class UpdateViagemDto {
  @IsOptional() @IsString() @MaxLength(40)
  veiculoId?: string;

  @IsOptional() @IsString() @MaxLength(40)
  motoristaId?: string;
}

/** Entregas a ADICIONAR ao fim da rota do rascunho (12/06). */
export class AdicionarEntregasDto {
  @IsArray() @IsString({ each: true })
  entregaIds!: string[];
}

/** Nova ordem completa das paradas do rascunho (12/06). */
export class ReordenarViagemDto {
  @IsArray() @IsString({ each: true })
  entregaIds!: string[];
}
