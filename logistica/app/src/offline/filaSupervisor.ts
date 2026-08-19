import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { isAxiosError } from 'axios';
import { adicionarVisitaApp, apontarVisitaApp, lancarDespesaApp, type NovaVisita, type NovaDespesa } from '../api/supervisor';

/**
 * Fila offline do SUPERVISOR (campo). O supervisor visita fazendas na zona rural,
 * onde o sinal cai: visita, apontamento (realizar/pular) e despesa (com foto) que
 * falharem por REDE entram aqui e são reenviados quando o sinal voltar. O workflow
 * (enviar/iniciar/concluir) NÃO entra — é feito com conexão.
 *
 * Usa o JWT do usuário logado (sem condutorToken, ≠ frota). Idempotência: visita e
 * despesa carregam idempotencyKey (backend dedupe); apontar é por paradaId+status
 * (reexecutar é no-op). Política igual às outras filas: sucesso → remove; erro de
 * NEGÓCIO (4xx ≠ 401/408/429) → remove e reporta; rede/5xx/401 → mantém.
 */
export type AcaoSupervisor =
  | { tipo: 'visita'; viagemId: string; payload: NovaVisita }
  | { tipo: 'apontar'; viagemId: string; paradaId: string; status: 'REALIZADA' | 'PULADA'; latitude?: number; longitude?: number; precisaoM?: number; noLocal?: boolean; motivoPulada?: string; observacao?: string }
  | { tipo: 'despesa'; viagemId: string; payload: NovaDespesa; fotoUris: string[] };

export interface ItemSupervisor {
  id: string;          // idempotencyKey (visita/despesa) ou uuid local (apontar)
  rotulo: string;      // texto curto p/ o banner ("Visita: Fulano")
  acao: AcaoSupervisor;
  criadoEm: string;
  tentativas: number;
  ultimoErro: string | null;
}

const KEY = 'capul_fila_supervisor';
const DIR = `${FileSystem.documentDirectory}supervisor/`;

type Listener = (pendentes: number) => void;
const listeners = new Set<Listener>();
const notificar = (qtd: number) => listeners.forEach((l) => l(qtd));
export function onFilaSupervisorChange(l: Listener): () => void { listeners.add(l); return () => listeners.delete(l); }

async function ler(): Promise<ItemSupervisor[]> {
  try { const raw = await AsyncStorage.getItem(KEY); return raw ? (JSON.parse(raw) as ItemSupervisor[]) : []; }
  catch { return []; }
}
async function gravar(itens: ItemSupervisor[]) { await AsyncStorage.setItem(KEY, JSON.stringify(itens)); notificar(itens.length); }
export async function contarPendentesSupervisor(): Promise<number> { return (await ler()).length; }

/**
 * Visitas já apontadas NO APARELHO, esperando sinal (paradaId → o que foi feito).
 *
 * Mesmo mecanismo do `baixasNaFilaPorEntrega` (entrega) e do
 * `paradasNaFilaFrota` (frota), pela mesma razão: o status vem do servidor, que
 * offline não recebeu nada. Sem isto o supervisor apontava a visita sem sinal e
 * ela continuava PLANEJADA na tela, com os botões "Realizar/Pular" ali —
 * parecia que não pegou e convidava a apontar de novo.
 */
export async function visitasNaFilaSupervisor(): Promise<Record<string, 'REALIZADA' | 'PULADA'>> {
  const mapa: Record<string, 'REALIZADA' | 'PULADA'> = {};
  for (const item of await ler()) {
    if (item.acao.tipo === 'apontar') mapa[item.acao.paradaId] = item.acao.status;
  }
  return mapa;
}

async function apagarFotos(uris: string[]) {
  for (const uri of uris) await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
}

/** Enfileira uma ação que falhou por rede (foto da despesa copiada p/ pasta do app). */
export async function enfileirarSupervisor(item: { id: string; rotulo: string; acao: AcaoSupervisor }): Promise<void> {
  let acao = item.acao;
  if (acao.tipo === 'despesa' && acao.fotoUris.length) {
    await FileSystem.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => undefined);
    const destinos: string[] = [];
    for (let i = 0; i < acao.fotoUris.length; i++) {
      const dest = `${DIR}${item.id}-${i}.jpg`;
      await FileSystem.copyAsync({ from: acao.fotoUris[i], to: dest });
      destinos.push(dest);
    }
    acao = { ...acao, fotoUris: destinos };
  }
  const itens = await ler();
  if (itens.some((i) => i.id === item.id)) return; // já enfileirado
  itens.push({ id: item.id, rotulo: item.rotulo, acao, criadoEm: new Date().toISOString(), tentativas: 0, ultimoErro: null });
  await gravar(itens);
}

async function enviar(acao: AcaoSupervisor): Promise<void> {
  switch (acao.tipo) {
    case 'visita': return await adicionarVisitaApp(acao.viagemId, acao.payload);
    case 'apontar': return await apontarVisitaApp(acao.viagemId, acao.paradaId, acao.status, { latitude: acao.latitude, longitude: acao.longitude, precisaoM: acao.precisaoM, noLocal: acao.noLocal, motivoPulada: acao.motivoPulada, observacao: acao.observacao });
    // O reenvio da fila descarta a situação devolvida (PENDENTE/APROVADA): quem a usa
    // é o aviso do lançamento online; aqui a tela recarrega e mostra o estado real.
    case 'despesa': { await lancarDespesaApp(acao.viagemId, acao.payload, acao.fotoUris); return; }
  }
}

export interface ResultadoFilaSupervisor { enviadas: number; descartadas: Array<{ rotulo: string; motivo: string }>; restantes: number }
let processando = false;

/** Reenvia tudo (single-flight). Chamar ao focar a tela e após ação online. */
export async function processarFilaSupervisor(): Promise<ResultadoFilaSupervisor> {
  if (processando) return { enviadas: 0, descartadas: [], restantes: await contarPendentesSupervisor() };
  processando = true;
  try {
    const itens = await ler();
    const manter: ItemSupervisor[] = [];
    const descartadas: ResultadoFilaSupervisor['descartadas'] = [];
    let enviadas = 0;
    for (const item of itens) {
      try {
        await enviar(item.acao);
        if (item.acao.tipo === 'despesa') await apagarFotos(item.acao.fotoUris);
        enviadas++;
      } catch (err) {
        const status = isAxiosError(err) ? err.response?.status : undefined;
        const negocio = status !== undefined && status >= 400 && status < 500 && status !== 401 && status !== 408 && status !== 429;
        if (negocio) {
          const msg = (isAxiosError(err) && (err.response?.data as { message?: string } | undefined)?.message) || `Rejeitada (HTTP ${status}).`;
          if (item.acao.tipo === 'despesa') await apagarFotos(item.acao.fotoUris);
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

// Fonte única em `lib/erroRede`. Reexportado porque a tela do supervisor
// importa daqui.
export { ehErroDeRede } from '../lib/erroRede';
