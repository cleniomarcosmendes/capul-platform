// Consolidação geográfica das marcações de campo → localização "verdade" de um local.
//
// Ideia: cada visita/parada grava um ponto GPS ruidoso. A localização do local NÃO é
// nenhum ponto isolado (nem o primeiro, nem o último) — é derivada do CLUSTER mais denso
// das marcações, com um nível de confiança. Pontos avulsos (marcados da estrada/cidade)
// ficam de fora como outliers.

export interface Ponto {
  lat: number;
  lng: number;
}

export type Confianca = 'PROVISORIA' | 'CONFIRMADA';

export interface Consolidacao {
  lat: number; // medóide do cluster vencedor (um ponto REAL, robusto a outlier)
  lng: number;
  nMarcacoes: number; // tamanho do cluster vencedor
  raioDispersaoM: number; // maior distância do medóide aos membros do cluster
  confianca: Confianca;
}

const R_TERRA_M = 6_371_000;
const rad = (x: number) => (x * Math.PI) / 180;

/** Distância Haversine em metros entre dois pontos. */
export function distanciaM(a: Ponto, b: Ponto): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_TERRA_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

export interface OpcoesConsolidacao {
  /** Pontos a ≤ este raio (m) entram no mesmo cluster (single-linkage). */
  raioClusterM?: number;
  /** Raio máximo (m) do cluster para ser considerado CONFIRMADO. */
  raioConfirmadoM?: number;
  /** Mínimo de marcações no cluster para CONFIRMADO. */
  minConfirmado?: number;
}

/**
 * Consolida um conjunto de pontos no medóide do maior cluster.
 * - Agrupa por proximidade (single-linkage por raio, via union-find).
 * - Escolhe o MAIOR cluster (empate → o de menor dispersão).
 * - Representante = medóide (minimiza a soma das distâncias — robusto a outlier).
 * - Confiança: CONFIRMADA se o cluster tem ≥ minConfirmado pontos E raio ≤ raioConfirmadoM;
 *   senão PROVISORIA. Retorna null se não houver pontos.
 */
export function consolidar(pontos: Ponto[], opts: OpcoesConsolidacao = {}): Consolidacao | null {
  const raioCluster = opts.raioClusterM ?? 80;
  const raioConfirmado = opts.raioConfirmadoM ?? 100;
  const minConfirmado = opts.minConfirmado ?? 3;
  const n = pontos.length;
  if (n === 0) return null;

  // Union-find (single-linkage por proximidade).
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (i: number, j: number) => {
    parent[find(i)] = find(j);
  };
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (distanciaM(pontos[i], pontos[j]) <= raioCluster) union(i, j);
    }
  }

  // Agrupa índices por raiz.
  const grupos = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    const g = grupos.get(r);
    if (g) g.push(i);
    else grupos.set(r, [i]);
  }

  // Medóide + raio de um conjunto de pontos.
  const medoideDe = (membros: Ponto[]): { medoide: Ponto; raio: number } => {
    let medoide = membros[0];
    let melhorSoma = Infinity;
    for (const c of membros) {
      const soma = membros.reduce((s, p) => s + distanciaM(c, p), 0);
      if (soma < melhorSoma) {
        melhorSoma = soma;
        medoide = c;
      }
    }
    const raio = Math.round(membros.reduce((mx, p) => Math.max(mx, distanciaM(medoide, p)), 0));
    return { medoide, raio };
  };

  // Maior cluster; empate no tamanho → menor dispersão.
  let melhor: { membros: Ponto[]; medoide: Ponto; raio: number } | null = null;
  for (const idxs of grupos.values()) {
    const membros = idxs.map((i) => pontos[i]);
    const { medoide, raio } = medoideDe(membros);
    if (
      !melhor ||
      membros.length > melhor.membros.length ||
      (membros.length === melhor.membros.length && raio < melhor.raio)
    ) {
      melhor = { membros, medoide, raio };
    }
  }
  if (!melhor) return null;

  const confianca: Confianca =
    melhor.membros.length >= minConfirmado && melhor.raio <= raioConfirmado ? 'CONFIRMADA' : 'PROVISORIA';
  return {
    lat: melhor.medoide.lat,
    lng: melhor.medoide.lng,
    nMarcacoes: melhor.membros.length,
    raioDispersaoM: melhor.raio,
    confianca,
  };
}
