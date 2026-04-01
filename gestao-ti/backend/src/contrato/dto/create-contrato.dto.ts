import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsDateString,
  IsInt,
  IsIn,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateContratoDto {
  @IsString()
  @IsNotEmpty({ message: 'Titulo e obrigatorio' })
  @MaxLength(200)
  titulo: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descricao?: string;

  @IsString()
  @IsNotEmpty({ message: 'Tipo de contrato e obrigatorio' })
  tipoContratoId: string;

  @IsString()
  @IsNotEmpty({ message: 'Filial e obrigatoria' })
  filialId: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  numeroContrato?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  fornecedor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  codigoFornecedor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  lojaFornecedor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(15)
  codigoProduto?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  descricaoProduto?: string;

  @IsOptional()
  @IsString()
  fornecedorId?: string;

  @IsOptional()
  @IsString()
  produtoId?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Valor total deve ser um numero' })
  @Min(0)
  valorTotal?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valorMensal?: number;

  @IsDateString({}, { message: 'Data de inicio invalida' })
  dataInicio: string;

  @IsDateString({}, { message: 'Data de fim invalida' })
  dataFim: string;

  @IsOptional()
  @IsDateString()
  dataAssinatura?: string;

  @IsOptional()
  @IsBoolean()
  renovacaoAutomatica?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  diasAlertaVencimento?: number;

  @IsOptional()
  @IsString()
  softwareId?: string;

  @IsOptional()
  @IsString()
  equipeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacoes?: string;

  @IsOptional()
  @IsString()
  @IsIn(['FIXO', 'VARIAVEL'])
  modalidadeValor?: string;

  @IsOptional()
  @IsBoolean()
  gerarParcelas?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantidadeParcelas?: number;

  @IsOptional()
  @IsDateString()
  primeiroVencimento?: string;
}
