import { gestaoApi } from './api';

export interface SacEmailConfig {
  id: number;
  enabled: boolean;
  pauseSync: boolean;
  mailboxFolder: string;
  pollIntervalMinutes: number;
  lastPollAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  processadosTotal: number;
  updatedAt: string;
  updatedBy: string | null;
}

export interface SacEmailConexao {
  origem: 'ambiente';
  host: string | null;
  port: number;
  user: string | null;
  secure: boolean;
  senhaConfigurada: boolean;
  /** host + user + senha presentes no ambiente. */
  configurada: boolean;
}

export interface SacEmailConfigResp {
  config: SacEmailConfig;
  conexao: SacEmailConexao;
}

export interface SacEmailTesteResp {
  ok: boolean;
  mailbox?: string;
  total?: number;
  unseen?: number;
  error?: string;
}

export interface UpdateSacEmailConfigPayload {
  enabled?: boolean;
  pauseSync?: boolean;
  mailboxFolder?: string;
  pollIntervalMinutes?: number;
}

export type ResultadoIngestaoSac =
  | 'MATCHED'
  | 'UNMATCHED'
  | 'SKIPPED_AUTO'
  | 'SKIPPED_OWN'
  | 'DUPLICATE'
  | 'ERROR';

export interface SacEmailIngestao {
  id: string;
  messageId: string;
  fromAddr: string | null;
  subject: string | null;
  sacNumero: number | null;
  chamadoId: string | null;
  resultado: ResultadoIngestaoSac;
  motivo: string | null;
  recebidoEm: string | null;
  processadoEm: string;
}

export interface SacEmailBuscaResp {
  ok: boolean;
  error?: string;
  resumo?: {
    buscados: number;
    matched: number;
    unmatched: number;
    skippedAuto: number;
    skippedOwn: number;
    duplicate: number;
    erro: number;
    capped: boolean;
  };
}

export const sacEmailService = {
  async getConfig(): Promise<SacEmailConfigResp> {
    const { data } = await gestaoApi.get('/sac-email/config');
    return data;
  },

  async updateConfig(payload: UpdateSacEmailConfigPayload): Promise<SacEmailConfigResp> {
    const { data } = await gestaoApi.put('/sac-email/config', payload);
    return data;
  },

  // Testa a conexão IMAP (sem ingerir). Nunca lança no backend.
  async testarConexao(): Promise<SacEmailTesteResp> {
    const { data } = await gestaoApi.post('/sac-email/test-connection', {});
    return data;
  },

  // SAC 3b — busca e classifica as não-lidas (sem criar histórico ainda).
  async buscarAgora(): Promise<SacEmailBuscaResp> {
    const { data } = await gestaoApi.post('/sac-email/buscar-agora', {});
    return data;
  },

  async listarIngestoes(): Promise<SacEmailIngestao[]> {
    const { data } = await gestaoApi.get('/sac-email/ingestoes');
    return data;
  },
};
