import { IsString, IsNotEmpty, MaxLength, IsOptional, IsIn } from 'class-validator';

export class CreateProdutoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(15)
  codigo: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  descricao: string;

  @IsOptional()
  @IsString()
  tipoProdutoId?: string;
}

export class UpdateProdutoDto {
  @IsOptional()
  @IsString()
  @MaxLength(15)
  codigo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  descricao?: string;

  @IsOptional()
  @IsString()
  tipoProdutoId?: string;

  @IsOptional()
  @IsString()
  @IsIn(['ATIVO', 'INATIVO'])
  status?: string;
}
