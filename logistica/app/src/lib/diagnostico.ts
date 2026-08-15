/**
 * 🔬 Coletor de diagnóstico que funciona em BUNDLE DE PRODUÇÃO.
 *
 * Por que não é `console.log`: o encaminhamento de log para o Metro é instalado
 * pelo `InitializeCore` **sob `__DEV__`**. Com `expo start --no-dev --minify` ele
 * não existe, então nada aparece no terminal — foi o que aconteceu em 15/08, com
 * a instrumentação toda invisível justo no modo em que a medição importa (o
 * bundle de produção é o que prova que o defeito é real).
 *
 * Então os números ficam em memória e quem os mostra é a própria tela, que o
 * Clenio fotografa. Tudo aqui é módulo/ref: NADA dispara render. Instrumento que
 * escreve em `state` no caminho de gesto cancela o próprio toque que deveria
 * medir — erro que já custou duas rodadas de teste (7fe2b05d).
 */
interface Estado {
  /** Toques que chegaram a um handler (não à camada nativa: ao HANDLER). */
  toques: number;
  /** Rótulo e instante do último toque que executou. */
  ultimoToque: string;
  ultimoToqueEm: number;
  /** Quantas vezes a thread de JS ficou parada além do limite. */
  travamentos: number;
  /** Maior parada observada, em ms. */
  piorMs: number;
  /** A parada mais recente, em ms. */
  ultimaMs: number;
}

const estado: Estado = {
  toques: 0,
  ultimoToque: '—',
  ultimoToqueEm: 0,
  travamentos: 0,
  piorMs: 0,
  ultimaMs: 0,
};

/** Chamar DENTRO do handler — mede que o toque virou execução, não só evento. */
export function registrarToque(rotulo: string): void {
  estado.toques += 1;
  estado.ultimoToque = rotulo;
  estado.ultimoToqueEm = Date.now();
}

export function registrarTravamento(ms: number): void {
  estado.travamentos += 1;
  estado.ultimaMs = ms;
  if (ms > estado.piorMs) estado.piorMs = ms;
}

/**
 * Linha para a faixa na tela. `há Xs` no último toque é o campo decisivo: se o
 * dedo está tocando AGORA e esse número só cresce, o toque não virou execução.
 */
export function lerDiagnostico(): string {
  const desde = estado.ultimoToqueEm ? Math.round((Date.now() - estado.ultimoToqueEm) / 1000) : -1;
  return (
    `toques=${estado.toques} · ult=${estado.ultimoToque}` +
    (desde >= 0 ? ` há ${desde}s` : '') +
    ` · travas=${estado.travamentos} (pior ${estado.piorMs}ms · ult ${estado.ultimaMs}ms)`
  );
}
