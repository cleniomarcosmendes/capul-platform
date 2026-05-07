import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CteControleNsu } from '@prisma/client';

/**
 * CRUD da tabela `fiscal.cte_controle_nsu` — cursor sequencial NSU por
 * CNPJ+ambiente. Usado pelo `DistribuicaoNsuService` para retomar a varredura
 * de onde parou e para implementar o backoff de 1h em caso de cStat=656.
 *
 * Padrão multi-schema: ambiente é INT (1=PRODUCAO, 2=HOMOLOGACAO) — mesmo
 * que SEFAZ usa em `<tpAmb>`.
 */
@Injectable()
export class NsuControleService {
  private readonly logger = new Logger(NsuControleService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retorna o registro de controle pra (cnpj, ambiente). Cria sob demanda
   * se não existir — primeira consulta nunca falha por ausência de cursor.
   */
  async obterOuCriar(cnpj: string, ambiente: 1 | 2): Promise<CteControleNsu> {
    const cnpjClean = cnpj.replace(/\D/g, '');
    const existente = await this.prisma.client.cteControleNsu.findUnique({
      where: { cnpj_ambiente: { cnpj: cnpjClean, ambiente } },
    });
    if (existente) return existente;

    this.logger.log(`Criando controle NSU para cnpj=${cnpjClean} ambiente=${ambiente}`);
    return this.prisma.client.cteControleNsu.create({
      data: { cnpj: cnpjClean, ambiente },
    });
  }

  /**
   * Atualiza cursor após resposta SEFAZ (cStat 137 ou 138). Recebe `ultNSU`
   * e `maxNSU` retornados pela SEFAZ — ambos formato de 15 dígitos zero-padded.
   *
   * `proximaConsulta` opcional — usado pelo orquestrador para implementar
   * adaptive backoff (60min se synced, 15min se há trabalho). Sem isso,
   * scheduler chamaria SEFAZ logo após `ultNSU == maxNSU` e levaria cStat=656.
   */
  async atualizarCursor(params: {
    cnpj: string;
    ambiente: 1 | 2;
    ultNSU: string;
    maxNSU: string;
    proximaConsulta?: Date;
  }): Promise<CteControleNsu> {
    const cnpjClean = params.cnpj.replace(/\D/g, '');
    return this.prisma.client.cteControleNsu.update({
      where: { cnpj_ambiente: { cnpj: cnpjClean, ambiente: params.ambiente } },
      data: {
        ultimoNsuProcessado: params.ultNSU,
        maxNsuConhecido: params.maxNSU,
        ultimaConsulta: new Date(),
        ...(params.proximaConsulta ? { proximaConsulta: params.proximaConsulta } : {}),
      },
    });
  }

  /**
   * Sincroniza `cte_controle_nsu` com a lista de CNPJs ativos da Capul
   * (vinda de `core.filiais`). Garante que toda filial nova ganha cursor
   * automaticamente no próximo tick do scheduler — sem ação manual.
   *
   * Comportamento:
   *   - Filial **nova** (CNPJ ativo sem cursor) → cria cursor com defaults
   *   - Filial **reativada** (CNPJ ativo com cursor `ativo=false`) → re-ativa
   *   - Filial **inativada** (cursor existe mas CNPJ não está mais ativo) → marca `ativo=false`
   *
   * Roda 1× por tick do scheduler (15min) — barato (1-2 queries simples).
   * Idempotente: chamar várias vezes em sequência sem dados novos = no-op.
   *
   * @returns sumário de mudanças aplicadas
   */
  async sincronizarComFiliais(
    cnpjsAtivos: string[],
    ambiente: 1 | 2,
  ): Promise<{ criados: number; reativados: number; inativados: number }> {
    const cnpjsLimpos = cnpjsAtivos
      .map((c) => c.replace(/\D/g, ''))
      .filter((c) => c.length === 14);

    let criados = 0;
    let reativados = 0;

    // 1. Garante cursor pra cada CNPJ ativo (cria se não existe; reativa se inativo)
    for (const cnpj of cnpjsLimpos) {
      const existente = await this.prisma.client.cteControleNsu.findUnique({
        where: { cnpj_ambiente: { cnpj, ambiente } },
        select: { id: true, ativo: true },
      });
      if (!existente) {
        await this.prisma.client.cteControleNsu.create({ data: { cnpj, ambiente } });
        criados++;
      } else if (!existente.ativo) {
        await this.prisma.client.cteControleNsu.update({
          where: { id: existente.id },
          data: { ativo: true },
        });
        reativados++;
      }
    }

    // 2. Inativa cursores cujo CNPJ não está mais na lista de ativos.
    //    Guarda contra `notIn: []` (PostgreSQL aceita, mas semântica
    //    "todos vão pra inativos" é exatamente o que queremos no caso
    //    degenerado de não haver filial ativa).
    const inativados = await this.prisma.client.cteControleNsu.updateMany({
      where: {
        ambiente,
        ativo: true,
        cnpj: cnpjsLimpos.length > 0 ? { notIn: cnpjsLimpos } : undefined,
      },
      data: { ativo: false },
    });

    return { criados, reativados, inativados: inativados.count };
  }

  /**
   * Lista filiais ativas elegíveis pra próxima consulta — usado pelo scheduler.
   * Critério:
   *   - ativo = true
   *   - bloqueadoAte vencido OU NULL
   *   - proximaConsulta vencida OU NULL (primeira execução)
   *
   * Retorna controles ordenados por `proximaConsulta ASC NULLS FIRST` —
   * primeiro as nunca consultadas, depois as mais antigas.
   */
  async listarElegiveisParaConsulta(
    ambiente: 1 | 2,
    opcoes?: { whitelistFiliais?: string[] },
  ): Promise<CteControleNsu[]> {
    const agora = new Date();

    // Resolve whitelist de codigos de filial pra CNPJs (join leve com core.filiais)
    let cnpjsWhitelist: string[] | null = null;
    const wl = opcoes?.whitelistFiliais ?? [];
    if (wl.length > 0) {
      const filiais = await this.prisma.client.filialCore.findMany({
        where: { codigo: { in: wl }, status: 'ATIVO', cnpj: { not: null } },
        select: { cnpj: true },
      });
      cnpjsWhitelist = filiais
        .map((f) => (f.cnpj ?? '').replace(/\D/g, ''))
        .filter((c) => c.length === 14);
      // Whitelist preenchida mas sem matchs reais → resultado vazio (defensivo:
      // evita processar todas as filiais por engano se whitelist tem so codigos
      // invalidos)
      if (cnpjsWhitelist.length === 0) return [];
    }

    return this.prisma.client.cteControleNsu.findMany({
      where: {
        ativo: true,
        ambiente,
        ...(cnpjsWhitelist ? { cnpj: { in: cnpjsWhitelist } } : {}),
        OR: [{ bloqueadoAte: null }, { bloqueadoAte: { lt: agora } }],
        AND: [
          {
            OR: [{ proximaConsulta: null }, { proximaConsulta: { lte: agora } }],
          },
        ],
      },
      orderBy: [{ proximaConsulta: { sort: 'asc', nulls: 'first' } }],
    });
  }

  /**
   * Marca o controle como bloqueado por 1h após cStat=656 (consumo indevido)
   * ou similar. Mecanismo de defesa: orquestrador deve rejeitar consultas
   * quando `bloqueadoAte > now()`.
   */
  async bloquearPor1Hora(params: {
    cnpj: string;
    ambiente: 1 | 2;
    motivo: string;
  }): Promise<CteControleNsu> {
    const cnpjClean = params.cnpj.replace(/\D/g, '');
    const bloqueadoAte = new Date(Date.now() + 60 * 60 * 1000);
    this.logger.warn(
      `Bloqueando consultas CT-e para cnpj=${cnpjClean} ambiente=${params.ambiente} ate=${bloqueadoAte.toISOString()} motivo="${params.motivo}"`,
    );
    return this.prisma.client.cteControleNsu.update({
      where: { cnpj_ambiente: { cnpj: cnpjClean, ambiente: params.ambiente } },
      data: {
        bloqueadoAte,
        motivoBloqueio: params.motivo,
      },
    });
  }

  /**
   * Verifica se está atualmente bloqueado. Retorna milissegundos restantes
   * (positivo) se bloqueado, ou `null` se livre.
   */
  bloqueioAtivo(controle: CteControleNsu): number | null {
    if (!controle.bloqueadoAte) return null;
    const restante = controle.bloqueadoAte.getTime() - Date.now();
    return restante > 0 ? restante : null;
  }

  /**
   * Limpa flag de bloqueio (após operador resolver causa do 656). Não é
   * chamado automaticamente — só via endpoint admin futuro ou expiração
   * natural do `bloqueadoAte`.
   */
  async limparBloqueio(cnpj: string, ambiente: 1 | 2): Promise<CteControleNsu> {
    const cnpjClean = cnpj.replace(/\D/g, '');
    return this.prisma.client.cteControleNsu.update({
      where: { cnpj_ambiente: { cnpj: cnpjClean, ambiente } },
      data: { bloqueadoAte: null, motivoBloqueio: null },
    });
  }
}
