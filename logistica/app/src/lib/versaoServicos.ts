import { API_URL, AUTH_BASE, LOGISTICA_BASE } from '../api/config';

/**
 * Lê a identidade de build dos serviços que este app usa, pelo `/health` de cada
 * um (rota pública — funciona ANTES do login, que é quando a dúvida costuma
 * aparecer).
 *
 * Sem `api` (axios): o cliente do app carrega interceptor de auth, refresh e
 * fila offline. Nada disso vale aqui, e um 401 de token vencido viraria "serviço
 * fora" — diagnóstico errado numa tela cujo trabalho é justamente não errar o
 * diagnóstico.
 */
export interface VersaoServico {
  /** Como aparece na tela. */
  nome: string;
  caminho: string;
  /** 'ok' quando respondeu; 'fora' quando não deu para falar com ele. */
  estado: 'ok' | 'fora';
  /** Status que o próprio serviço declara ('ok' | 'degraded' | 'down'). */
  status?: string;
  versao?: string;
  commit?: string | null;
  buildEm?: string | null;
  erro?: string;
}

interface HealthComVersao {
  status?: string;
  versao?: { versao?: string; commit?: string; buildEm?: string | null };
}

const TIMEOUT_MS = 8000;

async function lerHealth(nome: string, base: string): Promise<VersaoServico> {
  const caminho = `${base}/health`;
  const cancelador = new AbortController();
  const relogio = setTimeout(() => cancelador.abort(), TIMEOUT_MS);
  try {
    const resposta = await fetch(caminho, { signal: cancelador.signal });
    // 503 do health ainda traz o corpo (serviço no ar, banco fora): a versão
    // continua valendo, e é justamente aí que saber qual build está no ar ajuda.
    const corpo = (await resposta.json()) as HealthComVersao;
    return {
      nome,
      caminho,
      estado: 'ok',
      status: corpo.status,
      versao: corpo.versao?.versao,
      // Serviço ainda não atualizado não tem o campo — some do lado do app como
      // 'desconhecido', que é o que o alinhamento trata como indeterminado.
      commit: corpo.versao?.commit ?? null,
      buildEm: corpo.versao?.buildEm ?? null,
    };
  } catch (err) {
    return {
      nome,
      caminho,
      estado: 'fora',
      erro: (err as Error).name === 'AbortError' ? 'sem resposta em 8s' : (err as Error).message,
    };
  } finally {
    clearTimeout(relogio);
  }
}

/** Consulta em paralelo — a tela toda espera o mais lento, não a soma. */
export function lerVersaoDosServicos(): Promise<VersaoServico[]> {
  return Promise.all([
    lerHealth('Autenticação', AUTH_BASE),
    lerHealth('Logística', LOGISTICA_BASE),
  ]);
}

export const SERVIDOR = API_URL;
