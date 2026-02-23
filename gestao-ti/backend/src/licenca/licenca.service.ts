import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateLicencaDto } from './dto/create-licenca.dto.js';
import { UpdateLicencaDto } from './dto/update-licenca.dto.js';
import { StatusLicenca } from '@prisma/client';

const licencaInclude = {
  software: { select: { id: true, nome: true, fabricante: true, tipo: true } },
  contrato: { select: { id: true, titulo: true, numero: true } },
};

@Injectable()
export class LicencaService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: {
    softwareId?: string;
    status?: StatusLicenca;
    vencendoEm?: number; // dias
  }, role: string) {
    const where: Record<string, unknown> = {};

    if (filters.softwareId) where.softwareId = filters.softwareId;
    if (filters.status) where.status = filters.status;

    if (filters.vencendoEm) {
      const limite = new Date();
      limite.setDate(limite.getDate() + filters.vencendoEm);
      where.dataVencimento = { lte: limite, gte: new Date() };
      where.status = 'ATIVA';
    }

    const licencas = await this.prisma.softwareLicenca.findMany({
      where,
      include: licencaInclude,
      orderBy: { dataVencimento: 'asc' },
    });

    return this.filterSensitiveFields(licencas, role);
  }

  async findOne(id: string, role: string) {
    const licenca = await this.prisma.softwareLicenca.findUnique({
      where: { id },
      include: licencaInclude,
    });
    if (!licenca) throw new NotFoundException('Licenca nao encontrada');

    return this.filterSensitiveField(licenca, role);
  }

  async create(dto: CreateLicencaDto) {
    const software = await this.prisma.software.findUnique({ where: { id: dto.softwareId } });
    if (!software) throw new BadRequestException('Software nao encontrado');

    return this.prisma.softwareLicenca.create({
      data: {
        softwareId: dto.softwareId,
        modeloLicenca: dto.modeloLicenca,
        quantidade: dto.quantidade,
        valorTotal: dto.valorTotal,
        valorUnitario: dto.valorUnitario,
        dataInicio: dto.dataInicio ? new Date(dto.dataInicio) : null,
        dataVencimento: dto.dataVencimento ? new Date(dto.dataVencimento) : null,
        chaveSerial: dto.chaveSerial,
        fornecedor: dto.fornecedor,
        observacoes: dto.observacoes,
      },
      include: licencaInclude,
    });
  }

  async update(id: string, dto: UpdateLicencaDto) {
    await this.getLicencaOrFail(id);
    return this.prisma.softwareLicenca.update({
      where: { id },
      data: {
        ...dto,
        dataInicio: dto.dataInicio ? new Date(dto.dataInicio) : undefined,
        dataVencimento: dto.dataVencimento ? new Date(dto.dataVencimento) : undefined,
      },
      include: licencaInclude,
    });
  }

  async renovar(id: string) {
    const anterior = await this.getLicencaOrFail(id);

    // Inativar a licenca anterior
    await this.prisma.softwareLicenca.update({
      where: { id },
      data: { status: 'INATIVA' },
    });

    // Criar nova licenca copiando dados da anterior (RN-LIC-08)
    const nova = await this.prisma.softwareLicenca.create({
      data: {
        softwareId: anterior.softwareId,
        modeloLicenca: anterior.modeloLicenca,
        quantidade: anterior.quantidade,
        valorTotal: anterior.valorTotal,
        valorUnitario: anterior.valorUnitario,
        fornecedor: anterior.fornecedor,
        chaveSerial: anterior.chaveSerial,
        observacoes: `Renovacao da licenca anterior (${anterior.id})`,
      },
      include: licencaInclude,
    });

    return nova;
  }

  async inativar(id: string) {
    await this.getLicencaOrFail(id);
    return this.prisma.softwareLicenca.update({
      where: { id },
      data: { status: 'INATIVA' },
      include: licencaInclude,
    });
  }

  // ─── Helpers ──────────────────────────────────────────────

  private async getLicencaOrFail(id: string) {
    const licenca = await this.prisma.softwareLicenca.findUnique({ where: { id } });
    if (!licenca) throw new NotFoundException('Licenca nao encontrada');
    return licenca;
  }

  private filterSensitiveFields(licencas: unknown[], role: string) {
    if (['ADMIN', 'GESTOR_TI'].includes(role)) return licencas;
    return licencas.map((l) => this.filterSensitiveField(l, role));
  }

  private filterSensitiveField(licenca: unknown, role: string) {
    if (['ADMIN', 'GESTOR_TI'].includes(role)) return licenca;
    const obj = { ...(licenca as Record<string, unknown>) };
    obj.chaveSerial = null;
    return obj;
  }
}
