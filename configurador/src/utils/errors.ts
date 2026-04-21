import { AxiosError } from 'axios';

/**
 * Shape padrão das respostas de erro do backend Fiscal
 * (retornado pelo `AllExceptionsFilter` do NestJS).
 */
export interface FiscalApiErrorBody {
  statusCode: number;
  mensagem: string;
  erro?: string;
  detalhe?: unknown;
  path: string;
  timestamp: string;
}

/**
 * Extrai uma mensagem amigável de qualquer erro vindo do fiscalApi (Axios).
 *
 * Substitui o padrão repetido em ~15 lugares do frontend:
 *   `(err as { response?: { data?: { mensagem?: string } } }).response?.data?.mensagem`
 *
 * Cobre:
 *   - Resposta estruturada do backend (`{ mensagem, erro }`)
 *   - AxiosError sem resposta (network, timeout, DNS) — retorna mensagem genérica
 *   - Erros não-Axios (inesperados) — retorna `.message` ou fallback
 *
 * Uso:
 * ```ts
 * try { ... } catch (err) {
 *   toast.error('Falha ao...', extractApiError(err));
 * }
 * ```
 */
export function extractApiError(err: unknown, fallback?: string): string {
  if (err instanceof AxiosError) {
    const body = err.response?.data as FiscalApiErrorBody | undefined;
    if (body?.mensagem) return body.mensagem;

    // Erros de rede / timeout / DNS — sem response
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      return 'A requisição demorou demais para responder. Tente novamente em alguns instantes.';
    }
    if (err.code === 'ERR_NETWORK') {
      return 'Não foi possível conectar ao servidor. Verifique sua conexão.';
    }
    if (err.response?.status === 401) {
      return 'Sessão expirada ou inválida. Faça login novamente.';
    }
    if (err.response?.status === 403) {
      return 'Você não tem permissão para executar esta operação.';
    }
    if (err.response?.status === 404) {
      return 'Recurso não encontrado.';
    }
    if (err.response && err.response.status >= 500) {
      return 'Erro interno do servidor. Contate o suporte se o problema persistir.';
    }
    return err.message || fallback || 'Erro desconhecido.';
  }

  if (err instanceof Error) {
    return err.message || fallback || 'Erro desconhecido.';
  }

  return fallback ?? 'Erro desconhecido.';
}

/**
 * Extrai o código de erro estruturado do backend (ex: `SEFAZ_NAO_RETORNOU_DOCUMENTO`)
 * quando presente. Útil para lógica condicional baseada em erro específico.
 */
export function extractApiErrorCode(err: unknown): string | null {
  if (err instanceof AxiosError) {
    const body = err.response?.data as FiscalApiErrorBody | undefined;
    return body?.erro ?? null;
  }
  return null;
}
