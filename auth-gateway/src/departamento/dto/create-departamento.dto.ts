import { IsNotEmpty, IsOptional, IsString, IsUUID, IsIn } from 'class-validator';

export class CreateDepartamentoDto {
  @IsOptional()
  @IsString()
  codigo?: string;

  @IsNotEmpty()
  @IsString()
  nome: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsNotEmpty()
  @IsIn(['ADMINISTRATIVO', 'COMERCIAL', 'OPERACIONAL', 'TECNOLOGIA'])
  tipo: string;

  @IsNotEmpty()
  @IsUUID()
  filialId: string;
}

export class UpdateDepartamentoDto {
  @IsOptional()
  @IsString()
  codigo?: string;

  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsIn(['ADMINISTRATIVO', 'COMERCIAL', 'OPERACIONAL', 'TECNOLOGIA'])
  tipo?: string;

  @IsOptional()
  @IsIn(['ATIVO', 'INATIVO'])
  status?: 'ATIVO' | 'INATIVO';
}
