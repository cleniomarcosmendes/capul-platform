import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { ModuloConsumidor, AmbienteIntegracao } from '@prisma/client';
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
        endpoints: { orderBy: [{ modulo: 'asc' }, { operacao: 'asc' }, { ambiente: 'asc' }] },
      },
      orderBy: { nome: 'asc' },
    });
  }

  async findOne(id: string) {
    const integracao = await this.prisma.integracaoApi.findUnique({
      where: { id },
      include: {
        endpoints: { orderBy: [{ modulo: 'asc' }, { operacao: 'asc' }, { ambiente: 'asc' }] },
      },
    });
    if (!integracao) throw new NotFoundException('Integracao nao encontrada');
    return integracao;
  }

  async findByCodigo(codigo: string) {
    const integracao = await this.prisma.integracaoApi.findUnique({
      where: { codigo },
      include: {
        endpoints: { orderBy: [{ modulo: 'asc' }, { operacao: 'asc' }, { ambiente: 'asc' }] },
      },
    });
    if (!integracao) throw new NotFoundException(`Integracao "${codigo}" nao encontrada`);
    return integracao;
  }

  /**
   * Retorna os endpoints ATIVOS de um modulo consumidor especifico.
   * Chamado pelos resolvers do Fiscal / Gestao TI / Inventario (Python).
   * O campo `ambiente` do response e derivado: se todos endpoints ativos sao
   * do mesmo ambiente -> esse valor; se mistos -> "MIXED". Usado so para log
   * pelos consumidores — nao para routing.
   */
  async getEndpointsAtivos(codigo: string, modulo?: ModuloConsumidor) {
    const integracao = await this.prisma.integracaoApi.findUnique({
      where: { codigo },
      include: {
        endpoints: {
          where: {
            ativo: true,
            ...(modulo ? { modulo } : {}),
          },
          orderBy: { operacao: 'asc' },
        },
      },
    });
    if (!integracao) throw new NotFoundException(`Integracao "${codigo}" nao encontrada`);

    const ambientes = new Set(integracao.endpoints.map((ep) => ep.ambiente));
    const ambienteDerivado =
      ambientes.size === 0 ? 'HOMOLOGACAO' : ambientes.size === 1 ? [...ambientes][0] : 'MIXED';

    return {
      codigo: integracao.codigo,
      nome: integracao.nome,
      ambiente: ambienteDerivado,
      tipoAuth: integracao.tipoAuth,
      authConfig: integracao.authConfig,
      endpoints: integracao.endpoints.map((ep) => ({
        operacao: ep.operacao,
        modulo: ep.modulo,
        ambiente: ep.ambiente,
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
          `Endpoint "${dto.operacao}" ja existe para modulo ${dto.modulo}, ambiente ${dto.ambiente} nesta integracao`,
        );
      }
      throw err;
    }
  }

  async updateEndpoint(endpointId: string, dto: UpdateEndpointDto) {
    const ep = await this.prisma.integracaoApiEndpoint.findUnique({ where: { id: endpointId } });
    if (!ep) throw new NotFoundException('Endpoint nao encontrado');
    try {
      return await this.prisma.integracaoApiEndpoint.update({
        where: { id: endpointId },
        data: dto,
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new ConflictException(
          'Alteracao viola invariante: ja existe outro endpoint ativo para (modulo, operacao).',
        );
      }
      throw err;
    }
  }

  async removeEndpoint(endpointId: string) {
    const ep = await this.prisma.integracaoApiEndpoint.findUnique({ where: { id: endpointId } });
    if (!ep) throw new NotFoundException('Endpoint nao encontrado');
    await this.prisma.integracaoApiEndpoint.delete({ where: { id: endpointId } });
    return { success: true, message: 'Endpoint excluido com sucesso' };
  }

  /**
   * Ativa um endpoint especifico (ativo=true) e desativa o irmao de mesmo
   * (modulo, operacao) em ambiente diferente. Garante a invariante em uma
   * transacao atomica.
   */
  async ativarEndpoint(integracaoId: string, endpointId: string) {
    const ep = await this.prisma.integracaoApiEndpoint.findUnique({
      where: { id: endpointId },
    });
    if (!ep) throw new NotFoundException('Endpoint nao encontrado');
    if (ep.integracaoId !== integracaoId) {
      throw new BadRequestException('Endpoint nao pertence a essa integracao');
    }

    await this.prisma.$transaction(async (tx) => {
      // Desativa o(s) irmao(s) do mesmo (modulo, operacao) em outros ambientes
      await tx.integracaoApiEndpoint.updateMany({
        where: {
          integracaoId,
          modulo: ep.modulo,
          operacao: ep.operacao,
          NOT: { id: endpointId },
        },
        data: { ativo: false },
      });
      // Ativa o alvo
      await tx.integracaoApiEndpoint.update({
        where: { id: endpointId },
        data: { ativo: true },
      });
    });

    return this.prisma.integracaoApiEndpoint.findUnique({ where: { id: endpointId } });
  }

  /**
   * Para cada operacao do (integracao, modulo), ativa a linha do ambiente
   * pedido e desativa a do outro ambiente. Transacional.
   * Substitui o antigo PATCH /integracoes/:id { ambiente } para o dominio
   * per-modulo.
   */
  async trocarAmbienteModulo(
    integracaoId: string,
    modulo: ModuloConsumidor,
    ambiente: AmbienteIntegracao,
  ) {
    await this.findOne(integracaoId);

    // IMPORTANTE: desativar ANTES de ativar, caso contrario o partial unique
    // index (ativo=true WHERE modulo,operacao) quebra no meio da transacao
    // porque as linhas do ambiente antigo ainda estariam ativas.
    const [, ativados] = await this.prisma.$transaction([
      this.prisma.integracaoApiEndpoint.updateMany({
        where: { integracaoId, modulo, NOT: { ambiente } },
        data: { ativo: false },
      }),
      this.prisma.integracaoApiEndpoint.updateMany({
        where: { integracaoId, modulo, ambiente },
        data: { ativo: true },
      }),
    ]);

    return {
      integracaoId,
      modulo,
      ambiente,
      endpointsAtivados: ativados.count,
    };
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
