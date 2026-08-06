/**
 * Extrai a mensagem de erro da resposta da API.
 *
 * O backend responde de duas formas, e ambas precisam funcionar:
 *
 *   - `detail` como STRING — o padrão histórico de quase todos os endpoints.
 *   - `detail` como OBJETO `{ erro, mensagem, ... }` — introduzido na Fase 0 da
 *     contagem offline, porque a fila do app precisa de um CÓDIGO estável para
 *     decidir entre reenviar, descartar ou pôr em quarentena; texto solto não
 *     serve para isso.
 *
 * Sem este tratamento, uma tela que fazia `toast.error(detail)` passaria a
 * mostrar "[object Object]" nos erros novos.
 */

export interface ApiErrorInfo {
  /** Código estável quando o backend manda (`CICLO_DIVERGENTE` etc.); null se veio texto. */
  codigo: string | null;
  mensagem: string;
  /** Corpo bruto do `detail`, para quem precisa de campos extras do erro. */
  dados: Record<string, unknown> | null;
}

type AxiosLike = { response?: { data?: { detail?: unknown } } };

export function parseApiError(err: unknown, fallback = 'Ocorreu um erro inesperado.'): ApiErrorInfo {
  const detail = (err as AxiosLike)?.response?.data?.detail;

  if (typeof detail === 'string' && detail.trim()) {
    return { codigo: null, mensagem: detail, dados: null };
  }

  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const d = detail as Record<string, unknown>;
    const mensagem = typeof d.mensagem === 'string' && d.mensagem.trim() ? d.mensagem : fallback;
    const codigo = typeof d.erro === 'string' ? d.erro : null;
    return { codigo, mensagem, dados: d };
  }

  // Erro de rede/timeout não tem `response` — a mensagem do axios é melhor que nada.
  const msg = (err as { message?: string })?.message;
  return { codigo: null, mensagem: msg || fallback, dados: null };
}

/** Atalho para quem só quer o texto do toast. */
export function extractApiError(err: unknown, fallback = 'Ocorreu um erro inesperado.'): string {
  return parseApiError(err, fallback).mensagem;
}
