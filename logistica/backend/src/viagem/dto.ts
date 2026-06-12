import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

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

export class DespacharViagemDto {
  @IsOptional() @IsString() @MaxLength(120) localSaida?: string;
  @IsOptional() @IsString() @MaxLength(255) observacoesSaida?: string;
}

/** Payload da sugestão de ordem de rota (Fase 1c). */
export class SugerirOrdemDto {
  @IsString() @MaxLength(40)
  filialId!: string;

  @IsArray() @IsString({ each: true })
  entregaIds!: string[];
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
