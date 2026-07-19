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

  /** Todos os departamentos (id + nome) — para filtros/dropdowns. */
  async listarDepartamentos(): Promise<{ id: string; nome: string }[]> {
    return this.prisma.$queryRaw<{ id: string; nome: string }[]>(Prisma.sql`
      SELECT id, TRIM(nome) AS nome FROM "core"."departamentos" ORDER BY TRIM(nome)`);
  }

  /** id → nome de usuário (colaborador). */
  async nomesUsuarios(ids: string[]): Promise<Map<string, string>> {
    const u = [...new Set(ids.filter(Boolean))];
    if (!u.length) return new Map();
    const rows = await this.prisma.$queryRaw<{ id: string; label: string }[]>(Prisma.sql`
      SELECT id, TRIM(nome) AS label FROM "core"."usuarios" WHERE id IN (${Prisma.join(u)})`);
    return new Map(rows.map((r) => [r.id, r.label]));
  }

  /**
   * Matrícula + nome do colaborador a partir do id do usuário (login). Usado no
   * caminho INDIVIDUAL da frota: o próprio usuário logado é o condutor, sem pedir
   * senha de novo. Retorna null se o usuário não tiver matrícula cadastrada.
   */
  async colaboradorDoUsuario(userId: string): Promise<{ matricula: string; nome: string } | null> {
    if (!userId) return null;
    const rows = await this.prisma.$queryRaw<{ matricula: string | null; nome: string }[]>(Prisma.sql`
      SELECT matricula, TRIM(nome) AS nome FROM "core"."usuarios" WHERE id = ${userId} LIMIT 1`);
    const r = rows[0];
    if (!r || !r.matricula || !r.matricula.trim()) return null;
    return { matricula: r.matricula.trim(), nome: r.nome };
  }

  /**
   * MOTORISTAS elegíveis à rota de entrega: usuários ATIVOS, da FILIAL informada
   * (filial principal), com permissão ATIVA no módulo LOGISTICA **e papel
   * ENTREGADOR** (o papel do motorista). Antes listava qualquer papel de
   * Logística (gestor/coordenador/supervisor apareciam como "motorista"); agora
   * é só quem dirige. Requisito: os motoristas precisam estar cadastrados com o
   * papel ENTREGADOR no Configurador — senão não aparecem aqui.
   */
  async motoristasLogistica(filialId: string): Promise<{ id: string; nome: string }[]> {
    if (!filialId) return [];
    return this.prisma.$queryRaw<{ id: string; nome: string }[]>(Prisma.sql`
      SELECT DISTINCT u.id, TRIM(u.nome) AS nome
      FROM "core"."usuarios" u
      JOIN "core"."permissoes_modulo" pm ON pm.usuario_id = u.id AND pm.status = 'ATIVO'
      JOIN "core"."modulos_sistema" m ON m.id = pm.modulo_id AND m.codigo = 'LOGISTICA'
      JOIN "core"."roles_modulo" rm ON rm.id = pm.role_modulo_id AND rm.codigo = 'ENTREGADOR'
      WHERE u.status = 'ATIVO' AND u.filial_principal_id = ${filialId}
      ORDER BY nome`);
  }

  /** Garante que o motorista É um ENTREGADOR ATIVO da filial (mesma regra do seletor
   *  `motoristasLogistica`). Fecha a brecha de um rascunho antigo cujo motorista
   *  perdeu o papel ENTREGADOR — a validação de existência (`validarUsuario`) não
   *  pegava isso. Usado ao definir o motorista e no DESPACHO. */
  async assertEntregador(motoristaId: string, filialId: string): Promise<void> {
    const r = await this.prisma.$queryRaw<{ n: number }[]>(Prisma.sql`
      SELECT count(*)::int AS n
      FROM "core"."usuarios" u
      JOIN "core"."permissoes_modulo" pm ON pm.usuario_id = u.id AND pm.status = 'ATIVO'
      JOIN "core"."modulos_sistema" m ON m.id = pm.modulo_id AND m.codigo = 'LOGISTICA'
      JOIN "core"."roles_modulo" rm ON rm.id = pm.role_modulo_id AND rm.codigo = 'ENTREGADOR'
      WHERE u.id = ${motoristaId} AND u.status = 'ATIVO' AND u.filial_principal_id = ${filialId}`);
    if (!r[0]?.n) throw new BadRequestException('Motorista inválido: precisa ter o papel Entregador ativo nesta filial.');
  }
}
