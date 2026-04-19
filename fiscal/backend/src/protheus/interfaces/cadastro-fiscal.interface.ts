/**
 * Contratos da frente `cadastroFiscal` da API Protheus.
 *
 * Ajustado ao contrato recebido em 17/04/2026
 * (`API – Integração Protheus – Leitura de Cadastros Fiscais.md`):
 *   - `endereco.numero` removido (sem padronização em A1_END/A2_END)
 *   - `dataUltimaAlteracao` removido (não retornado)
 *   - `desdeData` removido dos filtros (apenas `comMovimentoDesde`)
 *   - `filial` no cadastro é opcional (SA1/SA2 compartilhadas entre filiais;
 *     `filial` só filtra a subquery de movimento em SF1/SF2/SE1/SE2)
 */

export type TipoCadastroProtheus = 'SA1010' | 'SA2010';

export interface CadastroFiscalQuery {
  tipo: TipoCadastroProtheus;
  ativo?: boolean;
  /** Opcional. Filtra apenas a subquery de movimento (SF1/SF2/SE1/SE2). Não filtra SA1/SA2. */
  filial?: string;
  /** YYYYMMDD — data de último movimento fiscal/financeiro. */
  comMovimentoDesde?: string;
  pagina?: number;
  porPagina?: number;
}

export interface CadastroFiscalEndereco {
  logradouro?: string | null;
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
  /** Opcional: Endpoint 1 (lista) não retorna; Endpoint 2 (por CNPJ) retorna. */
  filial?: string | null;
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
  dataUltimoMovimento?: string | null;
}

export interface CadastroFiscalPaginacao {
  pagina: number;
  porPagina: number;
  totalRegistros: number;
  totalPaginas: number;
}

/**
 * Resposta real observada em 18/04/2026 (homologação Protheus):
 * `{ tipo, pagina, porPagina, quantidade, registros }`.
 * Campos `paginacao`, `geradoEm`, `ativo`, `filial` do contrato v1 não são
 * retornados — ficam opcionais aqui para permitir evolução futura do contrato.
 */
export interface CadastroFiscalListResponse {
  tipo: TipoCadastroProtheus;
  pagina?: number;
  porPagina?: number;
  quantidade?: number;
  filial?: string | null;
  ativo?: boolean;
  comMovimentoDesde?: string;
  paginacao?: CadastroFiscalPaginacao;
  geradoEm?: string;
  registros: CadastroFiscalRegistro[];
}

export interface CadastroFiscalCnpjResponse {
  cnpj?: string;
  encontradoEm: TipoCadastroProtheus[];
  registros: Array<CadastroFiscalRegistro & { origem: TipoCadastroProtheus }>;
}
