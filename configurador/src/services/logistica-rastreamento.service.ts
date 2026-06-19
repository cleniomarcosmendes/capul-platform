import { logisticaApi } from './api';

// Estatísticas/política do rastreamento GPS (módulo Logística). Best-effort:
// o admin do Configurador pode NÃO ter o módulo LOGISTICA no JWT (→ 403). A
// tela mostra a política mesmo assim; os números ao vivo são um bônus.

export interface RastreamentoConfig {
  retencaoDias: number;
  totalPosicoes: number;
  viagensComPosicao: number;
  posicaoMaisAntiga: string | null;
}

export const logisticaRastreamentoService = {
  async getConfig(): Promise<RastreamentoConfig> {
    const { data } = await logisticaApi.get<RastreamentoConfig>('/rastreamento/config');
    return data;
  },

  async purgar(): Promise<{ removidas: number; retencaoDias: number }> {
    const { data } = await logisticaApi.post('/rastreamento/purga');
    return data;
  },
};
