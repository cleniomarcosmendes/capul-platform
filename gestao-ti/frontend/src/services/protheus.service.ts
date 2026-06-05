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

export const protheusService = {
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
};
