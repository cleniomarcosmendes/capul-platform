import type { ReactElement } from 'react';

/**
 * Banner do que não carregou. Some sozinho quando a carga seguinte dá certo.
 *
 * Fica no topo da tela de propósito: o usuário precisa ver isto ANTES de concluir que a
 * lista vazia logo abaixo significa "não há".
 */
export function AvisoFalhasCarga({ falhas }: { falhas: Record<string, string> }): ReactElement | null {
  const msgs = [...new Set(Object.values(falhas).filter(Boolean))];
  if (msgs.length === 0) return null;
  return (
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
      <p className="text-sm font-medium text-amber-900">
        Parte da tela não carregou — o que estiver vazio abaixo pode ser efeito disto, não ausência de dado.
      </p>
      <ul className="mt-1 list-inside list-disc text-xs text-amber-800">
        {msgs.map((m) => <li key={m}>{m}</li>)}
      </ul>
    </div>
  );
}
