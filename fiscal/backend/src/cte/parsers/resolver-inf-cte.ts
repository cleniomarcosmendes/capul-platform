/**
 * Onde fica o `<infCte>` — para QUALQUER variante de CT-e.
 *
 * 🔴 Existe por causa de um documento invisível (relatado em 19/08/2026). O
 * CT-e 1950 da Distribuidora Carvalho, autorizado em 17/08 com a CAPUL como
 * tomadora, **chegou** pela distNSU e ficou guardado — mas com `chave = NULL`,
 * porque duas funções procuravam a raiz do CT-e NORMAL em todas as variantes:
 *
 * ```ts
 * const CTe = root?.cteProc?.CTe ?? root?.CTe;   // <- só o normal
 * ```
 *
 * O documento existia, o XML estava íntegro, e a busca por chave não o achava —
 * porque a chave nunca foi extraída. A tela dizia "não encontrado" e o operador
 * ia atrás do documento no SEFAZ, com o certificado da CAPUL, por um problema
 * que era nosso. É a falha silenciosa clássica: nada quebra, só some.
 *
 * Variantes que a SEFAZ já emite hoje (todas com `<infCte Id="CTe…">` dentro):
 *
 * | Raiz            | Documento         | Elemento  | Modelo |
 * |-----------------|-------------------|-----------|--------|
 * | `cteProc`       | CT-e normal       | `CTe`     | 57     |
 * | `cteSimpProc`   | CT-e Simplificado | `CTeSimp` | 57     |
 * | `cteOSProc`     | CT-e Outros Serv. | `CTeOS`   | 67     |
 *
 * ⚠️ E a lista **vai crescer** — o Simplificado é NT 1.05 (nov/2024) e chegou
 * aqui em jul/2026. Por isso o resolvedor tem um último recurso GENÉRICO: varre
 * o XML já parseado atrás de qualquer bloco com `Id="CTe<44 dígitos>"`. Uma
 * variante nova passa a ser **encontrável no mesmo dia**, e o log diz o nome da
 * raiz nova em vez de a gente descobrir meses depois procurando um documento.
 */

/** Padrão do atributo Id do CT-e: prefixo "CTe" + os 44 dígitos da chave. */
const ID_CTE = /^CTe(\d{44})$/;

export interface InfCteResolvido {
  /** O bloco `<infCte>` (objeto já parseado). */
  infCte: any;
  /** Nome da raiz onde foi achado — vai para o log. */
  raiz: string;
  /** true = veio da varredura genérica, não de um caminho conhecido. */
  generico: boolean;
}

/** Caminhos conhecidos, na ordem em que aparecem no volume real. */
const CAMINHOS: { raiz: string; get: (r: any) => any }[] = [
  { raiz: 'cteProc/CTe',         get: (r) => r?.cteProc?.CTe?.infCte },
  { raiz: 'cteSimpProc/CTeSimp', get: (r) => r?.cteSimpProc?.CTeSimp?.infCte },
  { raiz: 'cteOSProc/CTeOS',     get: (r) => r?.cteOSProc?.CTeOS?.infCte },
  // XMLs "nus" (sem o envelope de protocolo) — aparecem em teste e em
  // gravações manuais no Protheus.
  { raiz: 'CTe',                 get: (r) => r?.CTe?.infCte },
  { raiz: 'CTeSimp',             get: (r) => r?.CTeSimp?.infCte },
  { raiz: 'CTeOS',               get: (r) => r?.CTeOS?.infCte },
];

/** Varredura genérica: acha o 1º bloco com `Id="CTe<44 dígitos>"`. */
function buscarPorId(no: any, profundidade = 0): { infCte: any; raiz: string } | null {
  // O XML do CT-e é raso; o teto evita passeio em estrutura inesperada.
  if (!no || typeof no !== 'object' || profundidade > 8) return null;
  for (const [nome, valor] of Object.entries(no)) {
    if (!valor || typeof valor !== 'object') continue;
    const id = (valor as any)['@_Id'];
    if (typeof id === 'string' && ID_CTE.test(id)) {
      return { infCte: valor, raiz: nome };
    }
    const achado = buscarPorId(valor, profundidade + 1);
    if (achado) return achado;
  }
  return null;
}

/**
 * Devolve o `<infCte>` de qualquer variante, ou `null` se o XML não for CT-e.
 * Nunca lança: quem chama decide o que fazer com a ausência.
 */
export function resolverInfCte(root: any): InfCteResolvido | null {
  for (const c of CAMINHOS) {
    const infCte = c.get(root);
    if (infCte) return { infCte, raiz: c.raiz, generico: false };
  }
  const achado = buscarPorId(root);
  return achado ? { infCte: achado.infCte, raiz: achado.raiz, generico: true } : null;
}

/** A chave (44 dígitos) a partir do `Id` do bloco. `null` se ausente/malformado. */
export function chaveDoInfCte(infCte: any): string | null {
  const id = infCte?.['@_Id'];
  if (typeof id !== 'string') return null;
  const m = ID_CTE.exec(id);
  return m ? m[1] : null;
}

/**
 * O `<protCTe>` (protocolo de autorização) — que mora no ENVELOPE, e o envelope
 * muda junto com a variante: `cteProc`, `cteSimpProc`, `cteOSProc`.
 *
 * Sem isto, o CT-e Simplificado abriria na tela **sem o protocolo de
 * autorização** — que é justamente o que prova que o documento é válido.
 */
export function resolverProtCTe(root: any): any | null {
  if (!root || typeof root !== 'object') return null;
  const conhecidos = [root.cteProc, root.cteSimpProc, root.cteOSProc];
  for (const env of conhecidos) {
    if (env?.protCTe) return env.protCTe;
  }
  // Envelope novo: pega o primeiro filho da raiz que carregue protCTe.
  for (const valor of Object.values(root)) {
    if (valor && typeof valor === 'object' && (valor as any).protCTe) {
      return (valor as any).protCTe;
    }
  }
  return null;
}
