import { PrismaService } from '../../prisma/prisma.service';

export interface ModuloDepartamentoPayload {
  id: string;
  nome: string;
  role: string;
  funcionalidades: string[];
  /**
   * S12 (25/05) — true se este depto é do tipo "Tecnologia" (canônico p/
   * staff TI). Consumido por `hasStaffPerfilEmTI(user)` no gestao-ti pra
   * resolver multi-perfil corretamente (Juliana é GESTOR/CTL +
   * USUARIO_FINAL/T.I. → NÃO é staff TI, embora `role` denormalizada
   * pareça GESTOR). Tokens antigos sem este campo são tratados como
   * isTI=false (conservador — não vaza).
   */
  isTI: boolean;
}

export interface ModuloPayload {
  /** Código do módulo (ex.: 'WORKSPACE', 'GESTAO_TI', 'FISCAL', ...). */
  codigo: string;
  /**
   * Role denormalizada — igual à role do primeiro depto em `departamentos[]`.
   * MANTIDA por retrocompatibilidade (Sub-fase 1.4 — caminho A).
   * Consumidores antigos (guards) leem este campo; serão migrados pra
   * iterar `departamentos[]` na Sub-fase 1.5/1.6.
   */
  role: string;
  /**
   * NOVO na Sub-fase 1.4 (D32/D36): cada depto onde o user tem permissão
   * nesse módulo, com role específica e funcionalidades ativas.
   */
  departamentos: ModuloDepartamentoPayload[];
}

/**
 * Monta o array de módulos do JWT payload juntando duas fontes:
 *  - core.permissoes_modulo  (user × modulo × depto × role) — Sub-fase 1.2
 *  - core.departamento_funcionalidades (depto × funcionalidade ativa) — Sub-fase 1.3
 *
 * Duas queries (não N+1): findMany em permissoes + findMany em
 * funcionalidades com `WHERE departamento_id IN (...)`.
 *
 * Em DEV todos os usuários têm 1 perfil por módulo (sempre depto T.I.) — o
 * array `departamentos[]` terá 1 item. Multi-perfil real chega na Sub-fase 1.6
 * (UI Configurador matriz user × depto × role).
 *
 * @returns array de módulos, cada um com role denormalizada e departamentos[]
 */
export async function buildModulosPayload(
  prisma: PrismaService,
  usuarioId: string,
): Promise<ModuloPayload[]> {
  const permissoes = await prisma.permissaoModulo.findMany({
    where: { usuarioId, status: 'ATIVO' },
    include: {
      modulo: { select: { codigo: true } },
      roleModulo: { select: { codigo: true } },
      departamento: {
        select: {
          id: true,
          nome: true,
          // S12 — tipo do depto p/ marcar isTI no payload.
          tipoDepartamento: { select: { nome: true } },
        },
      },
    },
  });

  if (permissoes.length === 0) return [];

  const deptoIds = [...new Set(permissoes.map((p) => p.departamentoId))];
  const funcionalidades = await prisma.departamentoFuncionalidade.findMany({
    where: { departamentoId: { in: deptoIds }, ativo: true },
    select: { departamentoId: true, funcionalidade: true },
  });

  const funcByDepto = new Map<string, string[]>();
  for (const f of funcionalidades) {
    const arr = funcByDepto.get(f.departamentoId) ?? [];
    arr.push(f.funcionalidade);
    funcByDepto.set(f.departamentoId, arr);
  }

  const moduloMap = new Map<string, ModuloPayload>();
  for (const p of permissoes) {
    // S12 — depto é "TI" se nome OU tipo_departamento começa com "Tecnologia".
    // Match por nome do depto (canônico: "Tecnologia da Informação") É a
    // fonte primária — o seed atual marca todos os deptos como tipo
    // "Administrativo" e migrá-los seria escopo separado. Match por tipo é
    // ponte futura quando Configurador permitir tipar deptos corretamente
    // ("Tecnologia"). Sem hardcode de UUID.
    const deptoNome = (p.departamento.nome ?? '').toLowerCase();
    const tipoNome = (p.departamento.tipoDepartamento?.nome ?? '').toLowerCase();
    const isTI = deptoNome.startsWith('tecnologia') || tipoNome.startsWith('tecnologia');
    const deptoPayload: ModuloDepartamentoPayload = {
      id: p.departamento.id,
      nome: p.departamento.nome,
      role: p.roleModulo.codigo,
      funcionalidades: funcByDepto.get(p.departamentoId) ?? [],
      isTI,
    };

    const existing = moduloMap.get(p.modulo.codigo);
    if (existing) {
      existing.departamentos.push(deptoPayload);
    } else {
      moduloMap.set(p.modulo.codigo, {
        codigo: p.modulo.codigo,
        role: p.roleModulo.codigo,
        departamentos: [deptoPayload],
      });
    }
  }

  return Array.from(moduloMap.values());
}
