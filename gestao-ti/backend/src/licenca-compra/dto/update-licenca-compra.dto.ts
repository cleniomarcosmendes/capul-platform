import { IsString, IsOptional, IsDateString, MaxLength, Matches, IsBoolean } from 'class-validator';

// Atualiza SÓ o cabeçalho (dados da nota). Edição de cada licença (item) segue
// pelo endpoint de licença existente; add/remove de itens é feito à parte.
export class UpdateLicencaCompraDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  numero?: string;

  @IsOptional()
  @IsBoolean()
  semNota?: boolean;

  @IsOptional()
  @IsDateString()
  dataLancamento?: string;

  @IsOptional()
  @IsDateString()
  dataVencimento?: string;

  @IsOptional()
  @IsString()
  fornecedorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  fornecedor?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{44}$/, { message: 'Chave NF-e deve ter exatamente 44 dígitos numéricos' })
  chaveNfe?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacao?: string;
}
