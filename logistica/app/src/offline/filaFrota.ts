import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { isAxiosError } from 'axios';
import {
  adicionarParadaFrota, checkinParadaFrota, pularParadaFrota, lancarDespesaViagem,
  type ParadaPayload, type CheckinPayload, type DespesaViagemPayload,
} from '../api/frota';

/**
 * Fila offline da FROTA (Fase 2d). O condutor roda com sinal ruim: as ações DO
 * MIOLO da viagem (parada ad-hoc, check-in, pular, despesa) que falharem por
 * REDE entram aqui e são reenviadas quando o sinal voltar. Saída e retorno NÃO
 * entram (precisam validar senha no Protheus em tempo real).
 *
 * Idempotência: parada e despesa carregam idempotencyKey (backend dedupe);
 * check-in/pular são por paradaId (reexecutar é no-op). Política de reenvio
 * igual à fila de baixas: sucesso → remove; erro de NEGÓCIO (4xx ≠ 401/408/429)
 * → remove e reporta; rede/5xx/401 → mantém.
 */
export type AcaoFrota =
  | { tipo: 'parada'; viagemId: string; payload: ParadaPayload }
  | { tipo: 'checkin'; viagemId: string; paradaId: string; payload: CheckinPayload }
  | { tipo: 'pular'; viagemId: string; paradaId: string }
  | { tipo: 'despesa'; viagemId: string; payload: DespesaViagemPayload; fotoUri: string | null };

export interface ItemFrota {
  id: string;          // idempotencyKey (parada/despesa) ou uuid local (checkin/pular)
  rotulo: string;      // texto curto p/ o banner ("Parada: Cliente A")
  acao: AcaoFrota;
  criadoEm: string;
  tentativas: number;
  ultimoErro: string | null;
}

const KEY = 'capul_fila_frota';
const DIR = `${FileSystem.documentDirectory}frota/`;

type Listener = (pendentes: number) => void;
const listeners = new Set<Listener>();
const notificar = (qtd: number) => listeners.forEach((l) => l(qtd));
export function onFilaFrotaChange(l: Listener): () => void { listeners.add(l); return () => listeners.delete(l); }

async function ler(): Promise<ItemFrota[]> {
  try { const raw = await AsyncStorage.getItem(KEY); return raw ? (JSON.parse(raw) as ItemFrota[]) : []; }
  catch { return []; }
}
async function gravar(itens: ItemFrota[]) { await AsyncStorage.setItem(KEY, JSON.stringify(itens)); notificar(itens.length); }
export async function contarPendentesFrota(): Promise<number> { return (await ler()).length; }

async function apagarFoto(uri: string | null) {
  if (!uri) return;
  await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
}

/** Enfileira uma ação que falhou por rede (foto da despesa copiada p/ pasta do app). */
export async function enfileirarFrota(item: { id: string; rotulo: string; acao: AcaoFrota }): Promise<void> {
  let acao = item.acao;
  if (acao.tipo === 'despesa' && acao.fotoUri) {
    await FileSystem.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => undefined);
    const dest = `${DIR}${item.id}.jpg`;
    await FileSystem.copyAsync({ from: acao.fotoUri, to: dest });
    acao = { ...acao, fotoUri: dest };
  }
  const itens = await ler();
  if (itens.some((i) => i.id === item.id)) return; // já enfileirado
  itens.push({ id: item.id, rotulo: item.rotulo, acao, criadoEm: new Date().toISOString(), tentativas: 0, ultimoErro: null });
  await gravar(itens);
}

async function enviar(acao: AcaoFrota): Promise<void> {
  switch (acao.tipo) {
    case 'parada': return adicionarParadaFrota(acao.viagemId, acao.payload);
    case 'checkin': return checkinParadaFrota(acao.viagemId, acao.paradaId, acao.payload);
    case 'pular': return pularParadaFrota(acao.viagemId, acao.paradaId);
    case 'despesa': return lancarDespesaViagem(acao.payload, acao.fotoUri ?? undefined);
  }
}

export interface ResultadoFilaFrota { enviadas: number; descartadas: Array<{ rotulo: string; motivo: string }>; restantes: number }
let processando = false;

/** Reenvia tudo (single-flight). Chamar ao focar a tela da viagem e após ação online. */
export async function processarFilaFrota(): Promise<ResultadoFilaFrota> {
  if (processando) return { enviadas: 0, descartadas: [], restantes: await contarPendentesFrota() };
  processando = true;
  try {
    const itens = await ler();
    const manter: ItemFrota[] = [];
    const descartadas: ResultadoFilaFrota['descartadas'] = [];
    let enviadas = 0;
    for (const item of itens) {
      try {
        await enviar(item.acao);
        if (item.acao.tipo === 'despesa') await apagarFoto(item.acao.fotoUri);
        enviadas++;
      } catch (err) {
        const status = isAxiosError(err) ? err.response?.status : undefined;
        const negocio = status !== undefined && status >= 400 && status < 500 && status !== 401 && status !== 408 && status !== 429;
        if (negocio) {
          const msg = (isAxiosError(err) && (err.response?.data as { message?: string } | undefined)?.message) || `Rejeitada (HTTP ${status}).`;
          if (item.acao.tipo === 'despesa') await apagarFoto(item.acao.fotoUri);
          descartadas.push({ rotulo: item.rotulo, motivo: String(msg) });
        } else {
          manter.push({ ...item, tentativas: item.tentativas + 1, ultimoErro: status ? `HTTP ${status}` : 'sem conexão' });
        }
      }
    }
    await gravar(manter);
    return { enviadas, descartadas, restantes: manter.length };
  } finally { processando = false; }
}

/** Erro de REDE (sem resposta do servidor) — candidato a enfileirar. */
export function ehErroDeRede(e: unknown): boolean {
  if (!isAxiosError(e)) return false;
  return !e.response; // timeout / sem conexão / DNS — sem status HTTP
}
