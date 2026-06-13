import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateEnderecoDto, UpdateEnderecoDto } from './dto.js';

const onlyDigits = (s?: string) => (s ?? '').replace(/\D/g, '');

/**
 * Endereço de entrega — GLOBAL (cross-filial). Reaproveitado entre filiais:
 * um endereço cadastrado numa filial fica disponível nas demais. Pertence a
 * uma matrícula (ERP) OU a um ClienteLocal.
 */
@Injectable()
export class EnderecoService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEnderecoDto, filialId?: string) {
    if (dto.clienteLocalId) {
      const cl = await this.prisma.clienteLocal.findUnique({
        where: { id: dto.clienteLocalId },
        select: { id: true },
      });
      if (!cl) throw new BadRequestException('clienteLocalId inválido.');
    }
    return this.prisma.enderecoEntrega.create({
      data: {
        filialId: filialId || null,
        matricula: dto.matricula?.trim() || null,
        clienteLocalId: dto.clienteLocalId || null,
        apelido: dto.apelido?.trim() || null,
        logradouro: dto.logradouro.trim(),
        numero: dto.numero?.trim() || null,
        complemento: dto.complemento?.trim() || null,
        bairro: dto.bairro?.trim() || null,
        cidade: dto.cidade?.trim() || null,
        uf: dto.uf?.trim().toUpperCase() || null,
        cep: dto.cep ? onlyDigits(dto.cep) : null,
        pontoReferencia: dto.pontoReferencia?.trim() || null,
      },
    });
  }

  /** Lista endereços ativos de um dono (matrícula ou clienteLocalId). Escopo por filial. */
  list(params: { matricula?: string; clienteLocalId?: string; filialId?: string }) {
    const matricula = params.matricula?.trim();
    const clienteLocalId = params.clienteLocalId?.trim();
    if (!matricula && !clienteLocalId) {
      throw new BadRequestException('Informe matricula ou clienteLocalId.');
    }
    return this.prisma.enderecoEntrega.findMany({
      where: {
        ativo: true,
        ...(params.filialId ? { filialId: params.filialId } : {}),
        ...(matricula ? { matricula } : {}),
        ...(clienteLocalId ? { clienteLocalId } : {}),
      },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async update(id: string, dto: UpdateEnderecoDto) {
    await this.ensureExists(id);
    return this.prisma.enderecoEntrega.update({
      where: { id },
      data: {
        apelido: dto.apelido?.trim(),
        logradouro: dto.logradouro?.trim(),
        numero: dto.numero?.trim(),
        complemento: dto.complemento?.trim(),
        bairro: dto.bairro?.trim(),
        cidade: dto.cidade?.trim(),
        uf: dto.uf?.trim().toUpperCase(),
        cep: dto.cep !== undefined ? onlyDigits(dto.cep) || null : undefined,
        pontoReferencia: dto.pontoReferencia?.trim(),
        ativo: dto.ativo,
      },
    });
  }

  /** Soft-delete — spec: endereços podem ser excluídos quando errados ou o
   *  cliente muda de endereço; histórico de entregas preserva o snapshot. */
  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.enderecoEntrega.update({ where: { id }, data: { ativo: false } });
  }

  private async ensureExists(id: string) {
    const e = await this.prisma.enderecoEntrega.findUnique({ where: { id }, select: { id: true } });
    if (!e) throw new NotFoundException('Endereço não encontrado.');
  }
}
