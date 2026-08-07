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

interface ProdutoDaLista {
  id: string;
  product_code: string;
  product_description?: string;
  product_name?: string;
  location?: string | null;
  count_cycle_1?: number | null;
  count_cycle_2?: number | null;
  count_cycle_3?: number | null;
  current_cycle?: number;
}

/**
 * Baixa os itens da lista para contagem offline.
 *
 * Reusa o endpoint que a tela web já usa — ele JÁ aplica a projeção da contagem
 * cega (para OPERATOR não vem saldo do sistema nem ciclo anterior), que é
 * exatamente o que não pode ficar gravado no aparelho. O app guarda só os
 * campos enxutos: ~168 B/item em vez dos ~640 B que trafegam.
 */
export async function baixarItensDaLista(
  listId: string,
): Promise<{ ciclo: number; itens: Array<{ id: string; product_code: string; product_description: string; location: string | null; contadoNoServidor: number | null }> }> {
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
      // Só o ciclo CORRENTE. Ciclos anteriores nem vêm para o OPERATOR (contagem
      // cega) e não teriam uso aqui.
      contadoNoServidor: p[campo] ?? null,
    })),
  };
}
