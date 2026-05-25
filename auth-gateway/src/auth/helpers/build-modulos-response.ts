import { PrismaService } from '../../prisma/prisma.service';

export interface ModuloDepartamentoResponse {
  id: string;
  nome: string;
  role: string;
  roleNome: string;
  funcionalidades: string[];
  /** S12 — espelha JWT: true se depto é tipo "Tecnologia". */
  isTI: boolean;
}

export interface ModuloResponse {
  /** Código (ex.: 'WORKSPACE', 'GESTAO_TI'). */
  codigo: string;
  /** Nome legível. */
  nome: string;
  icone: string | null;
  cor: string | null;
  url: string | null;
  /** Role denormalizada — = role do 1º depto (retrocompat). */
  role: string;
  roleNome: string;
  /** NOVO Sub-fase 1.6.2 — departamentos onde o user tem permissão no módulo. */
  departamentos: ModuloDepartamentoResponse[];
}

/**
 * Monta o array `modulos` da RESPOSTA HTTP do login/refresh/MFA.
 *
 * Equivalente ao `buildModulosPayload` (que vai no JWT), mas inclui campos
 * extras pro Hub/menus consumirem direto: nome, icone, cor, url, roleNome.
 *
 * Onda 1 Sub-fase 1.6.2 — estende as 3 responses HTTP do login que antes
 * usavam `usuario.permissoes.map(...)` cru.
 */
export async function buildModulosResponse(
  prisma: PrismaService,
  usuarioId: string,
): Promise<ModuloResponse[]> {
  const permissoes = await prisma.permissaoModulo.findMany({
    where: { usuarioId, status: 'ATIVO' },
    include: {
      modulo: { select: { codigo: true, nome: true, icone: true, cor: true, urlFrontend: true } },
      roleModulo: { select: { codigo: true, nome: true } },
      departamento: {
        select: {
          id: true,
          nome: true,
          // S12 — espelha build-modulos-payload (resposta HTTP do login
          // tem que carregar o mesmo isTI que o JWT).
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

  const moduloMap = new Map<string, ModuloResponse>();
  for (const p of permissoes) {
    // S12 — espelha build-modulos-payload: depto é "TI" se nome OU tipo
    // começa com "Tecnologia" (nome é canônico "Tecnologia da Informação";
    // tipo é ponte futura quando Configurador migrar tipagem).
    const deptoNome = (p.departamento.nome ?? '').toLowerCase();
    const tipoNome = (p.departamento.tipoDepartamento?.nome ?? '').toLowerCase();
    const isTI = deptoNome.startsWith('tecnologia') || tipoNome.startsWith('tecnologia');
    const deptoEntry: ModuloDepartamentoResponse = {
      id: p.departamento.id,
      nome: p.departamento.nome,
      role: p.roleModulo.codigo,
      roleNome: p.roleModulo.nome,
      funcionalidades: funcByDepto.get(p.departamentoId) ?? [],
      isTI,
    };

    const existing = moduloMap.get(p.modulo.codigo);
    if (existing) {
      existing.departamentos.push(deptoEntry);
    } else {
      moduloMap.set(p.modulo.codigo, {
        codigo: p.modulo.codigo,
        nome: p.modulo.nome,
        icone: p.modulo.icone,
        cor: p.modulo.cor,
        url: p.modulo.urlFrontend,
        role: p.roleModulo.codigo,
        roleNome: p.roleModulo.nome,
        departamentos: [deptoEntry],
      });
    }
  }

  return Array.from(moduloMap.values());
}
