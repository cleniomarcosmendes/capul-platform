import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateChamadoExternoDto, UpdateChamadoExternoDto } from './dto/create-chamado-externo.dto.js';
import { applyDepartamentoFilter, assertDepartamentoDoUser } from '../common/helpers/departamento-filter.helper.js';
import { resolveDepartamento } from '../common/helpers/resolve-departamento.helper.js';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';

const SOFTWARE_SELECT = {
  id: true,
  nome: true,
  fabricante: true,
} as const;

@Injectable()
export class ChamadoExternoService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    filters: { ano?: number; mes?: number; softwareId?: string },
    user?: JwtPayload,
    role?: string,
  ) {
    const where: Prisma.ChamadoExternoMensalWhereInput = {};
    if (filters.ano) where.ano = filters.ano;
    if (filters.mes) where.mes = filters.mes;
    if (filters.softwareId) where.softwareId = filters.softwareId;

    // Workspace Onda 2 C2.7 refino — depto-dono (ADMIN escapa).
    const whereFiltrado = applyDepartamentoFilter(where, user ?? null, role ?? null);

    return this.prisma.chamadoExternoMensal.findMany({
      where: whereFiltrado,
      include: {
        software: { select: SOFTWARE_SELECT },
        registradoPor: { select: { id: true, nome: true, username: true } },
      },
      orderBy: [{ ano: 'desc' }, { mes: 'desc' }, { software: { nome: 'asc' } }],
    });
  }

  async findOne(id: string) {
    const reg = await this.prisma.chamadoExternoMensal.findUnique({
      where: { id },
      include: {
        software: { select: SOFTWARE_SELECT },
        registradoPor: { select: { id: true, nome: true, username: true } },
      },
    });
    if (!reg) throw new NotFoundException('Lançamento não encontrado');
    return reg;
  }

  async create(dto: CreateChamadoExternoDto, registradoPorId: string, user?: JwtPayload) {
    await this.assertSoftwareExiste(dto.softwareId);

    // Workspace Onda 2 C2.7 refino — depto-dono via cascade
    // (dto.departamentoId → JWT → fallback T.I.).
    const departamentoId = await resolveDepartamento(
      this.prisma,
      user ?? null,
      'WORKSPACE',
      dto.departamentoId,
    );
    // Onda 3 S10 sweep (26/05, security-review #1) — gate cross-depto.
    if (user) assertDepartamentoDoUser(user, null, departamentoId);

    try {
      return await this.prisma.chamadoExternoMensal.create({
        data: {
          mes: dto.mes,
          ano: dto.ano,
          softwareId: dto.softwareId,
          qtdChamados: dto.qtdChamados,
          observacoes: dto.observacoes,
          registradoPorId,
          departamentoId,
        },
        include: {
          software: { select: SOFTWARE_SELECT },
          registradoPor: { select: { id: true, nome: true, username: true } },
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Ja existe lancamento para este Software/Mes/Ano/Depto. Edite o existente.');
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateChamadoExternoDto, user?: JwtPayload) {
    const existing = await this.findOne(id);
    // departamentoId é NULL em registros legados (pré-Onda 1) — pula assert
    // se já está vazio (já é "sem dono" e qualquer staff pode ajustar).
    if (user && existing.departamentoId) assertDepartamentoDoUser(user, null, existing.departamentoId);
    if (dto.softwareId) await this.assertSoftwareExiste(dto.softwareId);

    try {
      return await this.prisma.chamadoExternoMensal.update({
        where: { id },
        data: {
          ...(dto.mes !== undefined ? { mes: dto.mes } : {}),
          ...(dto.ano !== undefined ? { ano: dto.ano } : {}),
          ...(dto.softwareId !== undefined ? { softwareId: dto.softwareId } : {}),
          ...(dto.qtdChamados !== undefined ? { qtdChamados: dto.qtdChamados } : {}),
          ...(dto.observacoes !== undefined ? { observacoes: dto.observacoes } : {}),
        },
        include: {
          software: { select: SOFTWARE_SELECT },
          registradoPor: { select: { id: true, nome: true, username: true } },
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Ja existe lancamento para este Software/Mes/Ano.');
      }
      throw err;
    }
  }

  async remove(id: string, user?: JwtPayload) {
    const existing = await this.findOne(id);
    // departamentoId é NULL em registros legados (pré-Onda 1) — pula assert
    // se já está vazio (já é "sem dono" e qualquer staff pode ajustar).
    if (user && existing.departamentoId) assertDepartamentoDoUser(user, null, existing.departamentoId);
    await this.prisma.chamadoExternoMensal.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * Agrega chamados externos do periodo (mes/ano) para o KPI no dashboard.
   * Retorna total + breakdown por software, e a tendencia dos ultimos
   * 12 meses (para grafico de evolucao).
   */
  async getKpiPeriodo(mes: number, ano: number, user?: JwtPayload, role?: string) {
    const inicioJanela = somarMeses({ mes, ano }, -11);

    // Workspace Onda 2 C2.7 refino — escopa por depto-dono (ADMIN escapa).
    const deptoWhere = applyDepartamentoFilter({}, user ?? null, role ?? null);

    const [registrosMes, registrosTendencia] = await Promise.all([
      this.prisma.chamadoExternoMensal.findMany({
        where: { mes, ano, ...deptoWhere },
        include: { software: { select: SOFTWARE_SELECT } },
        orderBy: { qtdChamados: 'desc' },
      }),
      this.prisma.chamadoExternoMensal.findMany({
        where: {
          OR: gerarFiltroJanela(inicioJanela, { mes, ano }),
          ...deptoWhere,
        },
        select: { mes: true, ano: true, qtdChamados: true },
      }),
    ]);

    const totalNoMes = registrosMes.reduce((s, r) => s + r.qtdChamados, 0);

    // tendencia: agregar por (ano, mes) preservando 12 buckets
    const buckets = new Map<string, number>();
    for (let i = 0; i < 12; i++) {
      const pt = somarMeses(inicioJanela, i);
      buckets.set(`${pt.ano}-${String(pt.mes).padStart(2, '0')}`, 0);
    }
    for (const r of registrosTendencia) {
      const key = `${r.ano}-${String(r.mes).padStart(2, '0')}`;
      buckets.set(key, (buckets.get(key) ?? 0) + r.qtdChamados);
    }

    return {
      totalNoMes,
      qtdSoftwaresComLancamento: registrosMes.length,
      porSoftware: registrosMes.map((r) => ({
        softwareId: r.softwareId,
        softwareNome: r.software.nome,
        fabricante: r.software.fabricante,
        qtdChamados: r.qtdChamados,
        observacoes: r.observacoes,
      })),
      tendencia12Meses: Array.from(buckets.entries()).map(([key, total]) => {
        const [a, m] = key.split('-');
        return { ano: Number(a), mes: Number(m), total };
      }),
    };
  }

  private async assertSoftwareExiste(softwareId: string) {
    const sw = await this.prisma.software.findUnique({ where: { id: softwareId }, select: { id: true } });
    if (!sw) throw new BadRequestException('Software não encontrado');
  }
}

/**
 * Soma `delta` meses a um ponto (positivo ou negativo).
 * Mantem aritmetica de mes/ano sem usar Date (evita timezone).
 */
function somarMeses(p: { mes: number; ano: number }, delta: number): { mes: number; ano: number } {
  const total = p.ano * 12 + (p.mes - 1) + delta;
  return { ano: Math.floor(total / 12), mes: (total % 12) + 1 };
}

/**
 * Gera filtro OR para 12 meses entre inicio e fim (inclusive).
 * Usa-se OR de pares (ano, mes) pq filtros range em duas colunas
 * exigiriam coluna de data — esta tabela so tem ano/mes inteiros.
 */
function gerarFiltroJanela(
  inicio: { mes: number; ano: number },
  fim: { mes: number; ano: number },
): Prisma.ChamadoExternoMensalWhereInput[] {
  const filtros: Prisma.ChamadoExternoMensalWhereInput[] = [];
  let cursor = { ...inicio };
  while (cursor.ano < fim.ano || (cursor.ano === fim.ano && cursor.mes <= fim.mes)) {
    filtros.push({ ano: cursor.ano, mes: cursor.mes });
    cursor = somarMeses(cursor, 1);
  }
  return filtros;
}
