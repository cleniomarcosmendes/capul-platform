import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { TipoComprovante } from '@prisma-cofre/client';
import { PrismaCofreService } from '../prisma/prisma-cofre.service.js';
import { CofreStorageService } from './cofre-storage.service.js';

export interface GravarComprovanteInput {
  entregaId: string;
  entregaNumero?: number;
  filialId: string;
  matricula?: string | null;
  cupom?: string | null;
  tipo: TipoComprovante;
  binario: Buffer;
  mimeType?: string;
  geoLat?: number | null;
  geoLng?: number | null;
  entregadorId: string;
  trilha?: Record<string, unknown> | null;
}

export interface BuscarComprovanteFiltro {
  entregaId?: string;
  matricula?: string;
  cupom?: string;
  entregaNumero?: number;
  filialId?: string;
}

/**
 * Cofre de comprovante de entrega — fachada que une o METADADO (Postgres
 * isolado, via PrismaCofreService) e o BINÁRIO (object store, via
 * CofreStorageService).
 *
 * APPEND-ONLY: só grava e consulta. Não há update/delete — uma correção vira
 * um NOVO comprovante. O vínculo entrega↔comprovante é resolvido no app (o
 * `logistica` guarda só temComprovante + comprovanteId); aqui não há JOIN SQL
 * cross-DB.
 */
@Injectable()
export class CofreService {
  private readonly logger = new Logger(CofreService.name);

  constructor(
    private readonly cofre: PrismaCofreService,
    private readonly storage: CofreStorageService,
  ) {}

  /**
   * Grava uma prova: sobe o binário no store, persiste o metadado imutável e
   * devolve o id do comprovante (que o `logistica` guarda como referência leve).
   */
  async gravar(input: GravarComprovanteInput): Promise<{ comprovanteId: string; objectKey: string; hash: string }> {
    const { objectKey, hash, tamanhoBytes } = await this.storage.put(input.binario, {
      filialId: input.filialId,
      entregaId: input.entregaId,
      mimeType: input.mimeType,
    });

    const row = await this.cofre.comprovante.create({
      data: {
        entregaId: input.entregaId,
        entregaNumero: input.entregaNumero ?? null,
        filialId: input.filialId,
        matricula: input.matricula ?? null,
        cupom: input.cupom ?? null,
        tipo: input.tipo,
        objectKey,
        hash,
        mimeType: input.mimeType ?? null,
        tamanhoBytes,
        geoLat: input.geoLat ?? null,
        geoLng: input.geoLng ?? null,
        entregadorId: input.entregadorId,
        trilha: (input.trilha ?? undefined) as never,
      },
    });

    this.logger.log(`Comprovante ${row.id} gravado p/ entrega ${input.entregaId} (${tamanhoBytes} bytes)`);
    return { comprovanteId: row.id, objectKey, hash };
  }

  /** Metadados de um comprovante (sem o binário). */
  async obterMetadado(comprovanteId: string) {
    const row = await this.cofre.comprovante.findUnique({ where: { id: comprovanteId } });
    if (!row) throw new NotFoundException('Comprovante não encontrado');
    return row;
  }

  /** Comprovantes de uma entrega (uma entrega pode ter +1 prova). */
  obterPorEntrega(entregaId: string) {
    return this.cofre.comprovante.findMany({
      where: { entregaId },
      orderBy: { capturadoEm: 'asc' },
    });
  }

  /** Consulta do financeiro: por matrícula/cupom/nº de entrega (lastro). */
  buscar(filtro: BuscarComprovanteFiltro) {
    return this.cofre.comprovante.findMany({
      where: {
        entregaId: filtro.entregaId,
        matricula: filtro.matricula,
        cupom: filtro.cupom,
        entregaNumero: filtro.entregaNumero,
        filialId: filtro.filialId,
      },
      orderBy: { capturadoEm: 'desc' },
      take: 200,
    });
  }

  /** Baixa o binário de um comprovante (download na consulta). */
  async obterBinario(comprovanteId: string): Promise<{ buffer: Buffer; mimeType: string }> {
    const meta = await this.obterMetadado(comprovanteId);
    const buffer = await this.storage.get(meta.objectKey);
    return { buffer, mimeType: meta.mimeType ?? 'application/octet-stream' };
  }
}
