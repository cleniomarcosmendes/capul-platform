/**
 * Contrato do POST `grvXML` — versao SIMPLIFICADA recebida em 08/05/2026.
 *
 * POST /rest/api/INFOCLIENTES/FISCAL/grvXML
 *   Content-Type: application/json
 *   Body: { itens: [{ xmlBase64 }] }
 *
 * O Protheus agora usa o XML como ÚNICA fonte da verdade — extrai todos
 * os campos (chave, emitente, itens, etc.) do conteudo do XML. Nao precisa
 * mais enviar o array `campos` (FILIAL, CHVNFE, ECNPJ, ELGR, CODFOR, ...).
 *
 * Permite envio em batch (multiplos itens). Cada item tem retorno individual
 * em `resultados[]` (ver GrvXmlResponse).
 *
 * Migration (08/05/2026):
 *   - Formato antigo (`alias` + `campos[]`) removido — pendencias §3.1, §3.2,
 *     §3.3, §3.10 ficam obsoletas (Protheus extrai do XML, sem CODFOR etc).
 *   - XmlParserToSzrSzqService nao eh mais necessario na montagem do body.
 *     Mantido apenas pra inspecao/debug e tipos GrvXmlExtracted.
 */

export interface GrvXmlItem {
  xmlBase64: string;
}

export interface GrvXmlBody {
  itens: GrvXmlItem[];
}

/**
 * Resposta do POST grvXML — formato batch (08/05/2026).
 *
 * Estrutura:
 *   - totalItens / totalSucesso / totalFalha: agregados do batch
 *   - resultados[]: 1 entrada por item enviado, ordenado pelo `indice`
 *
 * Casos:
 *   - sucesso=true, xmlGravado=true, preNotaFalhou=false
 *       → gravacao plena (XML em SZR010/SZQ010 + pre-nota criada)
 *   - sucesso=true, xmlGravado=true, preNotaFalhou=true
 *       → gravacao parcial: XML em SZR010/SZQ010 mas pre-nota
 *         (U_PRENF/U_NFeSaida) falhou — exige conclusao manual no Protheus.
 *         Mensagem aponta para arquivo `error_<chave>.log` no AppServer.
 *   - sucesso=false
 *       → falha completa, mensagem detalha a causa.
 *
 * Campo `pendenteAmarracao` indica que o XML foi gravado mas ainda nao
 * tem amarracao com pedido de compra (NFE de entrada sem pedido referenciado).
 */
export interface GrvXmlResultado {
  indice: number;
  chave: string;
  sucesso: boolean;
  xmlGravado: boolean;
  pendenteAmarracao: boolean;
  preNotaFalhou: boolean;
  mensagem: string;
}

export interface GrvXmlResponse {
  totalItens: number;
  totalSucesso: number;
  totalFalha: number;
  resultados: GrvXmlResultado[];
}

/**
 * Dados extraídos do XML — usado pelo XmlParserToSzrSzqService.extrair()
 * pra inspeção/debug. Migration 08/05/2026 não usa mais esses campos no
 * body grvXML (Protheus extrai do XML diretamente).
 */
export interface GrvXmlExtracted {
  tipoXml: 'NFe' | 'CTe';
  modelo: string;
  chave: string;
  serie: string;
  numeroNF: string;
  dataEmissao: string; // YYYYMMDD
  tipoNF: string; // '0' Entrada, '1' Saída
  emitente: {
    cnpj: string;
    nome: string;
    ie: string;
    logradouro: string;
    numero: string;
    bairro: string;
    codMunicipio: string;
    municipio: string;
    uf: string;
    cep: string;
    fone: string;
  };
  itens: Array<{
    numItem: string;
    cProd: string;
    cEAN: string;
    xProd: string;
    uCom: string;
    qCom: string;
    vUnCom: string;
    vProd: string;
    cfop: string;
  }>;
}
