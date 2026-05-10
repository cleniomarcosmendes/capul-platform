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
  /** Body JSON da última tentativa grvXML — debug fiscal autoatendido. */
  protheusGrvRequest?: string | null;
  /** Flags granulares do retorno grvXML (08/05/2026). NULL = nao tentou ou skipped. */
  grvFlags?: {
    sucesso: boolean;
    xmlGravado: boolean;
    pendenteAmarracao: boolean;
    preNotaFalhou: boolean;
    mensagem: string;
    jaExistia: boolean;
  } | null;
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
    // Truncate defensivo — alguns retornos SEFAZ vêm com placeholder não-substituído
    // (ex.: "Autorizado o uso do $APP_NAME_FORMATED$" = 39 chars > varchar(30) de
    // statusAtual). Sem isso o upsert quebra com P2000. Limites espelham o schema.
    const trunc = (v: string | null | undefined, max: number): string | null | undefined =>
      typeof v === 'string' && v.length > max ? v.slice(0, max) : v;
    const statusAtual = trunc(input.statusAtual, 30);
    const numeroNF = trunc(input.numeroNF, 9);
    const serie = trunc(input.serie, 3);
    const ambienteSefaz = trunc(input.ambienteSefaz, 20) ?? input.ambienteSefaz;
    // Flags granulares (08/05/2026): undefined deixa Prisma nao alterar campo,
    // null sobrescreve. So passamos null/valor quando a chamada teve gravacao
    // real (grvFlags != null no helper).
    const grvFields = input.grvFlags
      ? {
          protheusGrvSucesso: input.grvFlags.sucesso,
          protheusGrvXmlGravado: input.grvFlags.xmlGravado,
          protheusGrvPendAmarracao: input.grvFlags.pendenteAmarracao,
          protheusGrvPrenotaFalhou: input.grvFlags.preNotaFalhou,
          protheusGrvMensagem: input.grvFlags.mensagem,
          protheusGrvJaExistia: input.grvFlags.jaExistia,
        }
      : {};
    return this.prisma.documentoConsulta.upsert({
      where: { chave_filial: { chave: input.chave, filial: input.filial } },
      create: {
        chave: input.chave,
        tipoDocumento: input.tipoDocumento,
        filial: input.filial,
        usuarioId: input.usuarioId,
        usuarioEmail: input.usuarioEmail,
        origem: input.origem,
        ambienteSefaz,
        protocoloAutorizacao: input.protocoloAutorizacao,
        dataAutorizacao: input.dataAutorizacao,
        cnpjEmitente: input.cnpjEmitente,
        cnpjDestinatario: input.cnpjDestinatario,
        numeroNF,
        serie,
        valorTotal: valorTotal !== null ? valorTotal : undefined,
        statusAtual,
        erroMensagem: input.erroMensagem,
        protheusGrvRequest: input.protheusGrvRequest ?? undefined,
        ...grvFields,
      },
      update: {
        origem: input.origem,
        statusAtual,
        erroMensagem: input.erroMensagem,
        // atualiza protocolo e valor se vieram (ex.: primeira consulta foi cache miss,
        // segunda já veio do Protheus com protocolo preenchido)
        protocoloAutorizacao: input.protocoloAutorizacao ?? undefined,
        dataAutorizacao: input.dataAutorizacao ?? undefined,
        cnpjEmitente: input.cnpjEmitente ?? undefined,
        cnpjDestinatario: input.cnpjDestinatario ?? undefined,
        numeroNF: numeroNF ?? undefined,
        serie: serie ?? undefined,
        valorTotal: valorTotal !== null ? valorTotal : undefined,
        // protheusGrvRequest atualizado a cada nova tentativa de gravação,
        // mesmo se o request anterior teve sucesso — permite debug de
        // problemas que aparecem só em algumas chaves.
        protheusGrvRequest: input.protheusGrvRequest ?? undefined,
        ...grvFields,
      },
    });
  }

  async marcarStatusSefazAtualizado(id: string, statusAtual: string): Promise<void> {
    const truncated = statusAtual.length > 30 ? statusAtual.slice(0, 30) : statusAtual;
    await this.prisma.documentoConsulta.update({
      where: { id },
      data: { consultaSefazAtualizadaEm: new Date(), statusAtual: truncated },
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

  /**
   * Lista NF-es com pendencias de correcao (08/05/2026).
   *
   * NF-es onde nossa app gravou via grvXML e Protheus retornou pendencia
   * operacional (preNotaFalhou OU pendenteAmarracao). Conjunto finito —
   * nao inclui NF-es gravadas por outros meios (sem flags persistidas).
   */
  async listarPendencias(filtros: {
    page?: number;
    limit?: number;
    search?: string;
    inconsistenciaFiltro?: 'pendentes' | 'resolvidas' | 'todas';
  }) {
    const page = Math.max(1, filtros.page ?? 1);
    const limit = Math.min(100, Math.max(1, filtros.limit ?? 20));
    const skip = (page - 1) * limit;

    // Base: NF-es onde nossa app gravou via grvXML e teve pendencia.
    const where: any = {
      protheusGrvXmlGravado: true,
      OR: [
        { protheusGrvPrenotaFalhou: true },
        { protheusGrvPendAmarracao: true },
      ],
    };

    if (filtros.search) {
      where.chave = { contains: filtros.search.replace(/\D/g, '') };
    }

    if (filtros.inconsistenciaFiltro === 'pendentes' || !filtros.inconsistenciaFiltro) {
      where.inconsistenciaResolvidaEm = null;
    } else if (filtros.inconsistenciaFiltro === 'resolvidas') {
      where.inconsistenciaResolvidaEm = { not: null };
    }
    // 'todas' = sem filtro adicional

    const [total, items] = await Promise.all([
      this.prisma.documentoConsulta.count({ where }),
      this.prisma.documentoConsulta.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Marca pendencia como resolvida manualmente no Protheus.
   */
  async marcarInconsistenciaResolvida(params: {
    id: string;
    usuarioId: string;
    usuarioNome: string;
    observacao?: string;
  }): Promise<DocumentoConsulta> {
    const doc = await this.prisma.documentoConsulta.findUnique({ where: { id: params.id } });
    if (!doc) {
      throw new Error(`NF-e id=${params.id} nao encontrado em documento_consulta`);
    }
    const atualizado = await this.prisma.documentoConsulta.update({
      where: { id: params.id },
      data: {
        inconsistenciaResolvidaEm: new Date(),
        inconsistenciaResolvidaPorId: params.usuarioId,
        inconsistenciaResolvidaPorNome: params.usuarioNome,
        inconsistenciaObservacao: params.observacao?.trim() || null,
      },
    });
    this.logger.log(
      `Inconsistencia NF-e id=${params.id} chave=${doc.chave?.slice(0, 8)}… ` +
        `marcada como resolvida por ${params.usuarioNome} (id=${params.usuarioId})`,
    );
    return atualizado;
  }

  /**
   * Desmarca resolucao manual — caso operador tenha marcado por engano.
   */
  async desmarcarInconsistenciaResolvida(id: string): Promise<DocumentoConsulta> {
    const doc = await this.prisma.documentoConsulta.findUnique({ where: { id } });
    if (!doc) {
      throw new Error(`NF-e id=${id} nao encontrado em documento_consulta`);
    }
    const atualizado = await this.prisma.documentoConsulta.update({
      where: { id },
      data: {
        inconsistenciaResolvidaEm: null,
        inconsistenciaResolvidaPorId: null,
        inconsistenciaResolvidaPorNome: null,
        inconsistenciaObservacao: null,
      },
    });
    this.logger.log(
      `Inconsistencia NF-e id=${id} chave=${doc.chave?.slice(0, 8)}… DESMARCADA`,
    );
    return atualizado;
  }
}
