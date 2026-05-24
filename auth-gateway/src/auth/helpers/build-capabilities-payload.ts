import { PrismaService } from '../../prisma/prisma.service';

/**
 * Monta o array `capabilities[]` do JWT payload — strings das capabilities
 * ATIVAS do usuário em `core.usuario_capability`.
 *
 * Onda 3 S0 (24/05) — substitui o bypass automático que ADMIN tinha em
 * cadastros operacionais (D36) por capability explícita.
 *
 * Semântica das capabilities atuais:
 *  - `OVERSIGHT_PLATAFORMA` — bypass de leitura + escrita em Software/Licença/
 *    Contrato/NF/Ativo/Parada (auditor da plataforma). Só user 'admin' tem.
 *  - `FISCAL_CONSULTA_SOCIOS` — LGPD. Validada on-demand contra DB (defesa em
 *    profundidade pra PII), mas listada aqui pra UI/menus reagirem ao toggle.
 *
 * Chamada nos 4 sites onde o JWT é assinado: login, refresh, mfa-verify,
 * impersonate (auth.service.ts).
 */
export async function buildCapabilitiesPayload(
  prisma: PrismaService,
  usuarioId: string,
): Promise<string[]> {
  const rows = await prisma.usuarioCapability.findMany({
    where: { usuarioId, ativo: true },
    select: { capability: true },
  });
  return rows.map((r) => r.capability);
}
