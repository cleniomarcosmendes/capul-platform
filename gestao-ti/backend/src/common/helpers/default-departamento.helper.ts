import { PrismaService } from '../../prisma/prisma.service.js';

/**
 * Retorna o ID do departamento "Tecnologia da Informacao" (T.I.).
 *
 * Helper TEMPORÁRIO da Onda 1 Sub-fase 1.1 (Workspace Multi-Departamento).
 * Após adicionar `departamento_id NOT NULL` em 10 entidades operacionais,
 * todos os `prisma.X.create()` passaram a exigir o campo. Como a Sub-fase 1.1
 * é "schema only" e a derivação de departamento via contexto do usuário
 * (JWT/RBAC) só entra na Sub-fase 1.5, este helper preenche o gap com o
 * depto T.I. como default — preservando o comportamento atual (tudo é T.I.
 * por enquanto).
 *
 * TODO Onda 1 Sub-fase 1.5: trocar este helper por derivação a partir de:
 *   - currentUser.departamentoId (do JWT) quando criação for via usuário logado
 *   - equipeAtual.departamentoId quando criação for vinculada a equipe
 *   - dto.departamentoId quando solicitante explicitar (chamado pra outro depto)
 *
 * Quando todos os call sites estiverem usando contexto, este helper pode
 * ser removido completamente (junto com `src/common/helpers/default-departamento.helper.ts`).
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
