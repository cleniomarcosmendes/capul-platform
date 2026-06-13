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

  // Obrigatório no cadastro (decisão 13/06) — habilita os agrupamentos por tipo
  // nos Indicadores. Produtos antigos sem tipo seguem como "Não classificado"
  // até serem editados (sem migration NOT NULL, que quebraria com os nulos atuais).
  @IsString()
  @IsNotEmpty({ message: 'Informe o tipo de produto.' })
  tipoProdutoId: string;
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
