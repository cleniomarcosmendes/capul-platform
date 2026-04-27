import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { DocumentoEvento } from '@prisma/client';

/**
 * Tipo de evento "AUTORIZACAO" — protocolo inicial de autorização da NF-e/CT-e.
 * Os demais tipos seguem o tpEvento oficial SEFAZ (110110 CC-e, 110111 Canc, etc.).
 */
export const TIPO_EVENTO_AUTORIZACAO = 'AUTORIZACAO';

export interface EventoInput {
  tipoEvento: string;
  descricao: string;
  dataEvento: Date;
  protocoloEvento?: string | null;
  /** Id do Evento (XML procEventoNFe). Disponibilizado pelo Protheus em 27/04/2026. */
  idEvento?: string | null;
  cStat?: string | null;
  xMotivo?: string | null;
  xmlEvento?: string | null;
}

/**
 * Mapa amigável dos tpEvento mais comuns — usado para rotular a timeline
 * no frontend quando o xEvento da SEFAZ vem genérico ou vazio.
 */
export const TIPO_EVENTO_LABEL: Record<string, string> = {
  AUTORIZACAO: 'Autorização',
  '110110': 'Carta de Correção (CC-e)',
  '110111': 'Cancelamento',
  '110112': 'Cancelamento por substituição',
  '110113': 'EPEC',
  '110140': 'EPEC',
  '110160': 'CT-e Complementar',
  '110170': 'CT-e Substituto',
  '110180': 'Comprovante de Entrega do CT-e',
  '110181': 'Cancelamento do Comprovante de Entrega',
  '110190': 'Comprovante de Entrega',
  '110191': 'Cancelamento do Comprovante de Entrega',
  '210200': 'Confirmação da Operação',
  '210210': 'Ciência da Operação',
  '210220': 'Desconhecimento da Operação',
  '210240': 'Operação não Realizada',
  '310610': 'MDF-e Autorizado vinculado ao CT-e',
  '310620': 'Cancelamento de MDF-e vinculado ao CT-e',
  '510620': 'Autorização de Uso CT-e',
  '510630': 'Registro de Passagem (MDFe)',
  '610110': 'Prestação de Serviço em Desacordo',
  '610111': 'Cancelamento de Prestação em Desacordo',
  '640600': 'GTV-e',
};

/**
 * Gerencia a tabela fiscal.documento_evento — timeline de eventos
 * de um documento (autorização + eventos subsequentes).
 *
 * Dedupe via @@unique(documentoId, tipoEvento, dataEvento) — chamar upsertMany
 * repetidas vezes é idempotente.
 */
@Injectable()
export class DocumentoEventoService {
  private readonly logger = new Logger(DocumentoEventoService.name);

  constructor(private readonly prisma: PrismaService) {}

  async upsertMany(documentoId: string, eventos: EventoInput[]): Promise<void> {
    if (eventos.length === 0) return;
    for (const evt of eventos) {
      try {
        await this.prisma.documentoEvento.upsert({
          where: {
            documento_evento_unique: {
              documentoId,
              tipoEvento: evt.tipoEvento,
              dataEvento: evt.dataEvento,
            },
          },
          create: {
            documentoId,
            tipoEvento: evt.tipoEvento,
            descricao: evt.descricao,
            dataEvento: evt.dataEvento,
            protocoloEvento: evt.protocoloEvento ?? null,
            idEvento: evt.idEvento ?? null,
            cStat: evt.cStat ?? null,
            xMotivo: evt.xMotivo ?? null,
            xmlEvento: evt.xmlEvento ?? null,
          },
          update: {
            descricao: evt.descricao,
            protocoloEvento: evt.protocoloEvento ?? undefined,
            idEvento: evt.idEvento ?? undefined,
            cStat: evt.cStat ?? undefined,
            xMotivo: evt.xMotivo ?? undefined,
            // Caso típico: evento foi criado primeiro via "Atualizar eventos
            // (Protheus)" sem XML, depois "Atualizar status no SEFAZ" trouxe
            // o procEventoNFe completo. Sem essa linha o XML era descartado
            // e o detalhe sintético sobrevivia eternamente — cobrindo os
            // campos que só existem no XML (xJust, nSeqEvento, dhRegEvento).
            xmlEvento: evt.xmlEvento ?? undefined,
          },
        });
      } catch (err) {
        // Isolamos falhas por evento — um evento mal-formado não deve
        // derrubar a persistência dos outros. Logamos message + code + meta
        // porque Prisma validation errors às vezes deixam `.message` vazio
        // mas expõem o motivo real em `.code` ou `.meta` (ex.: P2000 =
        // string too long para a coluna).
        const anyErr = err as any;
        const msg =
          (err as Error).message ||
          anyErr?.code ||
          anyErr?.meta?.target ||
          JSON.stringify(anyErr).slice(0, 200) ||
          '(sem mensagem)';
        this.logger.warn(
          `Falha ao persistir evento ${evt.tipoEvento} para documento ${documentoId}: ${msg}`,
        );
      }
    }
  }

  async listarPorDocumento(documentoId: string): Promise<DocumentoEvento[]> {
    return this.prisma.documentoEvento.findMany({
      where: { documentoId },
      orderBy: { dataEvento: 'asc' },
    });
  }

  async findById(id: string): Promise<DocumentoEvento | null> {
    return this.prisma.documentoEvento.findUnique({ where: { id } });
  }
}
