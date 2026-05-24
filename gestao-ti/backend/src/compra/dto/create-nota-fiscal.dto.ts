import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsDateString,
  IsArray,
  ValidateNested,
  IsInt,
  IsNumber,
  Min,
  IsIn,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class NotaFiscalItemDto {
  @IsString({ message: 'Produto obrigatorio' })
  @IsNotEmpty({ message: 'Produto obrigatorio' })
  produtoId: string;

  @IsInt({ message: 'Quantidade deve ser um numero inteiro' })
  @Min(1, { message: 'Quantidade minima e 1' })
  quantidade: number;

  @IsNumber({}, { message: 'Valor unitario obrigatorio' })
  @Min(0.01, { message: 'Valor unitario deve ser maior que zero' })
  valorUnitario: number;

  @IsString({ message: 'Centro de custo obrigatorio' })
  @IsNotEmpty({ message: 'Centro de custo obrigatorio' })
  centroCustoId: string;

  @IsOptional()
  @IsString()
  projetoId?: string;

  @IsOptional()
  @IsString()
  observacao?: string;
}

export class CreateNotaFiscalDto {
  @IsString({ message: 'Numero da NF obrigatorio' })
  @IsNotEmpty({ message: 'Numero da NF obrigatorio' })
  @MaxLength(20, { message: 'Numero da NF deve ter no maximo 20 caracteres' })
  numero: string;

  @IsDateString({}, { message: 'Data de lancamento invalida' })
  dataLancamento: string;

  @IsOptional()
  @IsDateString({}, { message: 'Data de vencimento invalida' })
  dataVencimento?: string;

  @IsString({ message: 'Fornecedor obrigatorio' })
  @IsNotEmpty({ message: 'Fornecedor obrigatorio' })
  fornecedorId: string;

  @IsOptional()
  @IsString()
  observacao?: string;

  @IsOptional()
  @IsString()
  equipeId?: string;

  /**
   * Chave da NF-e (44 dígitos). Opcional — quando informada, vincula a NF
   * Compras ao XML armazenado no módulo Fiscal (SZR/SZQ no Protheus). O
   * service chama `POST /api/v1/fiscal/nfe/consulta` para validar/baixar
   * antes de persistir. Validação mod-11 é feita no service (mais
   * informativa do que regex puro).
   */
  @IsOptional()
  @IsString()
  @Matches(/^\d{44}$/, { message: 'Chave NF-e deve ter exatamente 44 dígitos numéricos' })
  chaveNfe?: string;

  @IsArray({ message: 'Itens obrigatorios' })
  @ValidateNested({ each: true })
  @Type(() => NotaFiscalItemDto)
  itens: NotaFiscalItemDto[];

  // Workspace Sub-fase 1.6.1 — UI multi-perfil envia depto explícito
  @IsOptional()
  @IsString()
  departamentoId?: string;
}

export class UpdateNotaFiscalDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  numero?: string;

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
  observacao?: string;

  @IsOptional()
  @IsString()
  @IsIn(['REGISTRADA', 'CONFERIDA', 'CANCELADA'])
  status?: string;

  @IsOptional()
  @IsString()
  equipeId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NotaFiscalItemDto)
  itens?: NotaFiscalItemDto[];

  /**
   * Chave da NF-e (44 dígitos). null/string vazia para desvincular.
   * Service bloqueia alteração se status >= CONFERIDA e exige
   * `motivoAlteracaoChave` quando troca uma chave preexistente.
   */
  @IsOptional()
  @IsString()
  @Matches(/^\d{44}$/, { message: 'Chave NF-e deve ter exatamente 44 dígitos numéricos' })
  chaveNfe?: string | null;

  /**
   * Justificativa da troca de chave (obrigatória quando a NF já tinha uma
   * chave vinculada e o usuário está alterando). Vai pro audit log
   * NotaFiscalChaveHistorico.
   */
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Motivo deve ter no máximo 500 caracteres' })
  motivoAlteracaoChave?: string;

  // Workspace Onda 3 S2 (24/05) — permite TI realocar a NF pra outro depto
  // via UI <DepartamentoField> (alocação ≠ lançamento; lançamento é
  // imutável). Backend valida que departamentoId ∈ deptos_user em S10.
  @IsOptional()
  @IsString()
  departamentoId?: string;
}

/**
 * Body de POST /compras/notas-fiscais/validar-chave — preview de NF-e antes
 * de salvar/vincular. Devolve emitente, número, valor, lista de produtos
 * e status SEFAZ. Não persiste nada no Gestão TI; mas o Fiscal grava o XML
 * no Protheus (SZR/SZQ) como efeito colateral.
 */
export class ValidarChaveNfeDto {
  @IsString({ message: 'Chave obrigatória' })
  @Matches(/^\d{44}$/, { message: 'Chave NF-e deve ter exatamente 44 dígitos numéricos' })
  chave: string;
}
