import AsyncStorage from '@react-native-async-storage/async-storage';
import { isAxiosError } from 'axios';
import { iniciarEntrega, encerrarEntrega } from '../api/viagens';

/**
 * Fila offline do KM de saída/retorno da ROTA DE ENTREGA. O entregador pode
 * iniciar/encerrar a entrega em local sem sinal; o KM (hodômetro do painel) que
 * falhar por REDE entra aqui e é reenviado quando a conexão voltar.
 *
 * ⚠️ ORDEM: 'encerrar' CONCLUI a rota (baixa as entregas restantes SEM prova e
 * libera o veículo). Por isso esta fila deve ser processada DEPOIS das filas de
 * baixa e de despesa — senão o encerrar concluiria a rota antes de uma baixa (com
 * foto) ainda pendente, perdendo a prova. Os sites de reenvio garantem essa ordem.
 *
 * Idempotência: id determinístico por (viagem, tipo) — reenfileirar a mesma ação
 * não duplica; 'iniciar' reaplicado é no-op (grava o mesmo KM); 'encerrar' é
 * removido no sucesso (não reenvia). Sem fotos. Política igual às outras filas.
 */
export type AcaoKmEntrega =
  | { tipo: 'iniciar'; viagemId: string; kmInicial: number }
  | { tipo: 'encerrar'; viagemId: string; kmFinal: number };

export interface ItemKmEntrega {
  id: string;          // determinístico: km-ini-<viagemId> | km-fim-<viagemId>
  rotulo: string;      // texto curto p/ o banner ("KM retorno 12500")
  acao: AcaoKmEntrega;
  criadoEm: string;
  tentativas: number;
  ultimoErro: string | null;
}

const KEY = 'capul_fila_km_entrega';

type Listener = (pendentes: number) => void;
const listeners = new Set<Listener>();
const notificar = (qtd: number) => listeners.forEach((l) => l(qtd));
export function onFilaKmEntregaChange(l: Listener): () => void { listeners.add(l); return () => listeners.delete(l); }

async function ler(): Promise<ItemKmEntrega[]> {
  try { const raw = await AsyncStorage.getItem(KEY); return raw ? (JSON.parse(raw) as ItemKmEntrega[]) : []; }
  catch { return []; }
}
async function gravar(itens: ItemKmEntrega[]) { await AsyncStorage.setItem(KEY, JSON.stringify(itens)); notificar(itens.length); }
export async function contarPendentesKmEntrega(): Promise<number> { return (await ler()).length; }

/** id determinístico por (viagem, tipo) — impede duplicata e mantém a ordem saída→retorno. */
export function idKmEntrega(acao: AcaoKmEntrega): string {
  return acao.tipo === 'iniciar' ? `km-ini-${acao.viagemId}` : `km-fim-${acao.viagemId}`;
}

/** Enfileira o KM (saída/retorno) que falhou por rede. */
export async function enfileirarKmEntrega(acao: AcaoKmEntrega): Promise<void> {
  const id = idKmEntrega(acao);
  const rotulo = acao.tipo === 'iniciar' ? `KM saída ${acao.kmInicial}` : `KM retorno ${acao.kmFinal}`;
  const itens = await ler();
  if (itens.some((i) => i.id === id)) return; // já enfileirado (mesma viagem+tipo)
  itens.push({ id, rotulo, acao, criadoEm: new Date().toISOString(), tentativas: 0, ultimoErro: null });
  await gravar(itens);
}

async function enviar(acao: AcaoKmEntrega): Promise<void> {
  switch (acao.tipo) {
    case 'iniciar': await iniciarEntrega(acao.viagemId, acao.kmInicial); return;
    case 'encerrar': await encerrarEntrega(acao.viagemId, acao.kmFinal); return;
  }
}

export interface ResultadoFilaKmEntrega { enviadas: number; descartadas: Array<{ rotulo: string; motivo: string }>; restantes: number }
let processando = false;

/** Reenvia tudo (single-flight, FIFO). Chamar SEMPRE depois das filas de baixa e despesa. */
export async function processarFilaKmEntrega(): Promise<ResultadoFilaKmEntrega> {
  if (processando) return { enviadas: 0, descartadas: [], restantes: await contarPendentesKmEntrega() };
  processando = true;
  try {
    const itens = await ler();
    const manter: ItemKmEntrega[] = [];
    const descartadas: ResultadoFilaKmEntrega['descartadas'] = [];
    let enviadas = 0;
    for (const item of itens) {
      try {
        await enviar(item.acao);
        enviadas++;
      } catch (err) {
        const status = isAxiosError(err) ? err.response?.status : undefined;
        const negocio = status !== undefined && status >= 400 && status < 500 && status !== 401 && status !== 408 && status !== 429;
        if (negocio) {
          const msg = (isAxiosError(err) && (err.response?.data as { message?: string } | undefined)?.message) || `Rejeitada (HTTP ${status}).`;
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
