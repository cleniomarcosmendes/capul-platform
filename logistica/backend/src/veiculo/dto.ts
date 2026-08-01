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
import { FinalidadeVeiculo, PorteVeiculo, PropriedadeVeiculo, SituacaoVeiculo, TipoVeiculo } from '@prisma/client';

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
  @IsOptional() @IsEnum(PorteVeiculo) porte?: PorteVeiculo;
  @IsOptional() @IsEnum(FinalidadeVeiculo) finalidade?: FinalidadeVeiculo;
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

  // REPRESENTANTE responsável (coordenador OU supervisor de área) que fica com o
  // veículo para as visitas — por MATRÍCULA, validada contra a Equipe do RDV da
  // filial. Distinto do supervisorId (encarregado que gerencia o veículo). O NOME
  // não vem do cliente: é lido do cadastro da Equipe, para não divergir dele.
  @IsOptional() @IsString() @MaxLength(20) supervisorAreaMatricula?: string;
}

export class UpdateVeiculoDto {
  // Troca de filial (só gestor/admin; bloqueada se houver viagem em curso).
  @IsOptional() @IsString() @MaxLength(40) filialId?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(10) placa?: string;
  @IsOptional() @IsString() @MaxLength(20) renavam?: string;
  @IsOptional() @IsString() @MaxLength(30) chassi?: string;
  @IsOptional() @IsString() @MaxLength(60) modelo?: string;
  @IsOptional() @IsString() @MaxLength(40) marca?: string;
  @IsOptional() @IsInt() @Min(1900) ano?: number;
  @IsOptional() @IsString() @MaxLength(30) cor?: string;
  @IsOptional() @IsEnum(TipoVeiculo) tipo?: TipoVeiculo;
  @IsOptional() @IsEnum(PropriedadeVeiculo) propriedade?: PropriedadeVeiculo;
  @IsOptional() @IsEnum(PorteVeiculo) porte?: PorteVeiculo;
  @IsOptional() @IsEnum(FinalidadeVeiculo) finalidade?: FinalidadeVeiculo;
  @IsOptional() @IsInt() @Min(0) kmAtual?: number;
  @IsOptional() @IsString() @MaxLength(60) capacidadeCarga?: string;
  @IsOptional() @IsEnum(SituacaoVeiculo) situacao?: SituacaoVeiculo;
  @IsOptional() @IsInt() @Min(0) intervaloManutencaoKm?: number;
  @IsOptional() @IsInt() @Min(0) kmProximaManutencao?: number;
  @IsOptional() @IsString() @MaxLength(40) departamentoLotacaoId?: string;
  // Troca de supervisor → registra histórico.
  @IsOptional() @IsString() @MaxLength(40) supervisorId?: string;
  // Troca do REPRESENTANTE responsável (matrícula) → registra histórico próprio.
  // '' (string vazia) = remover o vínculo. Nome vem da Equipe, não do cliente.
  @IsOptional() @IsString() @MaxLength(20) supervisorAreaMatricula?: string;
  @IsOptional() @IsBoolean() ativo?: boolean;
}
