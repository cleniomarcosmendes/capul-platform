/**
 * Mapa canal → URL da API, decidido em RUNTIME por `Updates.channel`.
 * Função pura (sem imports) p/ ser unit-testável e p/ não acoplar a resolução
 * da URL ao expo-updates. Canal desconhecido/nulo → undefined (o chamador decide
 * o fallback; NUNCA cair em produção por engano a partir de um build não-identificado).
 */
const URL_POR_CANAL: Record<string, string> = {
  production: 'https://platform.capul.com.br',
  homolog: 'https://platformhlg.capul.com.br',
};

export function urlPorCanal(channel: string | null | undefined): string | undefined {
  if (!channel) return undefined;
  return URL_POR_CANAL[channel];
}
