import { PrismaService } from '../../prisma/prisma.service.js';
import { JwtPayload } from '../interfaces/jwt-payload.interface.js';
import { getDefaultDepartamentoId } from './default-departamento.helper.js';

/**
 * Resolve o `departamento_id` de uma operação no módulo Workspace seguindo
 * uma cascata que respeita o conceito de workspace (Onda 1 Sub-fase 1.6.1).
 *
 * Cascata:
 *  1. `dtoDepartamentoId` — UI multi-perfil envia explícito (Sub-fase 1.6.2+)
 *  2. `user.modulos[X].departamentos[0].id` — depto onde o user OPERA no
 *     módulo (do JWT, Sub-fase 1.4). Esta é a fonte de verdade do workspace.
 *  3. Fallback `getDefaultDepartamentoId(prisma)` — só atinge call sites
 *     sem `user` (import, seed). Retorna o depto T.I.
 *
 * Comportamento em DEV (todos os users com 1 perfil só = T.I.):
 *  - Path 1 não dispara (UI não envia DTO ainda)
 *  - Path 2 retorna T.I.
 *  - Path 3 não atinge
 *  Resultado: igual ao comportamento pré Sub-fase 1.6.1 (sem regressão).
 *
 * Comportamento futuro (Onda 2, quando outros deptos forem cadastrados):
 *  - Users de Fiscal/Controladoria terão `modulos[X].departamentos[0].id`
 *    apontando pro próprio depto operacional → workspace isolado funciona.
 */
export async function resolveDepartamento(
  prisma: PrismaService,
  user: JwtPayload | null,
  moduloCodigo: string,
  dtoDepartamentoId?: string,
): Promise<string> {
  if (dtoDepartamentoId) return dtoDepartamentoId;

  const fromJwt = user?.modulos
    ?.find((m) => m.codigo === moduloCodigo)
    ?.departamentos?.[0]?.id;
  if (fromJwt) return fromJwt;

  return getDefaultDepartamentoId(prisma);
}
