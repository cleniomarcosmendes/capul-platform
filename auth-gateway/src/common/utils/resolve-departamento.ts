import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { getDefaultDepartamentoId } from './default-departamento';

/**
 * Resolve o `departamento_id` de uma operação seguindo a cascata
 * (Onda 1 Sub-fase 1.6.1):
 *
 *  1. `dtoDepartamentoId` — DTO envia explícito (UI multi-perfil)
 *  2. `user.modulos[X].departamentos[0].id` — depto onde o user OPERA
 *     no módulo (do JWT, Sub-fase 1.4)
 *  3. Fallback `getDefaultDepartamentoId(prisma)` → T.I.
 *
 * Espelho do helper análogo em `gestao-ti/backend/src/common/helpers/`.
 * Usado pela atribuição de permissões (`atribuirPermissao`).
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
