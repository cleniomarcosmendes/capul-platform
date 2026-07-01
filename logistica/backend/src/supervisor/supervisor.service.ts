import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StatusViagem, TipoViagem } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { JwtPayload } from '../common/decorators/current-user.decorator.js';
import { filialDoUsuario } from '../common/filial-scope.js';
import { AtualizarAtividadeDto, AtualizarRegiaoDto, CriarAtividadeDto, CriarRegiaoDto, CriarViagemSupervisorDto, MunicipioDto } from './dto.js';

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

  // ---- Viagem mensal do supervisor (container da RDV) ----
  async criarViagemSupervisor(dto: CriarViagemSupervisorDto, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const mm = dto.mesReferencia % 100;
    if (mm < 1 || mm > 12) throw new BadRequestException('Mês de referência inválido — use AAAAMM (ex.: 202605).');
    if (dto.regiaoId) {
      const r = await this.prisma.regiao.findUnique({ where: { id: dto.regiaoId } });
      if (!r || (r.filialId && r.filialId !== filialId)) throw new BadRequestException('Região inválida para esta filial.');
    }
    if (dto.veiculoId) {
      const v = await this.prisma.veiculo.findFirst({ where: { id: dto.veiculoId, filialId } });
      if (!v) throw new BadRequestException('Veículo não encontrado nesta filial.');
    }
    return this.prisma.$transaction(async (tx) => {
      const contador = await tx.contadorSequencial.upsert({
        where: { filialId_escopo: { filialId, escopo: 'VIAGEM' } },
        create: { filialId, escopo: 'VIAGEM', ultimoNumero: 1 },
        update: { ultimoNumero: { increment: 1 } },
      });
      return tx.viagem.create({
        data: {
          numero: contador.ultimoNumero,
          filialId,
          tipo: TipoViagem.SUPERVISOR,
          situacao: StatusViagem.EM_CURSO,
          mesReferencia: dto.mesReferencia,
          adiantamento: dto.adiantamento != null ? new Prisma.Decimal(dto.adiantamento) : null,
          regiaoId: dto.regiaoId ?? null,
          veiculoId: dto.veiculoId ?? null,
          condutorMatricula: dto.supervisorMatricula?.trim().toUpperCase() || null,
          condutorNome: dto.supervisorNome?.trim() || null,
          dataHoraSaida: new Date(),
          criadoPorId: user.sub,
        },
        include: { regiao: { select: { id: true, nome: true } } },
      });
    });
  }

  listarViagensSupervisor(user: JwtPayload, mes?: number, situacao?: string) {
    const filialId = filialDoUsuario(user);
    return this.prisma.viagem.findMany({
      where: {
        filialId,
        tipo: TipoViagem.SUPERVISOR,
        ...(mes ? { mesReferencia: mes } : {}),
        ...(situacao ? { situacao: situacao as StatusViagem } : {}),
      },
      orderBy: [{ mesReferencia: 'desc' }, { numero: 'desc' }],
      include: {
        regiao: { select: { id: true, nome: true } },
        _count: { select: { paradas: true, despesas: true } },
      },
    });
  }

  async obterViagemSupervisor(id: string, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const v = await this.prisma.viagem.findUnique({
      where: { id },
      include: {
        regiao: { include: { municipios: { orderBy: { municipio: 'asc' } } } },
        despesas: { include: { tipoDespesa: { select: { nome: true, categoria: true } } } },
      },
    });
    if (!v || v.tipo !== TipoViagem.SUPERVISOR) throw new NotFoundException('Viagem de supervisor não encontrada.');
    if (v.filialId !== filialId) throw new ForbiddenException('Viagem de outra filial.');
    return v;
  }

  async concluirViagemSupervisor(id: string, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const v = await this.prisma.viagem.findUnique({ where: { id } });
    if (!v || v.tipo !== TipoViagem.SUPERVISOR) throw new NotFoundException('Viagem de supervisor não encontrada.');
    if (v.filialId !== filialId) throw new ForbiddenException('Viagem de outra filial.');
    if (v.situacao === StatusViagem.CONCLUIDA) return v;
    return this.prisma.viagem.update({
      where: { id },
      data: { situacao: StatusViagem.CONCLUIDA, dataHoraChegada: new Date() },
      include: { regiao: { select: { id: true, nome: true } } },
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
