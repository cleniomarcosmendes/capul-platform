// Tipos e helpers da "Linha do KM" — extraídos de LinhaKmBarra.tsx para que o
// arquivo do componente exporte só o componente (Fast Refresh do Vite). Eixo em
// QUILÔMETROS: cada rota é um segmento colorido (kmInicial→kmFinal) e as lacunas
// entre rotas aparecem como "não apontadas" (prestação de contas do odômetro).

export interface SegKm {
  tipo: 'viagem' | 'gap';
  kmInicio: number; kmFim: number; km: number; label: string;
  viagemNumero?: number; data?: string | null; condutor?: string | null;
}
export interface LinhaKm {
  veiculoId: string; placa: string; modelo?: string | null; kmAtual: number;
  kmMin: number; kmMax: number; kmViagens: number; kmNaoApontadas: number;
  qtdViagens: number; segmentos: SegKm[];
}

export const fmtKm = (n: number) => n.toLocaleString('pt-BR');
export const HACHURA = 'repeating-linear-gradient(45deg, #cbd5e1, #cbd5e1 4px, #e2e8f0 4px, #e2e8f0 8px)';
// Paleta cíclica para as rotas — cores alternam para distinguir uma rota da
// seguinte (início/fim de cada trecho ficam visíveis mesmo quando são contíguos).
export const CORES_VIAGEM = ['#0ea5e9', '#6366f1', '#10b981', '#f59e0b', '#ec4899', '#14b8a6', '#8b5cf6', '#ef4444', '#22c55e', '#eab308'];

// Índice de cor por segmento: cada rota avança na paleta; lacunas ficam null.
export function coresPorSegmento(segmentos: SegKm[]): (string | null)[] {
  let vi = 0;
  return segmentos.map((s) => (s.tipo === 'viagem' ? CORES_VIAGEM[vi++ % CORES_VIAGEM.length] : null));
}
