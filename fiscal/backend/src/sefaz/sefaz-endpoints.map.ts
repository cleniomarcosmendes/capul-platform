/**
 * Mapa de endpoints dos web services SEFAZ consumidos pelo Módulo Fiscal.
 *
 * Pouco do que está aqui é "opinião" — os URLs são públicos e documentados
 * pela SEFAZ. Atualize conforme mudanças oficiais.
 *
 * Referências:
 *   - Portal NF-e: https://www.nfe.fazenda.gov.br/portal/webServices.aspx
 *   - Portal CT-e: https://www.cte.fazenda.gov.br/portal/webServices.aspx
 *   - SINIEF — consulta cadastro: cada SEFAZ estadual publica o seu.
 *
 * Os valores aqui são **referências conhecidas em 2026-04** — o dev deve
 * validar antes de ativar produção, porque a SEFAZ muda URLs sem aviso.
 */

export type AmbienteSefazStr = 'PRODUCAO' | 'HOMOLOGACAO';

/**
 * NFeDistribuicaoDFe — NACIONAL (SEFAZ-AN).
 * Único endpoint para todo o Brasil, responsável por entregar XMLs autorizados
 * aos participantes (emitente, destinatário, transportador, autor).
 */
export const NFE_DISTRIBUICAO_DFE: Record<AmbienteSefazStr, string> = {
  PRODUCAO: 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
  HOMOLOGACAO: 'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
};

/**
 * CTeDistribuicaoDFe — NACIONAL.
 * Análogo ao NFeDistribuicaoDFe, mas para CT-e (modelo 57).
 */
export const CTE_DISTRIBUICAO_DFE: Record<AmbienteSefazStr, string> = {
  PRODUCAO: 'https://www1.cte.fazenda.gov.br/CTeDistribuicaoDFe/CTeDistribuicaoDFe.asmx',
  HOMOLOGACAO: 'https://hom1.cte.fazenda.gov.br/CTeDistribuicaoDFe/CTeDistribuicaoDFe.asmx',
};

/**
 * NfeConsultaProtocolo 4 — per UF (cada autorizadora tem o seu).
 *
 * UFs com autorizador próprio: AM, BA, CE, GO, MG, MS, MT, PE, PR, RS, SP.
 * UFs que usam SVRS (SEFAZ Virtual RS): AC, AL, AP, DF, ES, PB, PI, RJ, RN, RO, RR, SC, SE, TO.
 * UFs que usam SVAN (SEFAZ Virtual AN): MA, PA.
 *
 * Source: https://www.nfe.fazenda.gov.br/portal/webServices.aspx (bloco "NF-e 4.00")
 *
 * URLs compiladas a partir das publicações oficiais em 2024–2026. Verifique
 * quando for ativar em produção — a SEFAZ muda URLs esporadicamente sem aviso.
 */
const SVRS_NFE: Record<AmbienteSefazStr, string> = {
  PRODUCAO: 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
  HOMOLOGACAO: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
};

const SVAN_NFE: Record<AmbienteSefazStr, string> = {
  PRODUCAO:
    'https://www.sefazvirtual.fazenda.gov.br/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx',
  HOMOLOGACAO:
    'https://hom.sefazvirtual.fazenda.gov.br/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx',
};

export const NFE_CONSULTA_PROTOCOLO: Partial<Record<string, Record<AmbienteSefazStr, string>>> = {
  AC: SVRS_NFE,
  AL: SVRS_NFE,
  AM: {
    PRODUCAO: 'https://nfe.sefaz.am.gov.br/services2/services/NfeConsulta4',
    HOMOLOGACAO: 'https://homnfe.sefaz.am.gov.br/services2/services/NfeConsulta4',
  },
  AP: SVRS_NFE,
  BA: {
    PRODUCAO:
      'https://nfe.sefaz.ba.gov.br/webservices/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx',
    HOMOLOGACAO:
      'https://hnfe.sefaz.ba.gov.br/webservices/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx',
  },
  CE: {
    PRODUCAO: 'https://nfe.sefaz.ce.gov.br/nfe4/services/NFeConsultaProtocolo4',
    HOMOLOGACAO: 'https://nfeh.sefaz.ce.gov.br/nfe4/services/NFeConsultaProtocolo4',
  },
  DF: SVRS_NFE,
  ES: SVRS_NFE,
  GO: {
    PRODUCAO: 'https://nfe.sefaz.go.gov.br/nfe/services/NFeConsultaProtocolo4',
    HOMOLOGACAO: 'https://homolog.sefaz.go.gov.br/nfe/services/NFeConsultaProtocolo4',
  },
  MA: SVAN_NFE,
  MG: {
    PRODUCAO: 'https://nfe.fazenda.mg.gov.br/nfe2/services/NFeConsultaProtocolo4',
    HOMOLOGACAO: 'https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeConsultaProtocolo4',
  },
  MS: {
    PRODUCAO: 'https://nfe.fazenda.ms.gov.br/ws/NFeConsultaProtocolo4',
    HOMOLOGACAO: 'https://hom.nfe.fazenda.ms.gov.br/ws/NFeConsultaProtocolo4',
  },
  MT: {
    PRODUCAO: 'https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeConsulta4',
    HOMOLOGACAO: 'https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeConsulta4',
  },
  PA: SVAN_NFE,
  PB: SVRS_NFE,
  PE: {
    PRODUCAO: 'https://nfe.sefaz.pe.gov.br/nfe-service/services/NFeConsultaProtocolo4',
    HOMOLOGACAO: 'https://nfehomolog.sefaz.pe.gov.br/nfe-service/services/NFeConsultaProtocolo4',
  },
  PI: SVRS_NFE,
  PR: {
    PRODUCAO: 'https://nfe.sefa.pr.gov.br/nfe/NFeConsultaProtocolo4',
    HOMOLOGACAO: 'https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeConsultaProtocolo4',
  },
  RJ: SVRS_NFE,
  RN: SVRS_NFE,
  RO: SVRS_NFE,
  RR: SVRS_NFE,
  RS: {
    PRODUCAO: 'https://nfe.sefazrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    HOMOLOGACAO: 'https://nfe-homologacao.sefazrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
  },
  SC: SVRS_NFE,
  SE: SVRS_NFE,
  SP: {
    PRODUCAO: 'https://nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx',
    HOMOLOGACAO: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx',
  },
  TO: SVRS_NFE,
};

/**
 * CadConsultaCadastro 4 — per UF (Etapa 10 da Onda 1).
 *
 * UFs com serviço próprio: BA, GO, MG, MS, MT, PE, PR, RS, SP, SVRS (fallback).
 * UFs sem serviço próprio caem no SVRS (SEFAZ Virtual RS).
 *
 * Source: https://dfe-portal.svrs.rs.gov.br/Ccc — lista oficial.
 */
const SVRS_CCC: Record<AmbienteSefazStr, string> = {
  PRODUCAO: 'https://cad.svrs.rs.gov.br/ws/cadconsultacadastro/cadconsultacadastro4.asmx',
  HOMOLOGACAO:
    'https://cad-homologacao.svrs.rs.gov.br/ws/cadconsultacadastro/cadconsultacadastro4.asmx',
};

export const CCC_CAD_CONSULTA_CADASTRO: Partial<
  Record<string, Record<AmbienteSefazStr, string>>
> = {
  // SVRS é o fallback explícito (usado quando a UF não tem entrada própria)
  SVRS: SVRS_CCC,

  // UFs atendidas pelo SVRS
  AC: SVRS_CCC,
  AL: SVRS_CCC,
  AM: SVRS_CCC,
  AP: SVRS_CCC,
  CE: SVRS_CCC,
  DF: SVRS_CCC,
  ES: SVRS_CCC,
  MA: SVRS_CCC,
  PA: SVRS_CCC,
  PB: SVRS_CCC,
  PI: SVRS_CCC,
  RJ: SVRS_CCC,
  RN: SVRS_CCC,
  RO: SVRS_CCC,
  RR: SVRS_CCC,
  SC: SVRS_CCC,
  SE: SVRS_CCC,
  TO: SVRS_CCC,

  // UFs com CCC próprio
  BA: {
    PRODUCAO: 'https://nfe.sefaz.ba.gov.br/webservices/CadConsultaCadastro4/CadConsultaCadastro4.asmx',
    HOMOLOGACAO:
      'https://hnfe.sefaz.ba.gov.br/webservices/CadConsultaCadastro4/CadConsultaCadastro4.asmx',
  },
  GO: {
    PRODUCAO: 'https://nfe.sefaz.go.gov.br/nfe/services/CadConsultaCadastro4',
    HOMOLOGACAO: 'https://homolog.sefaz.go.gov.br/nfe/services/CadConsultaCadastro4',
  },
  MG: {
    PRODUCAO: 'https://nfe.fazenda.mg.gov.br/nfe2/services/CadConsultaCadastro4',
    HOMOLOGACAO: 'https://hnfe.fazenda.mg.gov.br/nfe2/services/CadConsultaCadastro4',
  },
  MS: {
    PRODUCAO: 'https://nfe.fazenda.ms.gov.br/ws/CadConsultaCadastro4',
    HOMOLOGACAO: 'https://hom.nfe.fazenda.ms.gov.br/ws/CadConsultaCadastro4',
  },
  MT: {
    PRODUCAO: 'https://nfe.sefaz.mt.gov.br/nfews/v2/services/CadConsultaCadastro4',
    HOMOLOGACAO: 'https://homologacao.sefaz.mt.gov.br/nfews/v2/services/CadConsultaCadastro4',
  },
  PE: {
    PRODUCAO: 'https://nfe.sefaz.pe.gov.br/nfe-service/services/CadConsultaCadastro4',
    HOMOLOGACAO: 'https://nfehomolog.sefaz.pe.gov.br/nfe-service/services/CadConsultaCadastro4',
  },
  PR: {
    PRODUCAO: 'https://nfe.sefa.pr.gov.br/nfe/CadConsultaCadastro4',
    HOMOLOGACAO: 'https://homologacao.nfe.sefa.pr.gov.br/nfe/CadConsultaCadastro4',
  },
  RS: {
    PRODUCAO: 'https://cad.sefazrs.rs.gov.br/ws/cadconsultacadastro/cadconsultacadastro4.asmx',
    HOMOLOGACAO:
      'https://cad-homologacao.sefazrs.rs.gov.br/ws/cadconsultacadastro/cadconsultacadastro4.asmx',
  },
  SP: {
    PRODUCAO: 'https://nfe.fazenda.sp.gov.br/ws/cadconsultacadastro4.asmx',
    HOMOLOGACAO: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/cadconsultacadastro4.asmx',
  },
};

/**
 * CTeConsultaProtocolo V4 — per UF.
 *
 * Equivalente ao NfeConsultaProtocolo, mas para CT-e (modelo 57).
 * É o ÚNICO serviço SEFAZ que aceita consulta por chave de CT-e —
 * o CTeDistribuicaoDFe nacional só suporta distNSU/consNSU (sem consChCTe).
 *
 * Retorna: cStat + xMotivo + protCTe + procEventoCTe[]. NÃO retorna o XML
 * autorizado completo (esse vem do Protheus/SZR010 ou do NSU distribution).
 *
 * UFs com autorizador próprio (mod57): MG, MS, MT, PR, RS, SP.
 * Demais UFs: SVRS (SEFAZ Virtual RS) ou SVSP.
 *
 * Source: https://github.com/nfephp-org/sped-cte storage/wscte_4.00_mod57.xml
 */
const SVRS_CTE: Record<AmbienteSefazStr, string> = {
  PRODUCAO: 'https://cte.svrs.rs.gov.br/ws/CTeConsultaV4/CTeConsultaV4.asmx',
  HOMOLOGACAO: 'https://cte-homologacao.svrs.rs.gov.br/ws/CTeConsultaV4/CTeConsultaV4.asmx',
};

const SVSP_CTE: Record<AmbienteSefazStr, string> = {
  PRODUCAO: 'https://nfe.fazenda.sp.gov.br/CTeWS/WS/CTeConsultaV4.asmx',
  HOMOLOGACAO: 'https://homologacao.nfe.fazenda.sp.gov.br/CTeWS/WS/CTeConsultaV4.asmx',
};

export const CTE_CONSULTA_PROTOCOLO: Partial<Record<string, Record<AmbienteSefazStr, string>>> = {
  // UFs atendidas pelo SVRS
  AC: SVRS_CTE,
  AL: SVRS_CTE,
  AM: SVRS_CTE,
  AP: SVRS_CTE,
  BA: SVRS_CTE,
  CE: SVRS_CTE,
  DF: SVRS_CTE,
  ES: SVRS_CTE,
  GO: SVRS_CTE,
  MA: SVRS_CTE,
  PA: SVRS_CTE,
  PB: SVRS_CTE,
  PE: SVRS_CTE,
  PI: SVRS_CTE,
  RJ: SVRS_CTE,
  RN: SVRS_CTE,
  RO: SVRS_CTE,
  RR: SVRS_CTE,
  SC: SVRS_CTE,
  SE: SVRS_CTE,
  TO: SVRS_CTE,

  // UFs com CTe próprio
  MG: {
    PRODUCAO: 'https://cte.fazenda.mg.gov.br/cte/services/CTeConsultaV4',
    HOMOLOGACAO: 'https://hcte.fazenda.mg.gov.br/cte/services/CTeConsultaV4',
  },
  MS: {
    PRODUCAO: 'https://producao.cte.ms.gov.br/ws/CTeConsultaV4',
    HOMOLOGACAO: 'https://homologacao.cte.ms.gov.br/ws/CTeConsultaV4',
  },
  MT: {
    PRODUCAO: 'https://cte.sefaz.mt.gov.br/ctews2/services/CTeConsultaV4',
    HOMOLOGACAO: 'https://homologacao.sefaz.mt.gov.br/ctews2/services/CTeConsultaV4',
  },
  PR: {
    PRODUCAO: 'https://cte.fazenda.pr.gov.br/cte4/CTeConsultaV4',
    HOMOLOGACAO: 'https://homologacao.cte.fazenda.pr.gov.br/cte4/CTeConsultaV4',
  },
  RS: SVRS_CTE,
  SP: SVSP_CTE,
};

/**
 * Rate limit recomendado por UF — sugestão defensiva.
 * Consumido pelo cruzamento BullMQ (Onda 2) para throttle.
 */
export const RATE_LIMIT_POR_UF: Partial<Record<string, { reqPorSegundo: number; paralelismo: number }>> = {
  MG: { reqPorSegundo: 2, paralelismo: 3 },
  SP: { reqPorSegundo: 1, paralelismo: 2 }, // histórico de instabilidade
  RS: { reqPorSegundo: 2, paralelismo: 3 },
  DEFAULT: { reqPorSegundo: 1, paralelismo: 2 },
};

export function getNfeDistribuicaoUrl(ambiente: AmbienteSefazStr): string {
  return NFE_DISTRIBUICAO_DFE[ambiente];
}

export function getCteDistribuicaoUrl(ambiente: AmbienteSefazStr): string {
  return CTE_DISTRIBUICAO_DFE[ambiente];
}

export function getNfeConsultaProtocoloUrl(uf: string, ambiente: AmbienteSefazStr): string {
  const entry = NFE_CONSULTA_PROTOCOLO[uf.toUpperCase()];
  if (!entry) {
    throw new Error(`NfeConsultaProtocolo: UF ${uf} não mapeada. Completar em sefaz-endpoints.map.ts.`);
  }
  return entry[ambiente];
}

export function getCteConsultaProtocoloUrl(uf: string, ambiente: AmbienteSefazStr): string {
  const entry = CTE_CONSULTA_PROTOCOLO[uf.toUpperCase()];
  if (!entry) {
    throw new Error(`CteConsultaProtocolo: UF ${uf} não mapeada. Completar em sefaz-endpoints.map.ts.`);
  }
  return entry[ambiente];
}

export function getCccUrl(uf: string, ambiente: AmbienteSefazStr): string {
  const entry =
    CCC_CAD_CONSULTA_CADASTRO[uf.toUpperCase()] ?? CCC_CAD_CONSULTA_CADASTRO.SVRS;
  if (!entry) {
    throw new Error(`CCC: UF ${uf} não mapeada e SVRS fallback ausente.`);
  }
  return entry[ambiente];
}
