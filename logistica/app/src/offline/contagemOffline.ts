import AsyncStorage from '@react-native-async-storage/async-storage';
import { INVENTARIO_BASE } from '../api/config';
import { api } from '../api/client';
import { isAxiosError } from 'axios';

/**
 * Contagem offline do Inventário — armazenamento local + envio.
 *
 * ⚠️ DIFERENTE das cinco filas da Logística, e a diferença é o ponto central:
 * baixa, despesa e check-in são **eventos** (cada um é um fato novo, e a fila é
 * um log append). **Contagem é ESTADO**: o operador conta 10, percebe o erro e
 * corrige para 12 — o que vale é o ÚLTIMO valor daquele item, não os dois.
 *
 * Por isso a fila aqui é um MAPA por item, não uma lista. Se fosse append e as
 * duas entradas subissem fora de ordem, gravaria 10. (O servidor ainda tem a
 * defesa do `counted_at_client`, mas depender só dela seria contar com sorte.)
 *
 * Duas coisas separadas no armazenamento, também de propósito:
 *  - **pacote** (`PREFIXO_PACOTE`): os itens a contar. Escrito UMA vez no
 *    download, lido muitas. Nunca reescrito a cada contagem — reescrever ~2 MB
 *    por item contado travaria na mão do operador.
 *  - **contagens** (`PREFIXO_CONTAGENS`): só o que ele digitou. Pequeno, e é
 *    esse que muda.
 */

const PREFIXO_PACOTE = 'capul_contagem_pacote:';
const PREFIXO_CONTAGENS = 'capul_contagem_valores:';
const PREFIXO_LEASE = 'capul_contagem_lease:';

/** Lote congelado no recorte. Sem saldo — ver `baixarItensDaLista`. */
export interface LoteDoItem {
  numero: string;
  lotefor: string;
  /** Validade YYYYMMDD congelada no recorte (migration 021). */
  validade: string | null;
}

export interface ItemContagem {
  id: string;
  product_code: string;
  product_description: string;
  location: string | null;
  warehouse: string | null;
  /**
   * Valor do ciclo corrente CONFIRMADO PELO SERVIDOR.
   *
   * Nasce do download e é ATUALIZADO a cada envio aceito — é isso que faz o
   * item continuar aparecendo como contado depois de sincronizar. Antes o valor
   * saía da fila e a tela caía neste campo ainda com o valor do download, então
   * o número que o contador digitou sumia e o progresso andava para trás.
   */
  contadoNoServidor: number | null;
  /**
   * Supervisor marcou este item ao DEVOLVER a lista (devolução parcial).
   *
   * Sem isto o contador recebe a lista de volta sem saber o que revisar — o
   * desktop mostra badge "Revisar" desde sempre, e o app descartava o campo,
   * que já vinha no payload.
   */
  revisarNoCiclo: boolean;
  motivoRevisao: string | null;
  /** Zero do PREENCHIMENTO do fecho, não de contagem ativa. */
  zeradoNoFecho: boolean;
  /** Produto rastreado: a contagem tem que ser POR LOTE. */
  exigeLote: boolean;
  /** Lotes do recorte (só os que tinham saldo na inclusão). */
  lotes: LoteDoItem[];
}

export interface PacoteContagem {
  listId: string;
  listName: string;
  /** Nome do inventário, armazém e modo — cabeçalho da tela de contagem. */
  inventoryName?: string;
  warehouse?: string;
  cicloEsperado: number;
  baixadoEm: string;
  /** Última sincronização com sucesso — sobrevive a fechar o app. */
  sincronizadoEm?: string;
  itens: ItemContagem[];
}

/** Quantidade contada em um lote específico. */
export interface ContagemDeLote {
  numero: string;
  quantidade: number;
}

/** Uma contagem feita no aparelho, ainda não confirmada pelo servidor. */
export interface ContagemLocal {
  itemId: string;
  /** Total. Em produto com lote, é a SOMA dos lotes — nunca digitado à mão. */
  quantidade: number;
  /** Presente só em produto rastreado. Vira `lot_counts` no envio. */
  lotes?: ContagemDeLote[];
  /** Hora no APARELHO — ordena capturas deste mesmo aparelho (ver 0.4). */
  capturadaEm: string;
  /** Chave de idempotência: reenvio não reprocessa efeito colateral. */
  idempotencyKey: string;
  ultimoErro: string | null;
}

type Listener = (pendentes: number) => void;
const listeners = new Set<Listener>();
const notificar = (qtd: number) => listeners.forEach((l) => l(qtd));
export function onContagensPendentesChange(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

// ---------------------------------------------------------------- pacote

export async function salvarPacote(p: PacoteContagem): Promise<void> {
  await AsyncStorage.setItem(PREFIXO_PACOTE + p.listId, JSON.stringify(p));
}

/**
 * ⚠️ Normaliza o pacote na LEITURA.
 *
 * Um pacote baixado por uma versão anterior do app não tem `exigeLote`/`lotes`/
 * `warehouse` — e o operador pode estar no meio da contagem quando o JS
 * atualiza (fast refresh em DEV, OTA em campo). Sem isto, `item.lotes.length`
 * quebra a tela com a contagem dele presa no aparelho.
 *
 * O padrão é o CONSERVADOR: sem lote. Um produto rastreado que caia aqui é
 * recusado pelo servidor (`CONTAGEM_EXIGE_LOTE`) e reportado ao operador, em vez
 * de gravar contagem errada em silêncio — que é justamente o que a guarda do
 * servidor existe para impedir.
 */
export async function lerPacote(listId: string): Promise<PacoteContagem | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIXO_PACOTE + listId);
    if (!raw) return null;
    const p = JSON.parse(raw) as PacoteContagem;
    return {
      ...p,
      itens: (p.itens ?? []).map((i) => ({
        ...i,
        warehouse: i.warehouse ?? null,
        exigeLote: Boolean(i.exigeLote),
        revisarNoCiclo: Boolean(i.revisarNoCiclo),
        motivoRevisao: i.motivoRevisao ?? null,
        zeradoNoFecho: Boolean(i.zeradoNoFecho),
        lotes: i.lotes ?? [],
      })),
    };
  } catch {
    return null;
  }
}

export async function descartarPacote(listId: string): Promise<void> {
  await AsyncStorage.multiRemove([
    PREFIXO_PACOTE + listId,
    PREFIXO_CONTAGENS + listId,
    PREFIXO_LEASE + listId,
  ]);
  notificar(0);
}

// ---------------------------------------------------------------- lease

export async function salvarLease(listId: string, token: string): Promise<void> {
  await AsyncStorage.setItem(PREFIXO_LEASE + listId, token);
}
export async function lerLease(listId: string): Promise<string | null> {
  return AsyncStorage.getItem(PREFIXO_LEASE + listId);
}

// ------------------------------------------------------------- contagens

async function lerContagens(listId: string): Promise<Record<string, ContagemLocal>> {
  try {
    const raw = await AsyncStorage.getItem(PREFIXO_CONTAGENS + listId);
    return raw ? (JSON.parse(raw) as Record<string, ContagemLocal>) : {};
  } catch {
    return {};
  }
}

async function gravarContagens(listId: string, mapa: Record<string, ContagemLocal>): Promise<void> {
  await AsyncStorage.setItem(PREFIXO_CONTAGENS + listId, JSON.stringify(mapa));
  notificar(Object.keys(mapa).length);
}

/**
 * Registra a contagem de um item. SUBSTITUI o valor anterior daquele item —
 * corrigir de 10 para 12 não gera duas pendências, gera uma valendo 12.
 *
 * A `idempotencyKey` é NOVA a cada correção, de propósito: é uma captura
 * diferente. Reenviar a MESMA captura é que não pode reprocessar.
 */
export async function registrarContagemLocal(
  listId: string,
  itemId: string,
  quantidade: number,
): Promise<void> {
  const mapa = await lerContagens(listId);
  mapa[itemId] = {
    itemId,
    quantidade,
    capturadaEm: new Date().toISOString(),
    idempotencyKey: `${listId}:${itemId}:${Date.now()}`,
    ultimoErro: null,
  };
  await gravarContagens(listId, mapa);
}

/**
 * Registra a contagem de um produto RASTREADO, lote a lote.
 *
 * O total nunca é digitado: é a soma dos lotes. Deixar o operador informar um
 * total que não bate com os lotes criaria uma divergência que nenhuma tela
 * conseguiria explicar depois.
 *
 * Lote sem valor informado NÃO entra — é diferente de lote contado como zero.
 * Zero é uma afirmação ("procurei e não achei"); ausência é "ainda não contei".
 * Quem transforma o que sobrou em zero é o `handoff`, no fecho, com o rastro do
 * `zerado_no_fecho`.
 */
export async function registrarContagemPorLote(
  listId: string,
  itemId: string,
  lotes: ContagemDeLote[],
): Promise<void> {
  const informados = lotes.filter((l) => Number.isFinite(l.quantidade));
  const mapa = await lerContagens(listId);

  if (informados.length === 0) {
    // Apagou tudo: a contagem deixa de existir, não vira zero.
    delete mapa[itemId];
    await gravarContagens(listId, mapa);
    return;
  }

  mapa[itemId] = {
    itemId,
    quantidade: informados.reduce((soma, l) => soma + l.quantidade, 0),
    lotes: informados,
    capturadaEm: new Date().toISOString(),
    idempotencyKey: `${listId}:${itemId}:${Date.now()}`,
    ultimoErro: null,
  };
  await gravarContagens(listId, mapa);
}

/**
 * Apaga a contagem local de um item — o operador limpou o campo.
 *
 * Campo VAZIO é "ainda não contei", diferente de 0 ("procurei e não achei").
 * Por isso limpar REMOVE a pendência em vez de gravar zero.
 */
export async function removerContagemLocal(listId: string, itemId: string): Promise<void> {
  const mapa = await lerContagens(listId);
  if (mapa[itemId] === undefined) return;
  delete mapa[itemId];
  await gravarContagens(listId, mapa);
}

export async function contagensPendentes(listId: string): Promise<ContagemLocal[]> {
  return Object.values(await lerContagens(listId));
}

export async function contarPendentes(listId: string): Promise<number> {
  return Object.keys(await lerContagens(listId)).length;
}

// ------------------------------------------------------------ sincronizar

export interface ResultadoSync {
  enviadas: number;
  /** Recusadas pelo servidor por regra — reenviar não conserta. */
  recusadas: Array<{ itemId: string; codigo: string; mensagem: string }>;
  /** Continuam na fila (rede/servidor fora). */
  restantes: number;
}

/** Códigos em que reenviar NUNCA vai funcionar: o contexto mudou. Vão para o
 *  relatório ao operador em vez de ficar girando na fila para sempre. */
const TERMINAIS = new Set([
  'CICLO_DIVERGENTE',
  'LISTA_DIVERGENTE',
  'LEASE_INVALIDO',
  'LISTA_NAO_ESTA_EM_CONTAGEM',
  'CONTADOR_NAO_ATRIBUIDO',
  'CONTAGEM_DESATUALIZADA',
  // O servidor recusa contagem única em produto rastreado. Reenviar não
  // resolve: ou o pacote é antigo (baixado antes do app tratar lote) ou o
  // recorte marca o produto como rastreado e a captura não tem lote. Sai da
  // fila e é REPORTADA, para o operador refazer pela tela de lotes.
  'CONTAGEM_EXIGE_LOTE',
]);

let sincronizando = false;

/**
 * Envia as contagens pendentes. Single-flight.
 *
 * Cada envio carimba `counting_list_id` + `expected_cycle` (o ciclo de QUANDO
 * se contou) — é isso que impede uma contagem do 1º ciclo, sincronizada depois
 * do avanço, de sobrescrever em silêncio o trabalho do contador do 2º.
 */
export async function sincronizarContagens(listId: string): Promise<ResultadoSync> {
  if (sincronizando) {
    return { enviadas: 0, recusadas: [], restantes: await contarPendentes(listId) };
  }
  sincronizando = true;
  try {
    const pacote = await lerPacote(listId);
    if (!pacote) return { enviadas: 0, recusadas: [], restantes: 0 };

    const leaseToken = await lerLease(listId);
    const mapa = await lerContagens(listId);
    const recusadas: ResultadoSync['recusadas'] = [];
    let enviadas = 0;

    // O envio aceito precisa voltar para o PACOTE, não só sair da fila — senão
    // a tela perde o valor. Ver `ItemContagem.contadoNoServidor`.
    const porId = new Map(pacote.itens.map((i) => [i.id, i]));
    let pacoteMudou = false;

    for (const [itemId, c] of Object.entries(mapa)) {
      try {
        await api.post(`${INVENTARIO_BASE}/inventory/items/${itemId}/count`, {
          quantity: c.quantidade,
          // Produto rastreado: o servidor recusa contagem única (guarda
          // CONTAGEM_EXIGE_LOTE). O total acima é a soma destes.
          ...(c.lotes?.length
            ? { lot_counts: c.lotes.map((l) => ({ lot_number: l.numero, quantity: l.quantidade })) }
            : {}),
          counting_list_id: pacote.listId,
          expected_cycle: pacote.cicloEsperado,
          idempotency_key: c.idempotencyKey,
          counted_at_client: c.capturadaEm,
          ...(leaseToken ? { lease_token: leaseToken } : {}),
        });
        delete mapa[itemId];
        enviadas++;

        const item = porId.get(itemId);
        if (item) {
          item.contadoNoServidor = c.quantidade;
          pacoteMudou = true;
        }
      } catch (err) {
        const detail = isAxiosError(err)
          ? (err.response?.data as { detail?: { erro?: string; mensagem?: string } | string } | undefined)?.detail
          : undefined;
        const codigo = detail && typeof detail === 'object' ? detail.erro ?? '' : '';
        const mensagem =
          detail && typeof detail === 'object'
            ? detail.mensagem ?? 'Recusada pelo servidor.'
            : typeof detail === 'string'
              ? detail
              : 'Sem conexão.';

        if (codigo && TERMINAIS.has(codigo)) {
          // Sai da fila e é REPORTADA. Deixar girando esconderia do operador que
          // o trabalho dele não entrou.
          delete mapa[itemId];
          recusadas.push({ itemId, codigo, mensagem });
        } else {
          mapa[itemId] = { ...c, ultimoErro: mensagem };
        }
      }
    }

    // Ordem importa: o pacote primeiro. Se o app morrer entre os dois, o pior
    // caso é uma contagem que já subiu continuar na fila — e o reenvio é
    // idempotente. O inverso perderia o valor da tela.
    // Carimba a sincronização: depois que a fila zera, sem isto não sobra
    // nenhum vestígio de que algo subiu.
    if (enviadas > 0) {
      pacote.sincronizadoEm = new Date().toISOString();
      pacoteMudou = true;
    }
    if (pacoteMudou) await salvarPacote(pacote);
    await gravarContagens(listId, mapa);
    return { enviadas, recusadas, restantes: Object.keys(mapa).length };
  } finally {
    sincronizando = false;
  }
}
