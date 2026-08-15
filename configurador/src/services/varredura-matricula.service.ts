import { coreApi } from './api';

export interface UsuarioVarredura {
  id: string;
  username: string;
  nome: string;
  /** `null` no balde "sem matrícula" — é o que falta nele. */
  matricula: string | null;
}

export interface ListasVarredura {
  ativos: UsuarioVarredura[];
  desligados: UsuarioVarredura[];
  falhas: UsuarioVarredura[];
  semMatricula: UsuarioVarredura[];
}

export interface ResultadoVarredura {
  verificados: number;
  ativos: number;
  naoEncontrados: number;
  falhas: number;
  semMatricula: number;
  bloqueados: number;
  abortada: boolean;
  motivoAborto?: string;
  desligados: UsuarioVarredura[];
  listas: ListasVarredura;
}

export interface StatusVarredura {
  modo: 'RELATORIO' | 'BLOQUEIO';
  tetoPct: number;
  ultimaExecucao: {
    createdAt: string;
    level: string;
    message: string;
    action: string;
    metadata: ResultadoVarredura & { duracaoMs: number };
  } | null;
}

export const varreduraMatriculaService = {
  async getStatus(): Promise<StatusVarredura> {
    const { data } = await coreApi.get('/varredura-matricula/status');
    return data;
  },

  async configurar(dto: { bloquear?: boolean; tetoPct?: number }): Promise<StatusVarredura> {
    const { data } = await coreApi.patch('/varredura-matricula/config', dto);
    return data;
  },

  /** Roda agora e devolve o resultado COMPLETO — é assim que se confere a lista. */
  async executar(): Promise<ResultadoVarredura> {
    const { data } = await coreApi.post('/varredura-matricula/executar', {});
    return data;
  },
};
