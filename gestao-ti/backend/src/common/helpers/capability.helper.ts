import { JwtPayload } from '../interfaces/jwt-payload.interface.js';

/**
 * Capabilities globais reconhecidas pelo módulo Workspace (Onda 3 S0).
 *
 * - OVERSIGHT_PLATAFORMA: bypass de leitura + escrita em cadastros operacionais
 *   (Software/Licença/Contrato/NF/Ativo/Parada). Olho fiscalizador da
 *   plataforma. Concedido só a 'admin' por padrão.
 *
 * Capabilities sensíveis LGPD (ex: FISCAL_CONSULTA_SOCIOS) são validadas
 * on-demand contra o DB em cada módulo dono — não usar este helper pra elas.
 */
export type Capability = 'OVERSIGHT_PLATAFORMA';

/**
 * Verifica se o user tem a capability ativa, lendo do JWT (cache rápido).
 * JWT é refrescado a cada login (max 60min sem renovar) — revogação de
 * capability operacional propaga em até 60min.
 */
export function hasCapability(
  user: JwtPayload | null | undefined,
  cap: Capability,
): boolean {
  return user?.capabilities?.includes(cap) ?? false;
}
