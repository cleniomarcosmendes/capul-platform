import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { JwtPayload } from '../common/decorators/current-user.decorator.js';
import { filialDoUsuario } from '../common/filial-scope.js';
import { consolidar } from './geo.util.js';

/** Precisão (m) máxima de uma marcação p/ alimentar a consolidação. Acima disso o GPS é
 *  ruim demais e o ponto é ignorado (mas continua gravado na parada, como auditoria). */
const PRECISAO_MAX_M = 50;

const norm = (m: string) => m.trim().toUpperCase();

export interface CriarLocalClienteDto {
  clienteMatricula: string;
  clienteNome?: string;
  tipo?: 'PROPRIEDADE' | 'ENTREGA' | 'OUTRO';
  nome: string;
  municipio?: string;
}

@Injectable()
export class LocalClienteService {
  constructor(private readonly prisma: PrismaService) {}

  /** Locais geolocalizados de um cliente (da filial do usuário + globais), com a
   *  coordenada consolidada de cada um. Base do seletor "escolha o local". */
  async listarPorCliente(clienteMatricula: string, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    if (!clienteMatricula?.trim()) throw new BadRequestException('Informe a matrícula do cliente.');
    return this.prisma.localCliente.findMany({
      where: { clienteMatricula: norm(clienteMatricula), ativo: true, OR: [{ filialId }, { filialId: null }] },
      orderBy: [{ tipo: 'asc' }, { nome: 'asc' }],
    });
  }

  async obter(id: string) {
    const l = await this.prisma.localCliente.findUnique({ where: { id } });
    if (!l) throw new NotFoundException('Local não encontrado.');
    return l;
  }

  /** Cria (ou reaproveita, pela chave cliente+tipo+nome) um local do cliente. Idempotente:
   *  reenvio com a mesma chave devolve o existente em vez de estourar o unique. */
  async criar(dto: CriarLocalClienteDto, user: JwtPayload) {
    const filialId = filialDoUsuario(user);
    const nome = dto.nome?.trim();
    const clienteMatricula = norm(dto.clienteMatricula ?? '');
    if (!clienteMatricula) throw new BadRequestException('Informe a matrícula do cliente.');
    if (!nome) throw new BadRequestException('Informe o nome do local.');
    const tipo = dto.tipo ?? 'PROPRIEDADE';
    const existente = await this.prisma.localCliente.findUnique({
      where: { clienteMatricula_tipo_nome: { clienteMatricula, tipo, nome } },
    });
    if (existente) return existente;
    return this.prisma.localCliente.create({
      data: {
        filialId, clienteMatricula, clienteNome: dto.clienteNome?.trim() || null,
        tipo, nome, municipio: dto.municipio?.trim() || null,
      },
    });
  }

  /**
   * Recalcula a localização CONSOLIDADA de um local a partir das suas marcações
   * (paradas) — só as `noLocal=true` com precisão boa. Atualiza coordenada + confiança
   * + nº de marcações + raio. Chamado após cada nova marcação (idempotente).
   */
  async consolidar(localClienteId: string) {
    const marcacoes = await this.prisma.parada.findMany({
      where: {
        localClienteId,
        noLocal: true,
        latitude: { not: null },
        longitude: { not: null },
      },
      select: { latitude: true, longitude: true, precisaoM: true },
    });
    const pontos = marcacoes
      .filter((m) => m.precisaoM == null || m.precisaoM <= PRECISAO_MAX_M)
      .map((m) => ({ lat: Number(m.latitude), lng: Number(m.longitude) }));

    const c = consolidar(pontos);
    return this.prisma.localCliente.update({
      where: { id: localClienteId },
      data: c
        ? {
            latConsolidada: new Prisma.Decimal(c.lat),
            longConsolidada: new Prisma.Decimal(c.lng),
            confianca: c.confianca,
            nMarcacoes: c.nMarcacoes,
            raioDispersaoM: c.raioDispersaoM,
            consolidadoEm: new Date(),
          }
        : {
            latConsolidada: null, longConsolidada: null, confianca: 'SEM_DADO',
            nMarcacoes: 0, raioDispersaoM: null, consolidadoEm: new Date(),
          },
    });
  }
}
