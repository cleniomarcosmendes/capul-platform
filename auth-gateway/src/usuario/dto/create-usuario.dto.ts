import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsEmail,
  IsBoolean,
  MinLength,
  Matches,
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

  // Workspace Multi-Departamento (C2.7 refino) — depto operacional do
  // perfil. Opcional pra retrocompat: se omitido, o service usa
  // resolveDepartamento (dto.departamentoId do user → JWT do caller →
  // fallback T.I.). Necessário pra multi-perfil real (mesmo user,
  // múltiplos perfis em deptos diferentes no mesmo módulo).
  @IsOptional()
  @IsUUID()
  departamentoId?: string;
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

  // Opcional: usuários que autenticam pelo portal RH (autenticaPortal) não têm
  // senha local — o service gera um hash inutilizável. As regras de força só
  // valem quando a senha é informada (@IsOptional pula quando ausente).
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Senha deve ter no minimo 8 caracteres' })
  @Matches(/(?=.*[a-z])/, { message: 'Senha deve conter pelo menos uma letra minuscula' })
  @Matches(/(?=.*[A-Z])/, { message: 'Senha deve conter pelo menos uma letra maiuscula' })
  @Matches(/(?=.*\d)/, { message: 'Senha deve conter pelo menos um numero' })
  senha?: string;

  // Matrícula RH (chapa) + login pelo portal (app do entregador).
  @IsOptional()
  @IsString()
  matricula?: string;

  @IsOptional()
  @IsBoolean()
  autenticaPortal?: boolean;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsString()
  cargo?: string;

  @IsOptional()
  @IsString()
  tipo?: 'INDIVIDUAL' | 'PADRAO';

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
  matricula?: string;

  @IsOptional()
  @IsBoolean()
  autenticaPortal?: boolean;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsString()
  cargo?: string;

  @IsOptional()
  @IsString()
  tipo?: 'INDIVIDUAL' | 'PADRAO';

  @IsOptional()
  @IsUUID()
  filialPrincipalId?: string;

  @IsOptional()
  @IsUUID()
  departamentoId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  filialIds?: string[];
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

  // Workspace Sub-fase 1.6.1 — UI multi-perfil envia depto operacional
  // do user nesse módulo. Se omitido: cascata cai no JWT do caller, depois
  // no fallback T.I.
  @IsOptional()
  @IsUUID()
  departamentoId?: string;
}
