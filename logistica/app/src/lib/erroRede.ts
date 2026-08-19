import { isAxiosError } from 'axios';

/**
 * "Foi a REDE que faltou" × "o SERVIDOR respondeu e recusou".
 *
 * Essa distinção é a espinha do modo offline do app inteiro, e por isso mora
 * aqui — fora das filas — em vez de duplicada dentro de cada uma:
 *
 *  - **filas de escrita**: sem rede a ação FICA guardada e reenvia; recusa do
 *    servidor (4xx) é definitiva, descarta e reporta;
 *  - **cache de leitura**: sem rede cai no que está no aparelho; erro HTTP
 *    sobe, porque o servidor falou e mentir sobre isso esconde o problema;
 *  - **sessão**: sem rede a sessão CONTINUA; só rejeição do auth-gateway
 *    desloga (ver `auth/AuthContext.tsx`).
 *
 * Sem `response` = nunca houve resposta HTTP: DNS, timeout, socket, avião.
 */
export function ehErroDeRede(e: unknown): boolean {
  if (!isAxiosError(e)) return false;
  return !e.response;
}
