import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailTransportService } from './mail-transport.service.js';
import { DestinatariosResolver } from './destinatarios.resolver.js';
import { DigestTemplate, type DigestInput } from './templates/digest.template.js';
import type { SituacaoCadastral, TipoSincronizacao } from '@prisma/client';

/**
 * Serviço de alertas consolidados.
 *
 * Chamado ao final de cada execução do motor de cruzamento:
 *   ExecucaoService → CruzamentoWorker → AlertasService.enviarDigest(execucaoId)
 *
 * Fluxo:
 *   1. Busca fiscal.cadastro_sincronizacao e as mudanças do período
 *   2. Resolve destinatários via DestinatariosResolver (role GESTOR_FISCAL)
 *   3. Renderiza HTML + TXT via DigestTemplate
 *   4. Envia via MailTransportService
 *   5. Persiste em fiscal.alerta_enviado (com fallback flag, destinatários
 *      efetivos, smtpResponse, erro se houver)
 */
@Injectable()
export class AlertasService {
  private readonly logger = new Logger(AlertasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailTransportService,
    private readonly destinatariosResolver: DestinatariosResolver,
    private readonly template: DigestTemplate,
  ) {}

  /**
   * Envia o digest consolidado para uma execução terminada.
   * Idempotente no sentido prático: cria sempre uma nova linha em
   * fiscal.alerta_enviado; chamar múltiplas vezes gera múltiplos envios.
   */
  async enviarDigest(sincronizacaoId: string): Promise<void> {
    const execucao = await this.prisma.cadastroSincronizacao.findUnique({
      where: { id: sincronizacaoId },
    });
    if (!execucao) {
      this.logger.warn(`enviarDigest: sincronização ${sincronizacaoId} não encontrada.`);
      return;
    }
    if (!execucao.finalizadoEm) {
      this.logger.warn(`enviarDigest: sincronização ${sincronizacaoId} ainda não finalizada.`);
      return;
    }

    // Busca mudanças de situação detectadas durante esta execução
    const mudancas = await this.prisma.cadastroHistorico.findMany({
      where: { sincronizacaoId },
      include: { contribuinte: true },
      orderBy: { detectadoEm: 'asc' },
    });

    // Resumo por situação: agrega fiscal.cadastro_contribuinte
    const resumo = await this.prisma.cadastroContribuinte.groupBy({
      by: ['situacao'],
      _count: { _all: true },
    });
    const resumoStatus: Record<SituacaoCadastral, number> = {
      HABILITADO: 0,
      NAO_HABILITADO: 0,
      SUSPENSO: 0,
      INAPTO: 0,
      BAIXADO: 0,
      DESCONHECIDO: 0,
    };
    for (const r of resumo) {
      resumoStatus[r.situacao] = r._count._all;
    }

    // Resolve destinatários
    const { destinatarios, fallback } = await this.destinatariosResolver.resolve();

    if (destinatarios.length === 0) {
      this.logger.warn(
        `Digest de ${sincronizacaoId.slice(0, 8)} nao enviado — sem destinatarios validos e sem FISCAL_FALLBACK_EMAIL configurado. ` +
          'Configure FISCAL_FALLBACK_EMAIL no .env ou atribua role GESTOR_FISCAL/ADMIN_TI a algum usuario com e-mail cadastrado.',
      );
      return;
    }

    const ambienteCfg = await this.prisma.ambienteConfig.findUnique({ where: { id: 1 } });

    const digestInput: DigestInput = {
      execucao: {
        id: execucao.id,
        tipo: execucao.tipo,
        iniciadoEm: execucao.iniciadoEm,
        finalizadoEm: execucao.finalizadoEm,
        totalContribuintes: execucao.totalContribuintes ?? 0,
        sucessos: execucao.sucessos,
        erros: execucao.erros,
        errosPorUf: (execucao.errosPorUf as Record<string, number>) ?? {},
        ambiente: ambienteCfg?.ambienteAtivo ?? 'HOMOLOGACAO',
      },
      mudancasSituacao: mudancas.map((m) => {
        const vinculos = (m.contribuinte.vinculosProtheus as Array<{ origem?: string; codigo?: string; loja?: string }>) ?? [];
        const primeiro = vinculos[0];
        return {
          cnpj: m.contribuinte.cnpj,
          razaoSocial: m.contribuinte.razaoSocial,
          uf: m.contribuinte.uf,
          situacaoAnterior: m.situacaoAnterior,
          situacaoNova: m.situacaoNova,
          origemProtheus: primeiro?.origem ?? null,
          codigoProtheus: primeiro?.codigo ?? null,
          lojaProtheus: primeiro?.loja ?? null,
        };
      }),
      resumoStatus,
      fallback,
    };

    const html = this.template.renderHtml(digestInput);
    const text = this.template.renderText(digestInput);
    const subject = this.buildSubject(execucao.tipo, mudancas.length, fallback);

    const result = await this.mail.send({
      to: destinatarios.map((d) => d.email),
      subject,
      html,
      text,
    });

    await this.prisma.alertaEnviado.create({
      data: {
        sincronizacaoId,
        destinatarios: destinatarios.map((d) => ({ email: d.email, nome: d.nome })),
        totalDestinatarios: destinatarios.length,
        totalMudancas: mudancas.length,
        fallback,
        assunto: subject,
        smtpResponse: result.response ?? null,
        erro: result.error ?? null,
      },
    });

    if (result.sent) {
      this.logger.log(
        `Digest enviado: execucao=${sincronizacaoId.slice(0, 8)} destinatarios=${destinatarios.length} mudancas=${mudancas.length} fallback=${fallback}`,
      );
    } else {
      this.logger.error(
        `Falha no envio do digest ${sincronizacaoId.slice(0, 8)}: ${result.error}`,
      );
    }
  }

  /**
   * Endpoint público: dispara envio manual do último digest (útil para reenvio).
   */
  async reenviarDigest(sincronizacaoId: string): Promise<void> {
    await this.enviarDigest(sincronizacaoId);
  }

  private buildSubject(tipo: TipoSincronizacao, mudancas: number, fallback: boolean): string {
    const prefix = fallback ? '[FALLBACK — sem GESTOR_FISCAL configurado] ' : '';
    const tipoLabel: Record<TipoSincronizacao, string> = {
      MOVIMENTO_MEIO_DIA: 'movimento meio-dia',
      MOVIMENTO_MANHA_SEGUINTE: 'movimento manhã seguinte',
      MANUAL: 'manual',
      PONTUAL: 'pontual',
    };
    const base = `[FISCAL] Cruzamento ${tipoLabel[tipo]} — ${mudancas} mudança(s)`;
    return prefix + base;
  }
}
