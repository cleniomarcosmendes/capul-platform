import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsEmail,
  MinLength,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PermissaoDto {
  @IsNotEmpty()
  @IsUUID()
  moduloId: string;

  @IsNotEmpty()
  @IsUUID()
  roleModuloId: string;
}

export class CreateUsuarioDto {
  @IsNotEmpty()
  @IsString()
  username: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsNotEmpty()
  @IsString()
  nome: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  senha: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsString()
  cargo?: string;

  @IsOptional()
  @IsUUID()
  filialPrincipalId?: string;

  @IsNotEmpty()
  @IsUUID()
  departamentoId: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  filialIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissaoDto)
  permissoes?: PermissaoDto[];
}

export class UpdateUsuarioDto {
  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsString()
  cargo?: string;

  @IsOptional()
  @IsUUID()
  filialPrincipalId?: string;

  @IsOptional()
  @IsUUID()
  departamentoId?: string;
}

export class UpdateStatusDto {
  @IsNotEmpty()
  @IsString()
  status: 'ATIVO' | 'INATIVO';
}

export class AtribuirPermissaoDto {
  @IsNotEmpty()
  @IsUUID()
  moduloId: string;

  @IsNotEmpty()
  @IsUUID()
  roleModuloId: string;
}
