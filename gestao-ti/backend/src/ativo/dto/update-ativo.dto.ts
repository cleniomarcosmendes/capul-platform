import {
  IsString, IsOptional, IsEnum, IsInt, IsDateString, MaxLength, IsUUID,
} from 'class-validator';
import { TipoAtivo, StatusAtivo } from '@prisma/client';

export class UpdateAtivoDto {
  @IsOptional() @IsString() @MaxLength(50)
  tag?: string;

  @IsOptional() @IsString() @MaxLength(200)
  nome?: string;

  @IsOptional() @IsString()
  descricao?: string;

  @IsOptional() @IsEnum(TipoAtivo)
  tipo?: TipoAtivo;

  @IsOptional() @IsString() @MaxLength(150)
  fabricante?: string;

  @IsOptional() @IsString() @MaxLength(150)
  modelo?: string;

  @IsOptional() @IsString() @MaxLength(100)
  numeroSerie?: string;

  @IsOptional() @IsUUID()
  filialId?: string;

  @IsOptional() @IsUUID()
  responsavelId?: string;

  @IsOptional() @IsUUID()
  departamentoId?: string;

  @IsOptional() @IsDateString()
  dataAquisicao?: string;

  @IsOptional() @IsDateString()
  dataGarantia?: string;

  @IsOptional() @IsString()
  processador?: string;

  @IsOptional() @IsInt()
  memoriaGB?: number;

  @IsOptional() @IsInt()
  discoGB?: number;

  @IsOptional() @IsString()
  sistemaOperacional?: string;

  @IsOptional() @IsString() @MaxLength(45)
  ip?: string;

  @IsOptional() @IsString() @MaxLength(100)
  hostname?: string;

  @IsOptional() @IsString()
  observacoes?: string;

  @IsOptional() @IsString()
  glpiId?: string;

  @IsOptional() @IsUUID()
  ativoPaiId?: string;
}

export class UpdateStatusAtivoDto {
  @IsEnum(StatusAtivo)
  status: StatusAtivo;
}
