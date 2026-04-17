import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { OrigemConsulta, TipoDocumentoFiscal, DocumentoConsulta } from '@prisma/client';

export interface RegistrarConsultaInput {
  chave: string;
  tipoDocumento: TipoDocumentoFiscal;
  filial: string;
  usuarioId: string;
  usuarioEmail: string;
  origem: OrigemConsulta;
  ambienteSefaz: string;
  protocoloAutorizacao?: string | null;
  dataAutorizacao?: Date | null;
  cnpjEmitente?: string | null;
  cnpjDestinatario?: string | null;
  numeroNF?: string | null;
  serie?: string | null;
  valorTotal?: number | null;
  statusAtual?: string | null;
  erroMensagem?: string | null;
}

/**
 * Upsert em `fiscal.documento_consulta` — uma linha por (chave, filial).
 * Idempotente: chamadas repetidas para a mesma chave atualizam `updated_at`
 * e outros metadados voláteis (último status, último erro, etc.), mas não
 * duplicam registros.
 */
@Injectable()
export class DocumentoConsultaService {
  private readonly logger = new Logger(DocumentoConsultaService.name);

  constructor(private readonly prisma: PrismaService) {}

  async registrar(input: RegistrarConsultaInput): Promise<DocumentoConsulta> {
    const valorTotal = input.valorTotal ?? null;
    return this.prisma.documentoConsulta.upsert({
      where: { chave_filial: { chave: input.chave, filial: input.filial } },
      create: {
        chave: input.chave,
        tipoDocumento: input.tipoDocumento,
        filial: input.filial,
        usuarioId: input.usuarioId,
        usuarioEmail: input.usuarioEmail,
        origem: input.origem,
        ambienteSefaz: input.ambienteSefaz,
        protocoloAutorizacao: input.protocoloAutorizacao,
        dataAutorizacao: input.dataAutorizacao,
        cnpjEmitente: input.cnpjEmitente,
        cnpjDestinatario: input.cnpjDestinatario,
        numeroNF: input.numeroNF,
        serie: input.serie,
        valorTotal: valorTotal !== null ? valorTotal : undefined,
        statusAtual: input.statusAtual,
        erroMensagem: input.erroMensagem,
      },
      update: {
        origem: input.origem,
        statusAtual: input.statusAtual,
        erroMensagem: input.erroMensagem,
        // atualiza protocolo e valor se vieram (ex.: primeira consulta foi cache miss,
        // segunda já veio do Protheus com protocolo preenchido)
        protocoloAutorizacao: input.protocoloAutorizacao ?? undefined,
        dataAutorizacao: input.dataAutorizacao ?? undefined,
        cnpjEmitente: input.cnpjEmitente ?? undefined,
        cnpjDestinatario: input.cnpjDestinatario ?? undefined,
        numeroNF: input.numeroNF ?? undefined,
        serie: input.serie ?? undefined,
        valorTotal: valorTotal !== null ? valorTotal : undefined,
      },
    });
  }

  async marcarStatusSefazAtualizado(id: string, statusAtual: string): Promise<void> {
    await this.prisma.documentoConsulta.update({
      where: { id },
      data: { consultaSefazAtualizadaEm: new Date(), statusAtual },
    });
  }

  async findByChave(chave: string, filial: string): Promise<DocumentoConsulta | null> {
    return this.prisma.documentoConsulta.findUnique({
      where: { chave_filial: { chave, filial } },
    });
  }

  async listarHistoricoUsuario(usuarioId: string, limit = 50): Promise<DocumentoConsulta[]> {
    return this.prisma.documentoConsulta.findMany({
      where: { usuarioId },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  }
}
