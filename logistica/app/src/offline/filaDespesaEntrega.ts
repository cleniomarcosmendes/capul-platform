import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { isAxiosError } from 'axios';
import { lancarDespesaEntrega } from '../api/viagens';
import type { DespesaViagemPayload } from '../api/frota';

/**
 * Fila offline da DESPESA da ROTA DE ENTREGA. O entregador abastece o veículo na
 * rua, com sinal ruim: a despesa (e as fotos do cupom) que falhar por REDE entra
 * aqui e é reenviada quando o sinal voltar. Sem token de condutor (o entregador é
 * o dono da rota). Idempotência via idempotencyKey (backend dedupe).
 *
 * Política de reenvio (igual às filas de baixa/frota): sucesso → remove + apaga
 * fotos; erro de NEGÓCIO (4xx ≠ 401/408/429) → remove e reporta; rede/5xx/401 → mantém.
 */
export interface ItemDespesaEntrega {
  id: string;          // = idempotencyKey
  rotulo: string;      // texto curto p/ o banner ("Despesa R$ 120,00")
  viagemId: string;
  payload: DespesaViagemPayload;
  fotoUris: string[];  // fotos copiadas p/ a pasta do app
  criadoEm: string;
  tentativas: number;
  ultimoErro: string | null;
}

const KEY = 'capul_fila_despesa_entrega';
const DIR = `${FileSystem.documentDirectory}despesa-entrega/`;

type Listener = (pendentes: number) => void;
const listeners = new Set<Listener>();
const notificar = (qtd: number) => listeners.forEach((l) => l(qtd));
export function onFilaDespesaEntregaChange(l: Listener): () => void { listeners.add(l); return () => listeners.delete(l); }

async function ler(): Promise<ItemDespesaEntrega[]> {
  try { const raw = await AsyncStorage.getItem(KEY); return raw ? (JSON.parse(raw) as ItemDespesaEntrega[]) : []; }
  catch { return []; }
}
async function gravar(itens: ItemDespesaEntrega[]) { await AsyncStorage.setItem(KEY, JSON.stringify(itens)); notificar(itens.length); }
export async function contarPendentesDespesaEntrega(): Promise<number> { return (await ler()).length; }

async function apagarFotos(uris: string[]) {
  for (const uri of uris) await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
}

/** Enfileira uma despesa que falhou por rede (fotos copiadas p/ a pasta do app). */
export async function enfileirarDespesaEntrega(item: { id: string; rotulo: string; viagemId: string; payload: DespesaViagemPayload; fotoUris: string[] }): Promise<void> {
  let fotoUris = item.fotoUris;
  if (fotoUris.length) {
    await FileSystem.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => undefined);
    const destinos: string[] = [];
    for (let i = 0; i < fotoUris.length; i++) {
      const dest = `${DIR}${item.id}-${i}.jpg`;
      await FileSystem.copyAsync({ from: fotoUris[i], to: dest });
      destinos.push(dest);
    }
    fotoUris = destinos;
  }
  const itens = await ler();
  if (itens.some((i) => i.id === item.id)) return; // já enfileirado
  itens.push({ id: item.id, rotulo: item.rotulo, viagemId: item.viagemId, payload: item.payload, fotoUris, criadoEm: new Date().toISOString(), tentativas: 0, ultimoErro: null });
  await gravar(itens);
}

export interface ResultadoFilaDespesaEntrega { enviadas: number; descartadas: Array<{ rotulo: string; motivo: string }>; restantes: number }
let processando = false;

/** Reenvia tudo (single-flight). Chamar ao focar a tela da rota e após lançar online. */
export async function processarFilaDespesaEntrega(): Promise<ResultadoFilaDespesaEntrega> {
  if (processando) return { enviadas: 0, descartadas: [], restantes: await contarPendentesDespesaEntrega() };
  processando = true;
  try {
    const itens = await ler();
    const manter: ItemDespesaEntrega[] = [];
    const descartadas: ResultadoFilaDespesaEntrega['descartadas'] = [];
    let enviadas = 0;
    for (const item of itens) {
      try {
        await lancarDespesaEntrega(item.payload, item.fotoUris);
        await apagarFotos(item.fotoUris);
        enviadas++;
      } catch (err) {
        const status = isAxiosError(err) ? err.response?.status : undefined;
        const negocio = status !== undefined && status >= 400 && status < 500 && status !== 401 && status !== 408 && status !== 429;
        if (negocio) {
          const msg = (isAxiosError(err) && (err.response?.data as { message?: string } | undefined)?.message) || `Rejeitada (HTTP ${status}).`;
          await apagarFotos(item.fotoUris);
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
