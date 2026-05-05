import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { PapelCapul } from '@prisma/client';

/**
 * Resultado da detecção de papel da Capul num CT-e.
 *
 * - `papel`: enum PapelCapul (DEST/TOMA/REM/EXPED/RECEB/AUTXML/TERCEIRO)
 *   ou `null` se a Capul não aparece no XML
 * - `cnpjCapul`: qual CNPJ da Capul foi identificado (filial específica
 *   que recebeu/contratou — útil pra rateio futuro por filial)
 * - `anomalia`: campo livre pra registrar suspeitas (ex: Capul como emitente
 *   é anomalia porque a regra de negócio diz que Capul não emite CT-e)
 */
export interface ResultadoPapel {
  papel: PapelCapul | null;
  cnpjCapul: string | null;
  anomalia: string | null;
}

/**
 * Identifica em qual papel a Capul aparece num CT-e (modelo 57). Capul é
 * sempre tomadora/destinatária — não emite CT-e (memory negócio).
 *
 * Estratégia: extrai CNPJs dos campos relevantes do `<infCte>` e compara
 * com a lista cacheada de CNPJs da Capul (de `core.filiais`).
 *
 * Hierarquia de papéis (mais específico primeiro):
 *   1. TOMA      — toma3 aponta pra Capul OU toma4 com CNPJ Capul
 *   2. DEST      — `<dest><CNPJ>` é Capul (e não é TOMA)
 *   3. REM       — `<rem><CNPJ>` é Capul
 *   4. EXPED     — `<exped><CNPJ>` é Capul
 *   5. RECEB     — `<receb><CNPJ>` é Capul
 *   6. AUTXML    — Capul aparece em `<autXML><CNPJ>`
 *   7. TERCEIRO  — Capul aparece referenciada no XML mas não é nenhum acima
 *
 * NT 2014.002 — toma3:
 *   <toma3><toma>0|1|2|3</toma></toma3>
 *     0=Remetente, 1=Expedidor, 2=Recebedor, 3=Destinatário
 *   <toma4><toma>4</toma><CNPJ>14digitos</CNPJ>...</toma4>
 *     4=Outro CNPJ não previsto em toma3
 *
 * O resultado é determinístico — mesmo XML sempre retorna mesmo papel.
 */
@Injectable()
export class PapelDetectorService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PapelDetectorService.name);
  private cnpjsCapul: Set<string> = new Set();

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.atualizarCacheCnpjs();
  }

  /**
   * Recarrega o Set de CNPJs Capul de `core.filiais` em memória + retorna
   * a lista (usada pela `SincronizacaoFiliaisService` pra também sincronizar
   * cursores em `cte_controle_nsu`).
   *
   * Filtra apenas filiais com `status='ATIVO'` — filiais inativadas saem
   * do cache (não reconhecidas em CT-es novos), mas CT-es históricos delas
   * permanecem com `papel_capul` correto (foi preenchido quando ativa).
   *
   * Chamar:
   *   - boot do backend (`OnApplicationBootstrap` desta classe)
   *   - cada tick do scheduler (via SincronizacaoFiliaisService)
   *   - manualmente via endpoint admin pós cadastro de filial nova
   */
  async atualizarCacheCnpjs(): Promise<{ total: number; cnpjs: string[] }> {
    const filiais = await this.prisma.client.filialCore.findMany({
      where: { cnpj: { not: null }, status: 'ATIVO' },
      select: { cnpj: true },
    });
    const cnpjs = filiais
      .map((f) => (f.cnpj ?? '').replace(/\D/g, ''))
      .filter((c) => c.length === 14);
    this.cnpjsCapul = new Set(cnpjs);
    this.logger.log(`PapelDetector: ${this.cnpjsCapul.size} CNPJs Capul cacheados (filiais ATIVO)`);
    return { total: this.cnpjsCapul.size, cnpjs };
  }

  /**
   * Detecta papel da Capul num CT-e parseado.
   *
   * @param infCte resultado do XMLParser sobre `<infCte>` (estrutura JS)
   * @returns ResultadoPapel — papel, qual CNPJ Capul detectado, e anomalia se houver
   */
  detectar(infCte: any): ResultadoPapel {
    if (!infCte || typeof infCte !== 'object') {
      return { papel: null, cnpjCapul: null, anomalia: 'infCte ausente ou inválido' };
    }
    if (this.cnpjsCapul.size === 0) {
      // Cache vazio — provavelmente bootstrap ainda não rodou. Não falha,
      // só retorna null pra caller poder retentar depois.
      return { papel: null, cnpjCapul: null, anomalia: 'Cache de CNPJs Capul vazio' };
    }

    // Anomalia: Capul como emit é regra-de-negócio quebrada (não emitimos CT-e)
    const cnpjEmit = this.extrairCnpj(infCte.emit);
    if (cnpjEmit && this.cnpjsCapul.has(cnpjEmit)) {
      this.logger.warn(`PapelDetector: ANOMALIA — Capul aparece como emit no CT-e (cnpj=${cnpjEmit})`);
      return {
        papel: null,
        cnpjCapul: cnpjEmit,
        anomalia: 'Capul aparece como emitente — regra de negócio diz que Capul não emite CT-e',
      };
    }

    // Mapas dos atores (CNPJ → label) — usado pra TOMA via toma3
    const cnpjRem    = this.extrairCnpj(infCte.rem);
    const cnpjExped  = this.extrairCnpj(infCte.exped);
    const cnpjReceb  = this.extrairCnpj(infCte.receb);
    const cnpjDest   = this.extrairCnpj(infCte.dest);
    const cnpjsAtoresCapul = [cnpjRem, cnpjExped, cnpjReceb, cnpjDest].filter(
      (c): c is string => !!c && this.cnpjsCapul.has(c),
    );

    // 1. TOMA via toma3 ou toma4
    const ide = infCte.ide;
    const toma3 = ide?.toma3;
    const toma4 = ide?.toma4;

    if (toma3?.toma !== undefined) {
      const tomaCode = String(toma3.toma);
      const cnpjTomador =
        tomaCode === '0' ? cnpjRem :
        tomaCode === '1' ? cnpjExped :
        tomaCode === '2' ? cnpjReceb :
        tomaCode === '3' ? cnpjDest :
        null;
      if (cnpjTomador && this.cnpjsCapul.has(cnpjTomador)) {
        return { papel: 'TOMA', cnpjCapul: cnpjTomador, anomalia: null };
      }
    }
    if (toma4) {
      const cnpjToma4 = this.extrairCnpj(toma4);
      if (cnpjToma4 && this.cnpjsCapul.has(cnpjToma4)) {
        return { papel: 'TOMA', cnpjCapul: cnpjToma4, anomalia: null };
      }
    }

    // 2-5. Atores específicos (DEST/REM/EXPED/RECEB)
    if (cnpjDest && this.cnpjsCapul.has(cnpjDest)) {
      return { papel: 'DEST', cnpjCapul: cnpjDest, anomalia: null };
    }
    if (cnpjRem && this.cnpjsCapul.has(cnpjRem)) {
      return { papel: 'REM', cnpjCapul: cnpjRem, anomalia: null };
    }
    if (cnpjExped && this.cnpjsCapul.has(cnpjExped)) {
      return { papel: 'EXPED', cnpjCapul: cnpjExped, anomalia: null };
    }
    if (cnpjReceb && this.cnpjsCapul.has(cnpjReceb)) {
      return { papel: 'RECEB', cnpjCapul: cnpjReceb, anomalia: null };
    }

    // 6. autXML (pode ser array — Capul como autorizada a baixar XML mas não ator)
    const autXMLArr = this.normalizarArray(infCte.autXML);
    for (const a of autXMLArr) {
      const cnpjAut = this.extrairCnpj(a);
      if (cnpjAut && this.cnpjsCapul.has(cnpjAut)) {
        return { papel: 'AUTXML', cnpjCapul: cnpjAut, anomalia: null };
      }
    }

    // 7. TERCEIRO — Capul aparece em algum lugar não óbvio do XML.
    // Fallback heurístico: se tinha algum CNPJ ator que era da Capul mas
    // não bateu com nenhum dos casos acima, retorna como ATOR detectado.
    if (cnpjsAtoresCapul.length > 0) {
      return {
        papel: 'TERCEIRO',
        cnpjCapul: cnpjsAtoresCapul[0],
        anomalia: 'Capul detectada em ator mas papel específico não identificado — caso raro, investigar',
      };
    }

    // Se chegou aqui, Capul não está nos atores principais. Pode ser
    // resCTe (resumo) onde Capul é só referenciada — caller decide
    // como tratar baseado no schema.
    return { papel: null, cnpjCapul: null, anomalia: null };
  }

  /**
   * Extrai CNPJ de um nó parseado. Aceita:
   * - { CNPJ: "14digitos" }
   * - { CNPJ: "..." } com máscara → limpa
   * - null/undefined → null
   */
  private extrairCnpj(node: any): string | null {
    if (!node) return null;
    const cnpj = node.CNPJ ?? node.cnpj;
    if (typeof cnpj !== 'string') return null;
    const limpo = cnpj.replace(/\D/g, '');
    return limpo.length === 14 ? limpo : null;
  }

  /**
   * fast-xml-parser entrega array quando há múltiplos elementos OU objeto
   * único. Normaliza pra sempre array (vazio se não existe).
   */
  private normalizarArray(node: any): any[] {
    if (!node) return [];
    return Array.isArray(node) ? node : [node];
  }

  /**
   * Tamanho atual do cache — útil pra healthcheck/diagnóstico.
   */
  get cacheSize(): number {
    return this.cnpjsCapul.size;
  }
}
