/**
 * Contratos da frente `cadastroFiscal` da API Protheus.
 *
 * Contrato v3 recebido em 23/04/2026 — renomeia todos os campos para formas
 * abreviadas (`inscIE`, `razSoc`, `municip` etc.). Os **valores** também foram
 * corrigidos na mesma rodada (antes vinham `inscricaoEstadual="MG"` e
 * `municipio="70404"` — era código IBGE, agora vêm valores reais).
 *
 * Histórico do contrato:
 *   - v1 (pré-17/04): inicial, com `endereco.numero`, `dataUltimaAlteracao`.
 *   - v2 (17/04): enxuga campos opcionais; mantém naming descritivo.
 *   - v3 (23/04): naming encurtado + bugs de troca de campo corrigidos.
 *
 * Mapeamento v2 → v3 (para quem lê commits antigos):
 *   encontradoEm → origens              inscricaoEstadual → inscIE
 *   registros    → itens                inscricaoEstadualUF → inscUF
 *   tipoPessoa   → pessoa               inscricaoMunicipal → inscIM
 *   razaoSocial  → razSoc               regimeTributario → regTrib
 *   nomeFantasia → fantasia             bloqueado → bloquead
 *   dataCadastro → dtCadast             dataUltimoMovimento → dtUltMov
 *   endereco.logradouro → logrado       endereco.municipio → municip
 *   endereco.complemento → complem      endereco.municipioIbge → munIBGE
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
  logrado?: string | null;
  complem?: string | null;
  bairro?: string | null;
  municip?: string | null;
  munIBGE?: string | null;
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
  pessoa: 'F' | 'J';
  inscIE?: string | null;
  inscUF?: string | null;
  inscIM?: string | null;
  cnae?: string | null;
  razSoc: string;
  fantasia?: string | null;
  endereco?: CadastroFiscalEndereco | null;
  contato?: CadastroFiscalContato | null;
  regTrib?: string | null;
  bloquead: boolean;
  dtCadast?: string | null;
  dtUltMov?: string | null;
}

export interface CadastroFiscalPaginacao {
  pagina: number;
  porPagina: number;
  totalRegistros: number;
  totalPaginas: number;
}

/**
 * Resposta do endpoint 1 — listagem paginada (`GET /cadastroFiscal?tipo=SA1010`).
 * Campo raiz `itens` (era `registros` no v2).
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
  itens: CadastroFiscalRegistro[];
}

/**
 * Resposta do endpoint 2 — consulta pontual (`GET /cadastroFiscal?cnpj=...`).
 * Campo raiz `itens` + `origens` (era `registros` + `encontradoEm` no v2).
 */
export interface CadastroFiscalCnpjResponse {
  cnpj?: string;
  origens: TipoCadastroProtheus[];
  itens: Array<CadastroFiscalRegistro & { origem: TipoCadastroProtheus }>;
}
