import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// ---- Atividade de visita (catálogo) ----
export class CriarAtividadeDto {
  @IsString() @IsNotEmpty() @MaxLength(80) nome!: string;
}
export class AtualizarAtividadeDto {
  @IsOptional() @IsString() @MaxLength(80) nome?: string;
  @IsOptional() @IsBoolean() ativo?: boolean;
}

// ---- Região (N:N com município) ----
export class MunicipioDto {
  @IsString() @IsNotEmpty() @MaxLength(120) municipio!: string;
  @IsOptional() @IsString() @MaxLength(2) uf?: string;
}
export class CriarRegiaoDto {
  @IsString() @IsNotEmpty() @MaxLength(80) nome!: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MunicipioDto) municipios?: MunicipioDto[];
}
export class AtualizarRegiaoDto {
  @IsOptional() @IsString() @MaxLength(80) nome?: string;
  @IsOptional() @IsBoolean() ativo?: boolean;
  // Se vier, SUBSTITUI a lista de municípios da região (replace).
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MunicipioDto) municipios?: MunicipioDto[];
}
