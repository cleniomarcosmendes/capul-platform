import { gestaoApi } from './api';

export interface ColaboradorProtheus {
  encontrado: boolean;
  matricula: string;
  nome: string | null;
  cc?: string | null;
}

export interface FuncionarioProtheus {
  matricula: string;
  nome: string;
  cc: string | null;
}

export interface ValidacaoColaborador {
  valida: boolean;
  /** Só quando inválida: por quê. INDISPONIVEL = Protheus fora / não conferiu. */
  motivo?: 'CREDENCIAIS_INVALIDAS' | 'INDISPONIVEL';
  encontrado: boolean;
  matricula?: string;
  nome: string | null;
  cc?: string | null;
}

export interface ClienteSacProtheus {
  encontrado: boolean;
  matricula: string;
  nome: string | null;
  telefone?: string | null;
  cpfCnpj?: string | null;
}

export const protheusService = {
  /**
   * SAC — busca o CLIENTE (cooperado) na SA1 por matrícula, para autofill do
   * formulário do SAC (nome + telefone). A SA1 não traz e-mail — esse fica
   * manual. `encontrado:false` quando inválida/sem acesso → digita manual.
   * Nunca lança.
   */
  async buscarClienteSac(matricula: string): Promise<ClienteSacProtheus> {
    const m = (matricula || '').trim();
    if (!m) return { encontrado: false, matricula: '', nome: null };
    try {
      const { data } = await gestaoApi.get<ClienteSacProtheus>(
        `/protheus/cliente-sac/${encodeURIComponent(m)}`,
      );
      return data;
    } catch {
      return { encontrado: false, matricula: m, nome: null };
    }
  },

  /**
   * Busca o funcionário (nome + centro de custo) por matrícula no Protheus
   * (operação `infoFuncionario` / portal RH). Retorna `encontrado:false`
   * quando a matrícula é inválida/sem acesso — nesse caso o nome é informado
   * manualmente. Nunca lança: erro de rede vira `encontrado:false`.
   */
  async buscarColaborador(matricula: string): Promise<ColaboradorProtheus> {
    const m = (matricula || '').trim();
    if (!m) return { encontrado: false, matricula: '', nome: null };
    try {
      const { data } = await gestaoApi.get<ColaboradorProtheus>(
        `/protheus/colaborador/${encodeURIComponent(m)}`,
      );
      return data;
    } catch {
      return { encontrado: false, matricula: m, nome: null };
    }
  },

  /**
   * Autocomplete: busca funcionários por parte do NOME (portal RH). Mínimo 3
   * caracteres (o backend também exige). Nunca lança — erro/Protheus fora vira
   * lista vazia. A ordenação por nome vem do Protheus.
   */
  async buscarPorNome(nome: string): Promise<FuncionarioProtheus[]> {
    const q = (nome || '').trim();
    if (q.length < 3) return [];
    try {
      const { data } = await gestaoApi.get<{ funcionarios: FuncionarioProtheus[] }>(
        `/protheus/colaboradores`,
        { params: { nome: q } },
      );
      return data?.funcionarios ?? [];
    } catch {
      return [];
    }
  },

  /**
   * Valida matrícula+senha no portal RH (loginPortal). Quando válida, já volta
   * com o nome do colaborador — a tela só revela o nome após a senha conferir.
   * Nunca lança: erro de rede no nosso backend vira `motivo:'INDISPONIVEL'`.
   */
  async validarColaborador(matricula: string, senha: string): Promise<ValidacaoColaborador> {
    const m = (matricula || '').trim();
    try {
      const { data } = await gestaoApi.post<ValidacaoColaborador>(
        `/protheus/colaborador/validar`,
        { matricula: m, senha },
      );
      return data;
    } catch {
      return { valida: false, motivo: 'INDISPONIVEL', encontrado: false, nome: null };
    }
  },
};
