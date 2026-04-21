import { IsString, IsOptional, IsBoolean, IsEnum, IsArray, ValidateNested, IsInt, Min, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export enum AmbienteIntegracao {
  PRODUCAO = 'PRODUCAO',
  HOMOLOGACAO = 'HOMOLOGACAO',
}

export enum MetodoHttp {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
}

export enum TipoAuth {
  BASIC = 'BASIC',
  BEARER = 'BEARER',
  API_KEY = 'API_KEY',
  NONE = 'NONE',
}

export enum ModuloConsumidor {
  FISCAL = 'FISCAL',
  GESTAO_TI = 'GESTAO_TI',
  INVENTARIO = 'INVENTARIO',
}

// --- Endpoint DTOs ---

export class CreateEndpointDto {
  @IsEnum(ModuloConsumidor)
  modulo: ModuloConsumidor;

  @IsEnum(AmbienteIntegracao)
  ambiente: AmbienteIntegracao;

  @IsString()
  operacao: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsString()
  url: string;

  @IsEnum(MetodoHttp)
  metodo: MetodoHttp;

  @IsOptional()
  @IsInt()
  @Min(1000)
  timeoutMs?: number;

  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

export class UpdateEndpointDto {
  @IsOptional()
  @IsEnum(ModuloConsumidor)
  modulo?: ModuloConsumidor;

  @IsOptional()
  @IsEnum(AmbienteIntegracao)
  ambiente?: AmbienteIntegracao;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsEnum(MetodoHttp)
  metodo?: MetodoHttp;

  @IsOptional()
  @IsInt()
  @Min(1000)
  timeoutMs?: number;

  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

// --- Integracao DTOs ---

export class CreateIntegracaoDto {
  @IsString()
  codigo: string;

  @IsString()
  nome: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsEnum(AmbienteIntegracao)
  ambiente?: AmbienteIntegracao;

  @IsOptional()
  @IsEnum(TipoAuth)
  tipoAuth?: TipoAuth;

  @IsOptional()
  @IsString()
  authConfig?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateEndpointDto)
  endpoints?: CreateEndpointDto[];
}

export class UpdateIntegracaoDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  // NOTE: `ambiente` removido do DTO. A flag global foi substituida por
  // controle per-endpoint via ModuloConsumidor. Use
  // POST /integracoes/:id/modulos/:modulo/trocar-ambiente para troca em lote.

  @IsOptional()
  @IsEnum(TipoAuth)
  tipoAuth?: TipoAuth;

  @IsOptional()
  @IsString()
  authConfig?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

export class TrocarAmbienteModuloDto {
  @IsEnum(AmbienteIntegracao)
  ambiente: AmbienteIntegracao;
}

export class TestarEndpointDto {
  @IsString()
  url: string;

  @IsEnum(MetodoHttp)
  metodo: MetodoHttp;

  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @IsOptional()
  @IsString()
  authHeader?: string;

  @IsOptional()
  @IsInt()
  @Min(1000)
  timeoutMs?: number;
}
