import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Leitura READ-ONLY do schema `core` (filiais/departamentos/usuarios) via
 * $queryRaw — a logística não declara esses modelos no seu Prisma (schema
 * próprio). Serve para: (1) validar FKs do core na criação (evita ID órfão);
 * (2) resolver nomes para enriquecer as respostas (evita o front depender de
 * chamadas separadas ao core). Nunca escreve no core.
 */
@Injectable()
export class CoreLookupService {
  constructor(private readonly prisma: PrismaService) {}

  async validarFilial(id: string): Promise<void> {
    const r = await this.prisma.$queryRaw<{ n: number }[]>(
      Prisma.sql`SELECT count(*)::int AS n FROM "core"."filiais" WHERE id = ${id}`,
    );
    if (!r[0]?.n) throw new BadRequestException('Filial não encontrada no cadastro.');
  }

  async validarDepartamento(id: string): Promise<void> {
    const r = await this.prisma.$queryRaw<{ n: number }[]>(
      Prisma.sql`SELECT count(*)::int AS n FROM "core"."departamentos" WHERE id = ${id}`,
    );
    if (!r[0]?.n) throw new BadRequestException('Departamento não encontrado no cadastro.');
  }

  async validarUsuario(id: string, rotulo = 'Usuário'): Promise<void> {
    const r = await this.prisma.$queryRaw<{ n: number }[]>(
      Prisma.sql`SELECT count(*)::int AS n FROM "core"."usuarios" WHERE id = ${id}`,
    );
    if (!r[0]?.n) throw new BadRequestException(`${rotulo} não encontrado no cadastro.`);
  }

  /** id → nome de filial (nome_fantasia › razão social › código). */
  async nomesFiliais(ids: string[]): Promise<Map<string, string>> {
    const u = [...new Set(ids.filter(Boolean))];
    if (!u.length) return new Map();
    const rows = await this.prisma.$queryRaw<{ id: string; label: string }[]>(Prisma.sql`
      SELECT id, TRIM(COALESCE(NULLIF(TRIM(nome_fantasia), ''), NULLIF(TRIM(razao_social), ''), codigo)) AS label
      FROM "core"."filiais" WHERE id IN (${Prisma.join(u)})`);
    return new Map(rows.map((r) => [r.id, r.label]));
  }

  /** id → nome de departamento. */
  async nomesDepartamentos(ids: string[]): Promise<Map<string, string>> {
    const u = [...new Set(ids.filter(Boolean))];
    if (!u.length) return new Map();
    const rows = await this.prisma.$queryRaw<{ id: string; label: string }[]>(Prisma.sql`
      SELECT id, TRIM(nome) AS label FROM "core"."departamentos" WHERE id IN (${Prisma.join(u)})`);
    return new Map(rows.map((r) => [r.id, r.label]));
  }

  /** id → nome de usuário (colaborador). */
  async nomesUsuarios(ids: string[]): Promise<Map<string, string>> {
    const u = [...new Set(ids.filter(Boolean))];
    if (!u.length) return new Map();
    const rows = await this.prisma.$queryRaw<{ id: string; label: string }[]>(Prisma.sql`
      SELECT id, TRIM(nome) AS label FROM "core"."usuarios" WHERE id IN (${Prisma.join(u)})`);
    return new Map(rows.map((r) => [r.id, r.label]));
  }
}
