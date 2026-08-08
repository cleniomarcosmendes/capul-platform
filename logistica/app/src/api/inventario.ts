import { api } from './client';
import { INVENTARIO_BASE } from './config';

/**
 * Cliente do módulo INVENTÁRIO no app — contagem.
 *
 * O papel do usuário aqui é o do módulo INVENTARIO (ADMIN/SUPERVISOR/OPERATOR),
 * não o da Logística: a mesma pessoa pode ser OPERADOR_ENTREGA lá e OPERATOR
 * aqui. Ver `papelInventario` em `lib/jwt`.
 */

export interface MinhaListaContagem {
  id: string;
  list_name: string;
  current_cycle: number;
  list_status: string;
  inventory_id: string;
  inventory_name: string;
  warehouse: string;
  count_deadline: string | null;
  total_items: number;
  counted_items: number;
  pending_items: number;
  progress_percentage: number;
  /** Lease: a lista pode estar baixada em OUTRO aparelho (ou neste). */
  lease_ativo?: boolean;
  lease_device_id?: string | null;
  lease_at?: string | null;
}

/** Listas em que o usuário é o contador do ciclo atual e que estão liberadas. */
export async function listarMinhasListas(): Promise<MinhaListaContagem[]> {
  const { data } = await api.get<{ items: MinhaListaContagem[]; total: number }>(
    `${INVENTARIO_BASE}/counting-lists/me`,
  );
  return data.items ?? [];
}

/**
 * Retira a lista para contagem neste aparelho e devolve o `lease_token`, que
 * acompanha cada contagem enviada depois.
 *
 * Pode falhar com:
 *  - `LISTA_ACIMA_DO_TETO` — lista grande demais para o aparelho (o supervisor
 *    precisa dividi-la; no desktop ela continua contável);
 *  - `LISTA_EM_USO_OUTRO_DISPOSITIVO` — já está baixada em outro aparelho;
 *  - `CONTADOR_NAO_ATRIBUIDO` / `LISTA_NAO_ESTA_EM_CONTAGEM`.
 */
export async function retirarLista(listId: string, deviceId: string): Promise<{ lease_token: string }> {
  const { data } = await api.post<{ lease_token: string; counting_list_id: string }>(
    `${INVENTARIO_BASE}/counting-lists/${listId}/checkout`,
    { device_id: deviceId },
  );
  return data;
}

/** Devolve a lista (fim da contagem offline). */
export async function devolverLista(listId: string, leaseToken: string): Promise<void> {
  await api.delete(`${INVENTARIO_BASE}/counting-lists/${listId}/checkout`, {
    params: { lease_token: leaseToken },
  });
}

/**
 * Contador ENTREGA a lista para revisão do supervisor —
 * `EM_CONTAGEM → AGUARDANDO_REVISAO`.
 *
 * É o ato que fecha o trabalho do contador e é o que faltava no app: o
 * `Encerrar` daqui só devolvia o lease, então a lista ficava EM_CONTAGEM para
 * sempre e o supervisor nunca era avisado. Desktop e mobile-web já faziam isto.
 *
 * ⚠️ **Itens não contados no ciclo viram ZERO** no servidor. É a forma de dizer
 * "varri a lista, o que sobrou eu não achei" — e por isso a tela confirma antes.
 *
 * ⚠️ O servidor NÃO verifica o lease aqui, e não tem como saber que existe
 * contagem presa neste aparelho. Se sobrar pendência, ela é perdida: os itens
 * são zerados e a lista sai de EM_CONTAGEM, então o envio posterior seria
 * recusado. Sincronizar antes é responsabilidade do cliente.
 *
 * Devolve quantos itens foram preenchidos com zero.
 */
export async function liberarParaSupervisor(
  listId: string,
): Promise<{ status: string; zerados: number }> {
  const { data } = await api.post<{ status: string; zerados: number }>(
    `${INVENTARIO_BASE}/counting-lists/${listId}/handoff`,
  );
  return data;
}

interface LoteDoServidor {
  lot_number?: string | null;
  b8_lotefor?: string | null;
  /** Validade YYYYMMDD congelada (migration 021). */
  b8_dtvalid?: string | null;
  /** Saldo do sistema. NÃO vem para OPERATOR — a contagem cega o remove. */
  quantity?: number | null;
}

interface ProdutoDaLista {
  id: string;
  product_code: string;
  product_description?: string;
  product_name?: string;
  location?: string | null;
  warehouse?: string | null;
  count_cycle_1?: number | null;
  count_cycle_2?: number | null;
  count_cycle_3?: number | null;
  current_cycle?: number;
  /** `b1_rastro` L/S do recorte — a contagem tem que ser POR LOTE. */
  requires_lot?: boolean;
  has_lot?: boolean;
  /** Lotes congelados na inclusão (só os com saldo > 0). */
  snapshot_lots?: LoteDoServidor[];
  /** Supervisor marcou este item para revisão ao devolver a lista (migration 012). */
  revisar_no_ciclo?: boolean;
  motivo_revisao?: string | null;
  /** Este zero veio do PREENCHIMENTO do handoff, não de contagem ativa (015). */
  zerado_no_fecho?: boolean;
}

/**
 * Baixa os itens da lista para contagem offline.
 *
 * Reusa o endpoint que a tela web já usa — ele JÁ aplica a projeção da contagem
 * cega (para OPERATOR não vem saldo do sistema nem ciclo anterior), que é
 * exatamente o que não pode ficar gravado no aparelho. O app guarda só os
 * campos enxutos: ~168 B/item em vez dos ~640 B que trafegam.
 *
 * Os LOTES entram nesse mesmo pacote, e não em chave separada, porque o volume
 * real é pequeno: medido em 08/08/2026 sobre os armazéns 02 e 06, os lotes que o
 * snapshot congela (saldo > 0 e não vencidos na data de referência) dão **1,0 por
 * item em média, máximo 10** — a base inteira dos dois armazéns cabe em ~140 KB.
 *
 * ⚠️ É o FILTRO que torna isso viável. Sem ele seriam 7,2 por item e até 108 num
 * produto só — 86% dos lotes têm saldo zero. Quem cobre o lote fora da lista é o
 * "informar outro lote" na tela, não um pacote gigante. Se o teto de 3.000 itens
 * por lista subir muito, refazer a conta.
 *
 * O saldo POR LOTE não é gravado: para OPERATOR ele nem vem (a projeção da
 * contagem cega o remove desde 08/08), e guardá-lo no aparelho é exatamente o
 * que a contagem cega existe para impedir.
 */
export interface LoteDoItem {
  /** `b8_lotectl` — o lote de controle. */
  numero: string;
  /** `b8_lotefor` — lote do fornecedor, o que costuma estar impresso na caixa. */
  lotefor: string;
  /** `b8_dtvalid` YYYYMMDD congelado. Nao e saldo — o contador pode ver. */
  validade: string | null;
}

export interface ItemBaixado {
  id: string;
  /** Marcado pelo supervisor na devolução — o contador precisa saber O QUE revisar. */
  revisarNoCiclo: boolean;
  motivoRevisao: string | null;
  /** Zero que veio do fecho, não de contagem — distinguir evita recontagem à toa. */
  zeradoNoFecho: boolean;
  product_code: string;
  product_description: string;
  location: string | null;
  warehouse: string | null;
  contadoNoServidor: number | null;
  exigeLote: boolean;
  lotes: LoteDoItem[];
}

export async function baixarItensDaLista(
  listId: string,
): Promise<{ ciclo: number; itens: ItemBaixado[] }> {
  const { data } = await api.get<{ data: { products: ProdutoDaLista[]; current_cycle: number } }>(
    `${INVENTARIO_BASE}/counting-lists/${listId}/products`,
    { params: { show_all: true } },
  );
  const ciclo = data.data.current_cycle ?? 1;
  const campo = (`count_cycle_${ciclo}`) as 'count_cycle_1' | 'count_cycle_2' | 'count_cycle_3';

  return {
    ciclo,
    itens: (data.data.products ?? []).map((p) => ({
      id: p.id,
      product_code: p.product_code,
      product_description: p.product_description || p.product_name || '',
      location: p.location ?? null,
      warehouse: p.warehouse ?? null,
      // Só o ciclo CORRENTE. Ciclos anteriores nem vêm para o OPERATOR (contagem
      // cega) e não teriam uso aqui.
      contadoNoServidor: p[campo] ?? null,
      revisarNoCiclo: Boolean(p.revisar_no_ciclo),
      motivoRevisao: (p.motivo_revisao ?? '').trim() || null,
      zeradoNoFecho: Boolean(p.zerado_no_fecho),
      exigeLote: Boolean(p.requires_lot ?? p.has_lot),
      lotes: (p.snapshot_lots ?? [])
        .map((l) => ({
          numero: (l.lot_number ?? '').trim(),
          lotefor: (l.b8_lotefor ?? '').trim(),
          validade: (l.b8_dtvalid ?? '').trim() || null,
        }))
        .filter((l) => l.numero !== ''),
    })),
  };
}
