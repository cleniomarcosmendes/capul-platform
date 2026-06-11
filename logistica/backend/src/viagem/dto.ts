import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateViagemDto {
  @IsString() @MaxLength(40)
  filialId!: string;

  @IsString() @MaxLength(40)
  veiculoId!: string;

  @IsString() @MaxLength(40)
  motoristaId!: string; // colaborador (core.usuarios) que vai conduzir

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
