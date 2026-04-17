/**
 * Contratos da frente `cadastroFiscal` da Especificação API Protheus v2.0.
 * Ver: docs/ESPECIFICACAO_API_PROTHEUS_FISCAL_v2.0.md §3.3 e §4.
 */

export type TipoCadastroProtheus = 'SA1010' | 'SA2010';

export interface CadastroFiscalQuery {
  tipo: TipoCadastroProtheus;
  ativo?: boolean;
  filial?: string;
  desdeData?: string;          // ISO 8601 — alteração de cadastro
  comMovimentoDesde?: string;  // ISO 8601 — movimento fiscal/financeiro
  pagina?: number;
  porPagina?: number;
}

export interface CadastroFiscalEndereco {
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  municipio?: string | null;
  municipioIbge?: string | null;
  uf?: string | null;
  cep?: string | null;
}

export interface CadastroFiscalContato {
  telefone?: string | null;
  email?: string | null;
}

export interface CadastroFiscalRegistro {
  filial: string;
  codigo: string;
  loja: string;
  cnpj: string;
  tipoPessoa: 'F' | 'J';
  inscricaoEstadual?: string | null;
  inscricaoEstadualUF?: string | null;
  inscricaoMunicipal?: string | null;
  cnae?: string | null;
  razaoSocial: string;
  nomeFantasia?: string | null;
  endereco?: CadastroFiscalEndereco | null;
  contato?: CadastroFiscalContato | null;
  regimeTributario?: string | null;
  bloqueado: boolean;
  dataCadastro?: string | null;
  dataUltimaAlteracao: string;
  dataUltimoMovimento?: string | null;
}

export interface CadastroFiscalPaginacao {
  pagina: number;
  porPagina: number;
  totalRegistros: number;
  totalPaginas: number;
}

export interface CadastroFiscalListResponse {
  tipo: TipoCadastroProtheus;
  filial: string | null;
  ativo: boolean;
  desdeData?: string;
  comMovimentoDesde?: string;
  paginacao: CadastroFiscalPaginacao;
  geradoEm: string;
  registros: CadastroFiscalRegistro[];
}

export interface CadastroFiscalCnpjResponse {
  encontradoEm: TipoCadastroProtheus[];
  registros: Array<CadastroFiscalRegistro & { origem: TipoCadastroProtheus }>;
}
