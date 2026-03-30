import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as https from 'https';
import * as http from 'http';
import {
  CreateIntegracaoDto,
  UpdateIntegracaoDto,
  CreateEndpointDto,
  UpdateEndpointDto,
  TestarEndpointDto,
} from './dto/integracao.dto';

@Injectable()
export class IntegracaoService {
  constructor(private prisma: PrismaService) {}

  // --- Integracoes ---

  async findAll() {
    return this.prisma.integracaoApi.findMany({
      include: {
        endpoints: { orderBy: [{ ambiente: 'asc' }, { operacao: 'asc' }] },
      },
      orderBy: { nome: 'asc' },
    });
  }

  async findOne(id: string) {
    const integracao = await this.prisma.integracaoApi.findUnique({
      where: { id },
      include: {
        endpoints: { orderBy: [{ ambiente: 'asc' }, { operacao: 'asc' }] },
      },
    });
    if (!integracao) throw new NotFoundException('Integracao nao encontrada');
    return integracao;
  }

  async findByCodigo(codigo: string) {
    const integracao = await this.prisma.integracaoApi.findUnique({
      where: { codigo },
      include: {
        endpoints: { orderBy: [{ ambiente: 'asc' }, { operacao: 'asc' }] },
      },
    });
    if (!integracao) throw new NotFoundException(`Integracao "${codigo}" nao encontrada`);
    return integracao;
  }

  async getEndpointsAtivos(codigo: string) {
    const integracao = await this.prisma.integracaoApi.findUnique({
      where: { codigo },
      include: {
        endpoints: {
          where: { ativo: true },
          orderBy: { operacao: 'asc' },
        },
      },
    });
    if (!integracao) throw new NotFoundException(`Integracao "${codigo}" nao encontrada`);

    const endpointsDoAmbiente = integracao.endpoints.filter(
      (ep) => ep.ambiente === integracao.ambiente,
    );

    return {
      codigo: integracao.codigo,
      nome: integracao.nome,
      ambiente: integracao.ambiente,
      tipoAuth: integracao.tipoAuth,
      authConfig: integracao.authConfig,
      endpoints: endpointsDoAmbiente.map((ep) => ({
        operacao: ep.operacao,
        url: ep.url,
        metodo: ep.metodo,
        timeoutMs: ep.timeoutMs,
        headers: ep.headers,
      })),
    };
  }

  async create(dto: CreateIntegracaoDto) {
    const { endpoints, ...data } = dto;
    return this.prisma.integracaoApi.create({
      data: {
        ...data,
        endpoints: endpoints?.length
          ? { create: endpoints }
          : undefined,
      },
      include: { endpoints: true },
    });
  }

  async update(id: string, dto: UpdateIntegracaoDto) {
    await this.findOne(id);
    return this.prisma.integracaoApi.update({
      where: { id },
      data: dto,
      include: { endpoints: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.integracaoApi.delete({ where: { id } });
    return { success: true, message: 'Integracao excluida com sucesso' };
  }

  // --- Endpoints ---

  async addEndpoint(integracaoId: string, dto: CreateEndpointDto) {
    await this.findOne(integracaoId);
    try {
      return await this.prisma.integracaoApiEndpoint.create({
        data: { ...dto, integracaoId },
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new ConflictException(
          `Endpoint "${dto.operacao}" ja existe para ambiente ${dto.ambiente} nesta integracao`,
        );
      }
      throw err;
    }
  }

  async updateEndpoint(endpointId: string, dto: UpdateEndpointDto) {
    const ep = await this.prisma.integracaoApiEndpoint.findUnique({ where: { id: endpointId } });
    if (!ep) throw new NotFoundException('Endpoint nao encontrado');
    return this.prisma.integracaoApiEndpoint.update({
      where: { id: endpointId },
      data: dto,
    });
  }

  async removeEndpoint(endpointId: string) {
    const ep = await this.prisma.integracaoApiEndpoint.findUnique({ where: { id: endpointId } });
    if (!ep) throw new NotFoundException('Endpoint nao encontrado');
    await this.prisma.integracaoApiEndpoint.delete({ where: { id: endpointId } });
    return { success: true, message: 'Endpoint excluido com sucesso' };
  }

  // --- Testar conexao ---

  async testarConexao(dto: TestarEndpointDto) {
    const startTime = Date.now();
    const timeoutMs = dto.timeoutMs || 15000;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(dto.headers || {}),
    };
    if (dto.authHeader) {
      headers['Authorization'] = dto.authHeader;
    }

    return new Promise<{
      sucesso: boolean;
      status: number;
      statusText: string;
      duracao: number;
      url: string;
    }>((resolve) => {
      const urlObj = new URL(dto.url);
      const isHttps = urlObj.protocol === 'https:';
      const transport = isHttps ? https : http;

      const options: https.RequestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: dto.metodo,
        headers,
        timeout: timeoutMs,
        rejectUnauthorized: false,
      };

      const req = transport.request(options, (res) => {
        // Consumir body para liberar o socket
        res.resume();
        res.on('end', () => {
          // Qualquer resposta HTTP = conexao OK (servidor respondeu)
          resolve({
            sucesso: (res.statusCode || 0) > 0,
            status: res.statusCode || 0,
            statusText: res.statusMessage || '',
            duracao: Date.now() - startTime,
            url: dto.url,
          });
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          sucesso: false,
          status: 0,
          statusText: 'Timeout',
          duracao: Date.now() - startTime,
          url: dto.url,
        });
      });

      req.on('error', (err: Error) => {
        resolve({
          sucesso: false,
          status: 0,
          statusText: err.message,
          duracao: Date.now() - startTime,
          url: dto.url,
        });
      });

      req.end();
    });
  }
}
