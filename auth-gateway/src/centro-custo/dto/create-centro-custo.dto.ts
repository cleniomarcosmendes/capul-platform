import { IsNotEmpty, IsOptional, IsString, IsUUID, IsIn } from 'class-validator';

export class CreateCentroCustoDto {
  @IsNotEmpty()
  @IsString()
  codigo: string;

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

export class UpdateCentroCustoDto {
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
  @IsIn(['ATIVO', 'INATIVO'])
  status?: 'ATIVO' | 'INATIVO';
}
