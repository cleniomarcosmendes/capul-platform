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
   */
  async atualizarCursor(params: {
    cnpj: string;
    ambiente: 1 | 2;
    ultNSU: string;
    maxNSU: string;
  }): Promise<CteControleNsu> {
    const cnpjClean = params.cnpj.replace(/\D/g, '');
    return this.prisma.client.cteControleNsu.update({
      where: { cnpj_ambiente: { cnpj: cnpjClean, ambiente: params.ambiente } },
      data: {
        ultimoNsuProcessado: params.ultNSU,
        maxNsuConhecido: params.maxNSU,
        ultimaConsulta: new Date(),
      },
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
