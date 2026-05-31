import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateClienteLocalDto, UpdateClienteLocalDto } from './dto.js';

const onlyDigits = (s?: string) => (s ?? '').replace(/\D/g, '');

/**
 * Cliente recorrente SEM matrícula — cadastro leve, GLOBAL (reconhecido em
 * qualquer filial). Não cria nada no ERP; é exclusivo da operação de entregas.
 */
@Injectable()
export class ClienteLocalService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateClienteLocalDto) {
    return this.prisma.clienteLocal.create({
      data: {
        nome: dto.nome.trim(),
        telefone: dto.telefone ? onlyDigits(dto.telefone) : null,
        observacao: dto.observacao?.trim() || null,
      },
    });
  }

  /** Lista/busca por nome (contains, case-insensitive) ou telefone (dígitos). */
  async list(q?: string) {
    const termo = (q ?? '').trim();
    if (!termo) {
      return this.prisma.clienteLocal.findMany({
        where: { ativo: true },
        orderBy: { nome: 'asc' },
        take: 50,
      });
    }
    const digits = onlyDigits(termo);
    return this.prisma.clienteLocal.findMany({
      where: {
        ativo: true,
        OR: [
          { nome: { contains: termo, mode: 'insensitive' } },
          ...(digits.length >= 4 ? [{ telefone: { contains: digits } }] : []),
        ],
      },
      orderBy: { nome: 'asc' },
      take: 50,
    });
  }

  async findOne(id: string) {
    const c = await this.prisma.clienteLocal.findUnique({
      where: { id },
      include: { enderecos: { where: { ativo: true } } },
    });
    if (!c) throw new NotFoundException('Cliente local não encontrado.');
    return c;
  }

  async update(id: string, dto: UpdateClienteLocalDto) {
    await this.ensureExists(id);
    return this.prisma.clienteLocal.update({
      where: { id },
      data: {
        nome: dto.nome?.trim(),
        telefone: dto.telefone !== undefined ? onlyDigits(dto.telefone) || null : undefined,
        observacao: dto.observacao !== undefined ? dto.observacao.trim() || null : undefined,
        ativo: dto.ativo,
      },
    });
  }

  /** Soft-delete (ativo=false) — preserva histórico de entregas vinculadas. */
  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.clienteLocal.update({ where: { id }, data: { ativo: false } });
  }

  private async ensureExists(id: string) {
    const c = await this.prisma.clienteLocal.findUnique({ where: { id }, select: { id: true } });
    if (!c) throw new NotFoundException('Cliente local não encontrado.');
  }
}
