import { PrismaService } from '../../prisma/prisma.service';

/**
 * Retorna o ID do departamento "Tecnologia da Informacao" (T.I.).
 *
 * Helper TEMPORÁRIO da Onda 1 Sub-fase 1.2 (Workspace Multi-Departamento)
 * espelhando o helper de mesmo nome em `gestao-ti/backend`. Após adicionar
 * `departamento_id NOT NULL` em `core.permissoes_modulo`, todos os
 * `prisma.permissaoModulo.create/upsert` passaram a exigir o campo.
 * Como a Sub-fase 1.2 é "schema only" e a derivação de departamento via
 * contexto (DTO/JWT) só entra na Sub-fase 1.5 com a UI Configurador
 * multi-perfil, este helper preenche o gap com o depto T.I. como default —
 * preservando o comportamento atual (tudo é T.I.).
 *
 * TODO Onda 1 Sub-fase 1.5 / 1.6: trocar este helper por:
 *   - dto.departamentoId quando o Configurador multi-perfil enviar (UI)
 *   - currentUser.departamentoId (do JWT) em fluxos com usuário logado
 *
 * Identifica o depto T.I. por nome (não por codigo) porque
 * `core.departamentos.codigo` está vazio em DEV — vide
 * `docs/INVESTIGACAO_DRIFT_DEV_23MAI.md`.
 */
export async function getDefaultDepartamentoId(prisma: PrismaService): Promise<string> {
  const dep = await prisma.departamento.findFirstOrThrow({
    where: { nome: { startsWith: 'Tecnologia', mode: 'insensitive' } },
    select: { id: true },
  });
  return dep.id;
}
