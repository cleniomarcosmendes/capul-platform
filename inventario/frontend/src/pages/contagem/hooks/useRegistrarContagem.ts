import { useCallback, useRef, useState } from 'react';
import { inventoryService } from '../../../services/inventory.service';
import { parseApiError } from '../../../utils/errors';

/**
 * Envio da contagem, com o carimbo de contexto e o tratamento dos erros da
 * Fase 0. Existe como hook porque as DUAS telas de contagem (desktop e mobile)
 * fazem exatamente isto — e a lição da onda do RDV é que o que fica duplicado
 * é o que sai de sincronia depois.
 *
 * Duas responsabilidades:
 *
 * 1. **Carimbar** `counting_list_id` + `expected_cycle`. Sem isso o servidor
 *    resolve o ciclo no momento em que a contagem CHEGA — e uma contagem do 1º
 *    ciclo que chegue depois do avanço vira contagem do 2º, sobrescrevendo em
 *    silêncio o trabalho do outro contador.
 *
 * 2. **Conflito de dispositivo**: se a lista está baixada em um aplicativo, o
 *    backend recusa com `LISTA_EM_USO_OUTRO_DISPOSITIVO`. Aqui isso vira uma
 *    pergunta ao usuário, com os dados reais do aparelho — e só se ele
 *    confirmar é que reenviamos com `force`, o que invalida o lease. A decisão
 *    é humana e informada, de propósito: contar aqui pode descartar contagens
 *    que ainda não sincronizaram.
 */

export interface ResultadoContagem {
  ok: boolean;
  /** Código do backend quando falhou (`CICLO_DIVERGENTE`, `LEASE_INVALIDO`, …). */
  codigo?: string | null;
  /** Mensagem pronta para o toast. */
  mensagem?: string;
  /** true quando o usuário cancelou o diálogo de conflito — não é erro, não avisar. */
  cancelado?: boolean;
}

export interface PayloadContagem {
  quantity: number;
  lot_number?: string;
  observation?: string;
  lot_counts?: { lot_number: string; quantity: number }[];
}

interface Conflito {
  itemId: string;
  payload: PayloadContagem;
  aparelho: string;
  desde: string | null;
}

/** "há 2 h", "às 14:22" — o operador decide melhor sabendo há quanto tempo. */
function formatarDesde(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const horas = Math.floor((Date.now() - d.getTime()) / 3_600_000);
  if (horas >= 1) return `desde as ${hora} (há ${horas} h)`;
  return `desde as ${hora}`;
}

export function useRegistrarContagem(ctx: {
  countingListId: string | null;
  currentCycle: number;
}) {
  const [conflito, setConflito] = useState<Conflito | null>(null);
  // Guarda o `resolve` da chamada em curso: a promise de quem chamou só fecha
  // depois que o usuário responde o diálogo.
  const aguardando = useRef<((r: ResultadoContagem) => void) | null>(null);

  const enviar = useCallback(
    async (itemId: string, payload: PayloadContagem, force: boolean): Promise<ResultadoContagem> => {
      try {
        await inventoryService.registrarContagem(itemId, {
          ...payload,
          counting_list_id: ctx.countingListId,
          expected_cycle: ctx.currentCycle,
          ...(force ? { force: true } : {}),
        });
        return { ok: true };
      } catch (err) {
        const { codigo, mensagem, dados } = parseApiError(err, 'Erro ao salvar contagem.');

        if (codigo === 'LISTA_EM_USO_OUTRO_DISPOSITIVO' && !force) {
          const aparelho = typeof dados?.lease_device_id === 'string' ? dados.lease_device_id : '';
          const desde = typeof dados?.lease_at === 'string' ? dados.lease_at : null;
          setConflito({ itemId, payload, aparelho, desde });
          // Não resolve aqui — quem resolve é confirmar()/cancelar().
          return new Promise<ResultadoContagem>((resolve) => {
            aguardando.current = resolve;
          });
        }

        return { ok: false, codigo, mensagem };
      }
    },
    [ctx.countingListId, ctx.currentCycle],
  );

  const registrar = useCallback(
    (itemId: string, payload: PayloadContagem) => enviar(itemId, payload, false),
    [enviar],
  );

  const confirmarForce = useCallback(async () => {
    const c = conflito;
    setConflito(null);
    if (!c) return;
    const r = await enviar(c.itemId, c.payload, true);
    aguardando.current?.(r);
    aguardando.current = null;
  }, [conflito, enviar]);

  const cancelarForce = useCallback(() => {
    setConflito(null);
    aguardando.current?.({ ok: false, cancelado: true });
    aguardando.current = null;
  }, []);

  const sufixo = conflito?.aparelho ? ` (dispositivo …${conflito.aparelho})` : '';
  const dialogo = {
    open: !!conflito,
    title: 'Esta lista está sendo contada em um aplicativo',
    description:
      `A lista foi baixada em um aparelho${sufixo} ${formatarDesde(conflito?.desde ?? null)}. ` +
      `Contar por aqui pode DESCARTAR contagens que ainda não foram sincronizadas.`,
    details: [
      'Se o aparelho está em uso, o certo é aguardar a sincronização.',
      'Se o aparelho foi perdido ou está sem sinal, pode continuar — o aplicativo será avisado ao tentar sincronizar.',
    ],
    variant: 'warning' as const,
    confirmLabel: 'Contar aqui mesmo assim',
    cancelLabel: 'Cancelar',
    onConfirm: confirmarForce,
    onCancel: cancelarForce,
  };

  return { registrar, dialogo };
}
