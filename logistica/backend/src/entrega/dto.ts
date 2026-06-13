import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { OrigemVenda, TipoClienteEntrega } from '@prisma/client';

export class CupomDto {
  @IsOptional() @IsString() @MaxLength(60)
  numeroCupom?: string;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  valor?: number;
}

export class CreateEntregaDto {
  @IsString() @MaxLength(40)
  filialId!: string; // filial consulente/operadora (contexto do operador) — UUID core.filiais

  @IsEnum(TipoClienteEntrega)
  tipoCliente!: TipoClienteEntrega;

  @IsOptional() @IsString() @MaxLength(30)
  matricula?: string; // IDENTIFICADO

  @IsOptional() @IsString()
  clienteLocalId?: string; // RECORRENTE_LOCAL

  @IsString() @MinLength(2) @MaxLength(120)
  destinatarioNome!: string;

  @IsOptional() @IsString() @MaxLength(20)
  telefone?: string;

  // Endereço: ou referencia um EnderecoEntrega (snapshot tirado dele —
  // autoritativo), ou informa os campos do snapshot direto (eventual/ad-hoc).
  @IsOptional() @IsString()
  enderecoEntregaId?: string;

  @IsOptional() @IsString() @MaxLength(150) endLogradouro?: string;
  @IsOptional() @IsString() @MaxLength(20) endNumero?: string;
  @IsOptional() @IsString() @MaxLength(80) endComplemento?: string;
  @IsOptional() @IsString() @MaxLength(80) endBairro?: string;
  @IsOptional() @IsString() @MaxLength(80) endCidade?: string;
  @IsOptional() @IsString() @MaxLength(2) endUf?: string;
  @IsOptional() @IsString() @MaxLength(9) endCep?: string;
  @IsOptional() @IsString() @MaxLength(150) endReferencia?: string;

  @IsOptional() @IsString() @MaxLength(60)
  horario?: string;

  @IsOptional() @IsString() @MaxLength(500)
  observacoes?: string;

  @IsInt() @Min(1) @Max(999)
  quantidadeVolumes!: number;

  // Como a venda foi feita (indicador de canal balcão × remoto). Obrigatório
  // nas novas entregas — sem default pra não enviesar o indicador.
  @IsEnum(OrigemVenda)
  origemVenda!: OrigemVenda;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CupomDto)
  cupons?: CupomDto[];
}

export class CancelarEntregaDto {
  @IsOptional() @IsString() @MaxLength(255)
  motivo?: string;
}

/**
 * Baixa de entrega no campo (Fase 1b). Chega via multipart/form-data quando há
 * prova (foto/assinatura) — por isso os números chegam como string e são
 * convertidos com @Type(() => Number).
 */
export class BaixarEntregaDto {
  // Resultado terminal da baixa. ENTREGUE espera prova; NAO_ENTREGUE exige
  // motivo. Enum explícito (string) — evita a ambiguidade de boolean em
  // multipart com enableImplicitConversion ('false' viraria true).
  @IsEnum(['ENTREGUE', 'NAO_ENTREGUE'])
  resultado!: 'ENTREGUE' | 'NAO_ENTREGUE';

  // Motivo obrigatório quando NÃO entregue (ausente/recusado/endereço errado…).
  @IsOptional() @IsString() @MaxLength(255)
  motivo?: string;

  // Tipo da prova quando há binário. Default FOTO.
  @IsOptional() @IsEnum(['FOTO', 'ASSINATURA'])
  tipoProva?: 'FOTO' | 'ASSINATURA';

  // Quem recebeu (nome de quem assinou/recebeu) — vai pra trilha do comprovante.
  @IsOptional() @IsString() @MaxLength(120)
  recebedorNome?: string;

  // GPS POR EVENTO capturado na baixa (graus decimais).
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90)
  geoLat?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180)
  geoLng?: number;

  // Chave de idempotência do app (reenvio offline não duplica a baixa).
  @IsOptional() @IsString() @MaxLength(80)
  idempotencyKey?: string;
}

/**
 * Edição de entrega no GRID (padrão workspace). Só PENDENTE e fora de viagem —
 * editar endereço de carga já montada mudaria a rota por baixo do operador.
 */
export class UpdateEntregaDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120)
  destinatarioNome?: string;

  @IsOptional() @IsString() @MaxLength(20)
  telefone?: string;

  @IsOptional() @IsString() @MaxLength(150) endLogradouro?: string;
  @IsOptional() @IsString() @MaxLength(20) endNumero?: string;
  @IsOptional() @IsString() @MaxLength(80) endComplemento?: string;
  @IsOptional() @IsString() @MaxLength(80) endBairro?: string;
  @IsOptional() @IsString() @MaxLength(80) endCidade?: string;
  @IsOptional() @IsString() @MaxLength(2) endUf?: string;
  @IsOptional() @IsString() @MaxLength(9) endCep?: string;
  @IsOptional() @IsString() @MaxLength(150) endReferencia?: string;

  @IsOptional() @IsString() @MaxLength(60)
  horario?: string;

  @IsOptional() @IsString() @MaxLength(500)
  observacoes?: string;

  @IsOptional() @IsInt() @Min(1) @Max(999)
  quantidadeVolumes?: number;

  @IsOptional() @IsEnum(OrigemVenda)
  origemVenda?: OrigemVenda;

  /** Substitui o conjunto de cupons (edição completa da lista). */
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CupomDto)
  cupons?: CupomDto[];
}
