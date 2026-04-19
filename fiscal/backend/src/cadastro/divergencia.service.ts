import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CriticidadeDivergencia } from '@prisma/client';

export interface DadosProtheusComparacao {
  razaoSocial?: string | null;
  inscricaoEstadual?: string | null;
  cnae?: string | null;
  enderecoCep?: string | null;
  enderecoMunicipio?: string | null;
}

export interface DadosSefazComparacao {
  razaoSocial?: string | null;
  inscricaoEstadual?: string | null;
  cnae?: string | null;
  enderecoCep?: string | null;
  enderecoMunicipio?: string | null;
}

interface DivergenciaDetectada {
  campo: string;
  valorProtheus: string | null;
  valorSefaz: string | null;
  criticidade: CriticidadeDivergencia;
}

/**
 * Detecta divergências entre cadastro Protheus (SA1010/SA2010) e cadastro
 * oficial SEFAZ (CCC) após uma consulta do cruzamento. Grava em
 * `fiscal.cadastro_divergencia` com status ABERTA para a tela `/divergencias`.
 *
 * Regras:
 *   - Apenas gera divergência quando AMBOS os valores existem E são diferentes.
 *     Se Protheus está vazio mas SEFAZ tem dado, não é divergência (é cadastro
 *     incompleto, tratado em outro fluxo).
 *   - Evita duplicar: se já existe divergência ABERTA do mesmo campo para o
 *     mesmo contribuinte, atualiza `detectadaEm` em vez de criar nova.
 *   - Não inclui `situacao` (tratada via `cadastro_historico` + digest).
 */
@Injectable()
export class DivergenciaService {
  private readonly logger = new Logger(DivergenciaService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Compara Protheus × SEFAZ e grava/atualiza divergências.
   * Retorna a quantidade de divergências detectadas (novas ou reabertas).
   */
  async avaliarEgrav(
    contribuinteId: string,
    protheus: DadosProtheusComparacao,
    sefaz: DadosSefazComparacao,
  ): Promise<number> {
    const detectadas = this.comparar(protheus, sefaz);
    if (detectadas.length === 0) return 0;

    for (const d of detectadas) {
      await this.upsertDivergencia(contribuinteId, d);
    }

    this.logger.debug(
      `Contribuinte ${contribuinteId.slice(0, 8)}: ${detectadas.length} divergência(s) detectada(s).`,
    );
    return detectadas.length;
  }

  // ----- internos -----

  private comparar(
    p: DadosProtheusComparacao,
    s: DadosSefazComparacao,
  ): DivergenciaDetectada[] {
    const out: DivergenciaDetectada[] = [];

    // Razão social — case-insensitive + trim + remove acentos
    if (
      p.razaoSocial &&
      s.razaoSocial &&
      this.normalizarTexto(p.razaoSocial) !== this.normalizarTexto(s.razaoSocial)
    ) {
      out.push({
        campo: 'razao_social',
        valorProtheus: p.razaoSocial.trim(),
        valorSefaz: s.razaoSocial.trim(),
        criticidade: 'ALTA',
      });
    }

    // IE — remove pontuação. 'ISENTO' vs número real = ALTA.
    if (p.inscricaoEstadual && s.inscricaoEstadual) {
      const pie = this.normalizarIe(p.inscricaoEstadual);
      const sie = this.normalizarIe(s.inscricaoEstadual);
      if (pie !== sie) {
        const isencaoInconsistente =
          (pie === 'ISENTO') !== (sie === 'ISENTO');
        out.push({
          campo: 'inscricao_estadual',
          valorProtheus: p.inscricaoEstadual.trim(),
          valorSefaz: s.inscricaoEstadual.trim(),
          criticidade: isencaoInconsistente ? 'ALTA' : 'MEDIA',
        });
      }
    }

    // CNAE — compara primeiros 4 dígitos (classe CNAE). Diferença → MEDIA.
    if (p.cnae && s.cnae) {
      const pcnae = this.normalizarCnae(p.cnae).slice(0, 4);
      const scnae = this.normalizarCnae(s.cnae).slice(0, 4);
      if (pcnae && scnae && pcnae !== scnae) {
        out.push({
          campo: 'cnae',
          valorProtheus: p.cnae.trim(),
          valorSefaz: s.cnae.trim(),
          criticidade: 'MEDIA',
        });
      }
    }

    // CEP — remove formatação. Diferença → BAIXA (pode ser mudança endereço).
    if (p.enderecoCep && s.enderecoCep) {
      const pc = p.enderecoCep.replace(/\D/g, '');
      const sc = s.enderecoCep.replace(/\D/g, '');
      if (pc && sc && pc !== sc) {
        out.push({
          campo: 'endereco_cep',
          valorProtheus: p.enderecoCep.trim(),
          valorSefaz: s.enderecoCep.trim(),
          criticidade: 'BAIXA',
        });
      }
    }

    // Município — case-insensitive + sem acentos. Diferença → BAIXA.
    if (
      p.enderecoMunicipio &&
      s.enderecoMunicipio &&
      this.normalizarTexto(p.enderecoMunicipio) !==
        this.normalizarTexto(s.enderecoMunicipio)
    ) {
      out.push({
        campo: 'endereco_municipio',
        valorProtheus: p.enderecoMunicipio.trim(),
        valorSefaz: s.enderecoMunicipio.trim(),
        criticidade: 'BAIXA',
      });
    }

    return out;
  }

  /**
   * Upsert por (contribuinteId, campo, status=ABERTA):
   *   - Se já existe aberta, só atualiza valores + detectadaEm (divergência
   *     persiste entre cruzamentos até alguém resolver).
   *   - Se não existe, cria nova ABERTA.
   *   - Se existia RESOLVIDA/IGNORADA e agora voltou a divergir, cria NOVA
   *     aberta (não reabre a antiga — preserva auditoria da resolução).
   */
  private async upsertDivergencia(
    contribuinteId: string,
    d: DivergenciaDetectada,
  ): Promise<void> {
    const existente = await this.prisma.cadastroDivergencia.findFirst({
      where: { contribuinteId, campo: d.campo, status: 'ABERTA' },
    });

    if (existente) {
      // Atualiza valores + timestamp (caso SEFAZ tenha mudado enquanto a
      // divergência continuava aberta, reflete o estado atual).
      await this.prisma.cadastroDivergencia.update({
        where: { id: existente.id },
        data: {
          valorProtheus: d.valorProtheus,
          valorSefaz: d.valorSefaz,
          criticidade: d.criticidade,
          detectadaEm: new Date(),
        },
      });
    } else {
      await this.prisma.cadastroDivergencia.create({
        data: {
          contribuinteId,
          campo: d.campo,
          valorProtheus: d.valorProtheus,
          valorSefaz: d.valorSefaz,
          criticidade: d.criticidade,
          status: 'ABERTA',
        },
      });
    }
  }

  private normalizarTexto(s: string): string {
    return s
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove diacríticos
      .replace(/\s+/g, ' ');
  }

  private normalizarIe(ie: string): string {
    const t = ie.trim().toUpperCase();
    if (t === 'ISENTO' || t === 'ISENTA') return 'ISENTO';
    return t.replace(/\D/g, '');
  }

  private normalizarCnae(cnae: string): string {
    return cnae.replace(/\D/g, '');
  }
}
