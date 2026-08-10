import AsyncStorage from '@react-native-async-storage/async-storage';
import { isAxiosError } from 'axios';
import { iniciarEntrega, encerrarEntrega } from '../api/viagens';

/**
 * Fila offline do KM de saída/retorno da ROTA DE ENTREGA. O entregador pode
 * iniciar/encerrar a entrega em local sem sinal; o KM (hodômetro do painel) que
 * falhar por REDE entra aqui e é reenviado quando a conexão voltar.
 *
 * ⚠️ ORDEM — os dois tipos vão em pontas OPOSTAS do reenvio, e é por isso que
 * `processarFilaKmEntrega` aceita `apenas`:
 *
 * - **'iniciar' vai PRIMEIRO, antes das baixas.** O servidor recusa baixa em rota
 *   sem KM de saída (`entrega.service.ts`). Mandar as baixas antes do KM fazia o
 *   servidor devolver 400, e a fila de baixas trata 4xx como rejeição definitiva:
 *   **descartava a baixa e apagava a foto** — perdia a prova de entrega de quem
 *   trabalhou offline exatamente como mandamos ele trabalhar.
 * - **'encerrar' vai POR ÚLTIMO**, depois de baixas e despesas. Ele conclui a rota
 *   e é terminal; subindo antes, o servidor recusaria por causa das entregas ainda
 *   sem baixa (as que estão na fila, prestes a subir).
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

/**
 * Reenvia o KM pendente (single-flight, FIFO).
 *
 * `apenas` seleciona a ponta do reenvio (ver o bloco de ORDEM no topo): chame com
 * `'iniciar'` ANTES das filas de baixa/despesa e com `'encerrar'` DEPOIS delas. O
 * que não bate com o filtro fica intocado na fila para a outra chamada. Sem
 * `apenas`, processa tudo — só serve quando não há baixa nem despesa em jogo.
 */
export async function processarFilaKmEntrega(
  opts?: { apenas?: AcaoKmEntrega['tipo'] },
): Promise<ResultadoFilaKmEntrega> {
  if (processando) return { enviadas: 0, descartadas: [], restantes: await contarPendentesKmEntrega() };
  processando = true;
  try {
    const itens = await ler();
    const manter: ItemKmEntrega[] = [];
    const descartadas: ResultadoFilaKmEntrega['descartadas'] = [];
    let enviadas = 0;
    for (const item of itens) {
      // Fora do filtro: não é a vez dele, volta para a fila sem contar tentativa.
      if (opts?.apenas && item.acao.tipo !== opts.apenas) {
        manter.push(item);
        continue;
      }
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
