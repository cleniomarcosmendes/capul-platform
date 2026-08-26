import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateArtigoDto } from './dto/create-artigo.dto.js';
import { UpdateArtigoDto } from './dto/update-artigo.dto.js';
import { StatusArtigo } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';
import { paginate } from '../common/prisma/paginate.helper.js';
import { getDeptoIdsDoUser, assertStaffEmDepto } from '../common/helpers/departamento-filter.helper.js';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';
import { ehStaffDeTI, getDeptosOndeStaff } from '../common/constants/roles.constant.js';
import { hasCapability } from '../common/helpers/capability.helper.js';
import { ForbiddenException } from '@nestjs/common';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'conhecimento');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const artigoListInclude = {
  autor: { select: { id: true, nome: true, username: true } },
  software: { select: { id: true, nome: true } },
  // S16.2 — departamentoId expõe pro gate de visibilidade per-artigo.
  equipeTi: { select: { id: true, nome: true, sigla: true, departamentoId: true } },
};

const artigoDetalheInclude = {
  ...artigoListInclude,
  anexos: {
    select: { id: true, nomeOriginal: true, mimeType: true, tamanho: true, descricao: true, createdAt: true, usuarioId: true, usuario: { select: { id: true, nome: true } } },
    orderBy: { createdAt: 'desc' as const },
  },
};

@Injectable()
export class ConhecimentoService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: {
    categoria?: string;
    status?: string;
    softwareId?: string;
    equipeTiId?: string;
    search?: string;
    role?: string;
    page?: number;
    pageSize?: number;
    user?: JwtPayload;
    // S15.2 (25/05) — workspace ATIVO (header X-Workspace-Id).
    workspaceAtivoId?: string | null;
  }) {
    const where: Record<string, unknown> = {};
    if (filters.categoria) where.categoria = filters.categoria;
    if (filters.status) where.status = filters.status;
    if (filters.softwareId) where.softwareId = filters.softwareId;
    if (filters.equipeTiId) where.equipeTiId = filters.equipeTiId;
    if (filters.search) {
      where.OR = [
        { titulo: { contains: filters.search, mode: 'insensitive' } },
        { conteudo: { contains: filters.search, mode: 'insensitive' } },
        { tags: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // S16.2 (27/05) — Visibilidade per-artigo, não mais role-denormalizado.
    //
    // Regra final (incidente Juliana 27/05):
    //   - Artigo GLOBAL (equipeTiId IS NULL):
    //       * publica + PUBLICADO → todos veem
    //       * privado/rascunho    → só STAFF de T.I.
    //   - Artigo COM equipe (equipeTi.departamentoId = X):
    //       * STAFF de X         → vê tudo (publica/privado/rascunho)
    //       * Perfil não-STAFF X → vê só publica + PUBLICADO
    //       * Sem perfil em X    → não vê
    //   - OVERSIGHT_PLATAFORMA bypassa tudo (vê qualquer artigo).
    //   - filtros explícitos (`equipeTiId`) preservados como AND adicional;
    //     visibilidade ainda aplica.
    //
    // Antes: `role === USUARIO_FINAL/CHAVE` aplicava publica+PUBLICADO
    // globalmente. Juliana (GESTOR/CTL + USUARIO_FINAL/T.I.) tinha role
    // denormalizado = GESTOR → bypassava o gate e via PRIVADOS de T.I.
    const isOversight = filters.user
      ? hasCapability(filters.user, 'OVERSIGHT_PLATAFORMA')
      : false;

    if (!isOversight) {
      const deptosStaff = getDeptosOndeStaff(filters.user);
      const deptosOndeTemPerfil = getDeptoIdsDoUser(filters.user, filters.role) ?? [];
      const ehStaffTI = ehStaffDeTI(filters.user);

      const visibilityOr: Array<Record<string, unknown>> = [
        // Globais publicados — todos veem
        { equipeTiId: null, publica: true, status: 'PUBLICADO' },
        // Per-depto onde é STAFF — vê tudo
        ...(deptosStaff.length > 0
          ? [{ equipeTi: { departamentoId: { in: deptosStaff } } }]
          : []),
        // Per-depto onde tem perfil mas não staff — só publica + PUBLICADO
        ...(deptosOndeTemPerfil.length > 0
          ? [
              {
                equipeTi: { departamentoId: { in: deptosOndeTemPerfil } },
                publica: true,
                status: 'PUBLICADO',
              },
            ]
          : []),
        // Globais não-publicados — só staff TI vê
        ...(ehStaffTI ? [{ equipeTiId: null }] : []),
      ];

      // Compor com search (where.OR pré-existente) via AND
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: visibilityOr }];
        delete where.OR;
      } else {
        where.OR = visibilityOr;
      }
    }

    // S15.2 — Intersect com workspace ATIVO. Quando set: vê só artigos
    // dessa equipe-depto (e globais permanecem porque global = todos veem).
    const whereFinal = filters.workspaceAtivoId
      ? { AND: [where, { OR: [{ equipeTiId: null }, { equipeTi: { departamentoId: filters.workspaceAtivoId } }] }] }
      : where;

    return paginate(this.prisma, this.prisma.artigoConhecimento, {
      where: whereFinal,
      include: artigoListInclude,
      orderBy: { updatedAt: 'desc' },
      page: filters.page,
      pageSize: filters.pageSize,
    });
  }

  async findOne(id: string, user?: JwtPayload, role?: string) {
    const artigo = await this.prisma.artigoConhecimento.findUnique({
      where: { id },
      include: artigoDetalheInclude,
    });
    if (!artigo) throw new NotFoundException('Artigo nao encontrado');

    // S16.2 (27/05) — gate de visibilidade espelha findAll.
    // Sem user (smoke/tests internos) — passa.
    if (!user) return artigo;
    if (hasCapability(user, 'OVERSIGHT_PLATAFORMA')) return artigo;

    const equipeDeptoId = artigo.equipeTi?.departamentoId ?? null;
    const isPublicado = artigo.publica && artigo.status === 'PUBLICADO';

    // Global
    if (equipeDeptoId === null) {
      if (isPublicado) return artigo;
      if (ehStaffDeTI(user)) return artigo;
      throw new NotFoundException('Artigo nao encontrado');
    }

    // Com equipe
    const deptosStaff = getDeptosOndeStaff(user);
    const deptosOndeTemPerfil = getDeptoIdsDoUser(user, role) ?? [];
    if (deptosStaff.includes(equipeDeptoId)) return artigo;
    if (isPublicado && deptosOndeTemPerfil.includes(equipeDeptoId)) return artigo;

    throw new NotFoundException('Artigo nao encontrado');
  }

  /**
   * S13c (25/05) — valida que o user tem perfil staff no depto da equipe
   * (artigo com equipe) OU staff TI em qualquer depto (artigo global).
   * Conforme regra C2.4.5 "Conhecimento híbrido" da Onda 2.
   */
  private async assertPodeEscrever(user: JwtPayload | undefined, equipeTiId: string | null | undefined) {
    if (!user) return; // smoke/tests sem user
    if (equipeTiId) {
      const equipe = await this.prisma.equipe.findUnique({
        where: { id: equipeTiId }, select: { departamentoId: true },
      });
      assertStaffEmDepto(user, equipe?.departamentoId);
    } else {
      // Artigo global — não tem departamento; a curadoria é do T.I. É o único lugar do
      // módulo onde "é do T.I." ainda decide algo (26/08).
      if (!ehStaffDeTI(user)) {
        throw new ForbiddenException('Artigo global — só staff de T.I. pode criar/editar.');
      }
    }
  }

  async create(dto: CreateArtigoDto, autorId: string, user?: JwtPayload) {
    await this.assertPodeEscrever(user, dto.equipeTiId);
    return this.prisma.artigoConhecimento.create({
      data: {
        titulo: dto.titulo,
        conteudo: dto.conteudo,
        resumo: dto.resumo,
        categoria: dto.categoria,
        tags: dto.tags,
        softwareId: dto.softwareId,
        equipeTiId: dto.equipeTiId,
        publica: dto.publica ?? false,
        autorId,
      },
      include: artigoListInclude,
    });
  }

  async update(id: string, dto: UpdateArtigoDto, user?: JwtPayload) {
    const existing = await this.getOrFail(id);
    // S13c — valida depto atual e (se trocar equipe) o novo também.
    await this.assertPodeEscrever(user, existing.equipeTiId);
    if (dto.equipeTiId !== undefined && dto.equipeTiId !== existing.equipeTiId) {
      await this.assertPodeEscrever(user, dto.equipeTiId);
    }
    return this.prisma.artigoConhecimento.update({
      where: { id },
      data: { ...dto },
      include: artigoListInclude,
    });
  }

  async updateStatus(id: string, status: StatusArtigo, user?: JwtPayload) {
    const artigo = await this.getOrFail(id);
    await this.assertPodeEscrever(user, artigo.equipeTiId);

    const data: Record<string, unknown> = { status };
    if (status === 'PUBLICADO' && !artigo.publicadoEm) {
      data.publicadoEm = new Date();
    }

    return this.prisma.artigoConhecimento.update({
      where: { id },
      data,
      include: artigoListInclude,
    });
  }

  async delete(id: string, user?: JwtPayload) {
    const artigo = await this.getOrFail(id);
    await this.assertPodeEscrever(user, artigo.equipeTiId);
    // Remover arquivos de anexos do disco
    const anexos = await this.prisma.anexoConhecimento.findMany({ where: { artigoId: id } });
    for (const anexo of anexos) {
      const filePath = path.join(UPLOADS_DIR, anexo.nomeArquivo);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await this.prisma.artigoConhecimento.delete({ where: { id } });
  }

  // === Anexos ===

  async listAnexos(artigoId: string) {
    await this.getOrFail(artigoId);
    return this.prisma.anexoConhecimento.findMany({
      where: { artigoId },
      include: { usuario: { select: { id: true, nome: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addAnexo(artigoId: string, file: Express.Multer.File, userId: string, descricao?: string, user?: JwtPayload) {
    const artigo = await this.getOrFail(artigoId);
    // S14.1 (25/05) — reusa regra híbrida do artigo (assertPodeEscrever):
    // só staff do depto da equipe (ou staff TI se global) pode anexar.
    await this.assertPodeEscrever(user, artigo.equipeTiId);
    return this.prisma.anexoConhecimento.create({
      data: {
        nomeOriginal: file.originalname,
        nomeArquivo: file.filename,
        mimeType: file.mimetype,
        tamanho: file.size,
        descricao,
        artigoId,
        usuarioId: userId,
      },
      include: { usuario: { select: { id: true, nome: true } } },
    });
  }

  async getAnexoFile(artigoId: string, anexoId: string) {
    const anexo = await this.prisma.anexoConhecimento.findFirst({
      where: { id: anexoId, artigoId },
    });
    if (!anexo) throw new NotFoundException('Anexo nao encontrado neste artigo');

    const filePath = path.join(UPLOADS_DIR, anexo.nomeArquivo);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Arquivo nao encontrado no disco');
    }
    return { filePath, anexo };
  }

  async removeAnexo(artigoId: string, anexoId: string, user?: JwtPayload) {
    const artigo = await this.getOrFail(artigoId);
    const anexo = await this.prisma.anexoConhecimento.findFirst({
      where: { id: anexoId, artigoId },
    });
    if (!anexo) throw new NotFoundException('Anexo nao encontrado neste artigo');
    // S14.1 (25/05) — mesmo gate do addAnexo (regra híbrida do artigo).
    await this.assertPodeEscrever(user, artigo.equipeTiId);

    const filePath = path.join(UPLOADS_DIR, anexo.nomeArquivo);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await this.prisma.anexoConhecimento.delete({ where: { id: anexoId } });
    return { deleted: true };
  }

  private async getOrFail(id: string) {
    const artigo = await this.prisma.artigoConhecimento.findUnique({ where: { id } });
    if (!artigo) throw new NotFoundException('Artigo nao encontrado');
    return artigo;
  }
}
