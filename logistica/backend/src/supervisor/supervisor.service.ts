import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { JwtPayload } from '../common/decorators/current-user.decorator.js';
import { filialDoUsuario } from '../common/filial-scope.js';
import { AtualizarAtividadeDto, AtualizarRegiaoDto, CriarAtividadeDto, CriarRegiaoDto, MunicipioDto } from './dto.js';

/**
 * Catálogos do módulo Supervisores/RDV (Fase 3a): Atividade de visita e Região
 * (N:N com município). Escopo por filial: cada filial vê os SEUS + os globais
 * (filialId null). Escrita é gateada a gestor no controller.
 */
@Injectable()
export class SupervisorService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Atividades ----
  listarAtividades(user: JwtPayload, somenteAtivas?: boolean) {
    const filialId = filialDoUsuario(user);
    return this.prisma.atividadeVisita.findMany({
      where: { OR: [{ filialId }, { filialId: null }], ...(somenteAtivas ? { ativo: true } : {}) },
      orderBy: { nome: 'asc' },
    });
  }
  async criarAtividade(dto: CriarAtividadeDto, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const nome = dto.nome.trim();
    const ja = await this.prisma.atividadeVisita.findFirst({ where: { filialId, nome } });
    if (ja) throw new BadRequestException('Já existe uma atividade com esse nome.');
    return this.prisma.atividadeVisita.create({ data: { nome, filialId } });
  }
  async atualizarAtividade(id: string, dto: AtualizarAtividadeDto, user: JwtPayload) {
    const a = await this.prisma.atividadeVisita.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Atividade não encontrada.');
    if (a.filialId && a.filialId !== user.filialId) throw new BadRequestException('Atividade de outra filial.');
    return this.prisma.atividadeVisita.update({
      where: { id },
      data: { nome: dto.nome?.trim() ?? undefined, ativo: dto.ativo ?? undefined },
    });
  }

  // ---- Regiões ----
  listarRegioes(user: JwtPayload, somenteAtivas?: boolean) {
    const filialId = filialDoUsuario(user);
    return this.prisma.regiao.findMany({
      where: { OR: [{ filialId }, { filialId: null }], ...(somenteAtivas ? { ativo: true } : {}) },
      orderBy: { nome: 'asc' },
      include: { municipios: { orderBy: { municipio: 'asc' } } },
    });
  }
  async criarRegiao(dto: CriarRegiaoDto, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const nome = dto.nome.trim();
    const ja = await this.prisma.regiao.findFirst({ where: { filialId, nome } });
    if (ja) throw new BadRequestException('Já existe uma região com esse nome.');
    return this.prisma.regiao.create({
      data: { nome, filialId, municipios: { create: this.normalizaMunicipios(dto.municipios) } },
      include: { municipios: { orderBy: { municipio: 'asc' } } },
    });
  }
  async atualizarRegiao(id: string, dto: AtualizarRegiaoDto, user: JwtPayload) {
    const r = await this.prisma.regiao.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Região não encontrada.');
    if (r.filialId && r.filialId !== user.filialId) throw new BadRequestException('Região de outra filial.');
    return this.prisma.$transaction(async (tx) => {
      // Se veio a lista de municípios, SUBSTITUI (replace) — a N:N é gerida pela região.
      if (dto.municipios) {
        await tx.regiaoMunicipio.deleteMany({ where: { regiaoId: id } });
        const ms = this.normalizaMunicipios(dto.municipios);
        if (ms.length) await tx.regiaoMunicipio.createMany({ data: ms.map((m) => ({ ...m, regiaoId: id })) });
      }
      return tx.regiao.update({
        where: { id },
        data: { nome: dto.nome?.trim() ?? undefined, ativo: dto.ativo ?? undefined },
        include: { municipios: { orderBy: { municipio: 'asc' } } },
      });
    });
  }

  /** Normaliza + dedup (por município, case-insensitive) a lista N:N. */
  private normalizaMunicipios(ms?: MunicipioDto[]) {
    const seen = new Set<string>();
    const out: { municipio: string; uf: string | null }[] = [];
    for (const m of ms ?? []) {
      const municipio = m.municipio.trim();
      if (!municipio) continue;
      const k = municipio.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ municipio, uf: m.uf?.trim().toUpperCase() || null });
    }
    return out;
  }
}
