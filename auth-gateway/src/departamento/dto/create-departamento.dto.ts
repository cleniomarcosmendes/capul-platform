import { IsNotEmpty, IsOptional, IsString, IsUUID, IsIn } from 'class-validator';

export class CreateDepartamentoDto {
  @IsNotEmpty()
  @IsString()
  nome: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsNotEmpty()
  @IsUUID()
  filialId: string;
}

export class UpdateDepartamentoDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsIn(['ATIVO', 'INATIVO'])
  status?: 'ATIVO' | 'INATIVO';
}
