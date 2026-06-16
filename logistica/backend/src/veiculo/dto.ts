import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PropriedadeVeiculo, SituacaoVeiculo, TipoVeiculo } from '@prisma/client';

export class CreateVeiculoDto {
  @IsString() @MaxLength(40)
  filialId!: string;

  @IsString() @MinLength(1) @MaxLength(10)
  placa!: string;

  @IsOptional() @IsString() @MaxLength(20) renavam?: string;
  @IsOptional() @IsString() @MaxLength(30) chassi?: string;
  @IsOptional() @IsString() @MaxLength(60) modelo?: string;
  @IsOptional() @IsString() @MaxLength(40) marca?: string;
  @IsOptional() @IsInt() @Min(1900) ano?: number;
  @IsOptional() @IsString() @MaxLength(30) cor?: string;
  @IsOptional() @IsEnum(TipoVeiculo) tipo?: TipoVeiculo;
  @IsOptional() @IsEnum(PropriedadeVeiculo) propriedade?: PropriedadeVeiculo;
  @IsOptional() @IsInt() @Min(0) kmAtual?: number;
  @IsOptional() @IsString() @MaxLength(60) capacidadeCarga?: string;
  @IsOptional() @IsEnum(SituacaoVeiculo) situacao?: SituacaoVeiculo;

  // Manutenção preventiva por KM (opcional). Intervalo de revisão; a próxima é
  // calculada ao registrar manutenção (ou pode ser informada direto).
  @IsOptional() @IsInt() @Min(0) intervaloManutencaoKm?: number;
  @IsOptional() @IsInt() @Min(0) kmProximaManutencao?: number;

  // Lotação administrativa — obrigatórios (exigência Fase 2). Ids de core.
  @IsString() @MaxLength(40)
  departamentoLotacaoId!: string;

  @IsString() @MaxLength(40)
  supervisorId!: string;
}

export class UpdateVeiculoDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(10) placa?: string;
  @IsOptional() @IsString() @MaxLength(20) renavam?: string;
  @IsOptional() @IsString() @MaxLength(30) chassi?: string;
  @IsOptional() @IsString() @MaxLength(60) modelo?: string;
  @IsOptional() @IsString() @MaxLength(40) marca?: string;
  @IsOptional() @IsInt() @Min(1900) ano?: number;
  @IsOptional() @IsString() @MaxLength(30) cor?: string;
  @IsOptional() @IsEnum(TipoVeiculo) tipo?: TipoVeiculo;
  @IsOptional() @IsEnum(PropriedadeVeiculo) propriedade?: PropriedadeVeiculo;
  @IsOptional() @IsInt() @Min(0) kmAtual?: number;
  @IsOptional() @IsString() @MaxLength(60) capacidadeCarga?: string;
  @IsOptional() @IsEnum(SituacaoVeiculo) situacao?: SituacaoVeiculo;
  @IsOptional() @IsInt() @Min(0) intervaloManutencaoKm?: number;
  @IsOptional() @IsInt() @Min(0) kmProximaManutencao?: number;
  @IsOptional() @IsString() @MaxLength(40) departamentoLotacaoId?: string;
  // Troca de supervisor → registra histórico.
  @IsOptional() @IsString() @MaxLength(40) supervisorId?: string;
  @IsOptional() @IsBoolean() ativo?: boolean;
}
