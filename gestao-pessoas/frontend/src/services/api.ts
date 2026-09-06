import axios from 'axios';

/**
 * Três instâncias, como nos outros módulos: o token é o mesmo (JWT unificado da
 * plataforma), guardado em `localStorage` pelo Hub e compartilhado por serem a
 * mesma origem.
 */
export const authApi = axios.create({ baseURL: '/api/v1/auth', timeout: 30_000 });
export const coreApi = axios.create({ baseURL: '/api/v1/core', timeout: 30_000 });
export const rhApi = axios.create({ baseURL: '/api/v1/gestao-pessoas', timeout: 30_000 });

for (const instancia of [authApi, coreApi, rhApi]) {
  instancia.interceptors.request.use((config) => {
    const token = localStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
  instancia.interceptors.response.use(
    (r) => r,
    (erro) => {
      if (erro.response?.status === 401) {
        localStorage.removeItem('accessToken');
        window.location.href = '/';
      }
      return Promise.reject(erro);
    },
  );
}

/** Mensagem que o backend mandou — nunca "erro desconhecido" quando há texto. */
export function mensagemDoErro(erro: unknown, padrao = 'Não foi possível concluir.'): string {
  const resposta = (erro as { response?: { data?: { message?: string | string[] } } }).response;
  const m = resposta?.data?.message;
  if (Array.isArray(m)) return m.join(' ');
  return m || padrao;
}

// ---------------------------------------------------------------------------
// Contratos — redeclarados aqui porque a plataforma não tem geração de client
// (ver o dossiê de arquitetura, §4.7). Mudou no backend, muda aqui.
// ---------------------------------------------------------------------------

export type StatusAvaliacao = 'PENDENTE' | 'EM_ANDAMENTO' | 'ENVIADA' | 'CANCELADA';

export interface ItemDaFila {
  id: string;
  avaliadoId: string;
  nome: string;
  matricula: string;
  cargo: string | null;
  centroCusto: string | null;
  aplicacao: string;
  status: StatusAvaliacao;
  enviadaEm: string | null;
  perguntasTotal: number;
  perguntasRespondidas: number;
  /** true quando é a avaliação do próprio usuário — aparece, mas não abre. */
  restrita: boolean;
  motivoRestricao?: string;
}

export interface Alternativa {
  id: string;
  descricao: string;
}
export interface Pergunta {
  id: string;
  enunciado: string;
  alternativas: Alternativa[];
  alternativaEscolhidaId: string | null;
}
export interface GrupoDePerguntas {
  id: string;
  titulo: string;
  perguntas: Pergunta[];
}
export interface Questionario {
  id: string;
  status: StatusAvaliacao;
  observacaoAvaliador: string | null;
  avaliado: { nome: string; matricula: string; cargo: string | null };
  perguntasTotal: number;
  perguntasRespondidas: number;
  grupos: GrupoDePerguntas[];
}

export const avaliacoes = {
  minhas: () => rhApi.get<ItemDaFila[]>('/avaliacoes/minhas').then((r) => r.data),
  abrir: (id: string) => rhApi.get<Questionario>(`/avaliacoes/${id}`).then((r) => r.data),
  responder: (id: string, perguntaId: string, alternativaId: string) =>
    rhApi.post(`/avaliacoes/${id}/respostas`, { perguntaId, alternativaId }).then((r) => r.data),
  enviar: (id: string, observacao?: string) =>
    rhApi.post<{ notaAvaliacao: number }>(`/avaliacoes/${id}/enviar`, { observacao }).then((r) => r.data),
};
