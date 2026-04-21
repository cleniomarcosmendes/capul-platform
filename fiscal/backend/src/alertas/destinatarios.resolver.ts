import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { MODULO_FISCAL } from '../common/constants/modulo.constant.js';

interface Destinatario {
  email: string;
  nome: string;
}

interface ResolveResult {
  destinatarios: Destinatario[];
  fallback: boolean;
}

/**
 * Resolve os destinatários dos alertas consolidados DINAMICAMENTE a cada
 * envio, consultando quem possui uma das roles de gestão fiscal
 * (GESTOR_FISCAL ou ADMIN_TI) no momento.
 *
 * Fonte de verdade: `core.usuarios_modulos` join com `core.usuarios` —
 * o schema core é READ-ONLY para o Módulo Fiscal, mas read é liberado.
 *
 * Cache em memória de 5 minutos (item 8 do addendum v1.5) — consistente
 * com o padrão de lookup do gestao-ti.
 *
 * Fallback: se nenhum gestor estiver ativo e com e-mail valido no momento
 * do envio, usa `FISCAL_FALLBACK_EMAIL` (configurado obrigatoriamente no
 * `.env`) e loga WARNING com detalhes — nunca enviar para vazio e nunca
 * silenciosamente descartar alertas.
 *
 * Diretriz (21/04/2026): `FISCAL_FALLBACK_EMAIL` deve ser um e-mail REAL
 * de alguém que possa agir em caso de alerta crítico sem destinatários.
 * Não usar mais e-mails genéricos como `ti@capul.com.br` se não existem.
 */
@Injectable()
export class DestinatariosResolver {
  private readonly logger = new Logger(DestinatariosResolver.name);
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;
  private cache: { resolvedAt: number; value: ResolveResult } | null = null;
  private readonly fallbackEmail: string | null;

  // Roles consideradas como "gestão fiscal" para efeito de alertas consolidados.
  // GESTOR_FISCAL é a role dedicada; ADMIN_TI também é incluída porque na
  // prática administra o módulo e normalmente é quem opera em caso de
  // incidente (circuit breaker, limite SEFAZ, rotina agendada atrasada).
  private readonly ROLES_GESTAO_FISCAL_DEFAULT = ['GESTOR_FISCAL', 'ADMIN_TI'];

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    const raw = config.get<string>('FISCAL_FALLBACK_EMAIL') ?? '';
    this.fallbackEmail = raw.trim() !== '' ? raw.trim() : null;
    if (!this.fallbackEmail) {
      this.logger.warn(
        'FISCAL_FALLBACK_EMAIL não configurado — alertas sem destinatários válidos serão descartados com warning em vez de enviados a endereço genérico.',
      );
    }
  }

  async resolve(): Promise<ResolveResult> {
    if (this.cache && this.cache.resolvedAt + this.CACHE_TTL_MS > Date.now()) {
      return this.cache.value;
    }
    const result = await this.resolveByRoles(this.ROLES_GESTAO_FISCAL_DEFAULT);
    this.cache = { resolvedAt: Date.now(), value: result };
    return result;
  }

  /**
   * Resolve destinatários por um conjunto arbitrário de roles fiscais.
   * Útil para alertas críticos que exigem role extra (ex: limite diário 90%
   * inclui ADMIN_TI além de GESTOR_FISCAL). Sem cache — chamado menos
   * frequentemente que o digest.
   */
  async resolveByRoles(roles: string[]): Promise<ResolveResult> {
    const rows = await this.prisma.client.permissaoModuloCore.findMany({
      where: {
        status: 'ATIVO',
        modulo: { codigo: MODULO_FISCAL },
        role: { codigo: { in: roles } },
      },
      include: { usuario: true },
    });

    // Dedup por email (um usuário pode ter múltiplas permissões)
    // email é nullable em core.usuarios — pular registros sem e-mail cadastrado
    const seen = new Set<string>();
    const destinatarios: Destinatario[] = [];
    let totalComPermissao = 0;
    let semEmail = 0;
    for (const r of rows) {
      totalComPermissao++;
      const email = r.usuario.email;
      if (!email || email.trim() === '') {
        semEmail++;
        continue;
      }
      if (seen.has(email)) continue;
      seen.add(email);
      destinatarios.push({ email, nome: r.usuario.nome });
    }

    if (destinatarios.length === 0) {
      this.logger.warn(
        `Nenhum destinatário válido para alertas fiscais — roles pesquisadas: [${roles.join(', ')}], ` +
          `${totalComPermissao} usuário(s) com permissão mas ${semEmail} sem e-mail cadastrado. ` +
          (this.fallbackEmail
            ? `Usando fallback FISCAL_FALLBACK_EMAIL=${this.fallbackEmail}.`
            : 'FISCAL_FALLBACK_EMAIL não configurado — alerta será descartado.'),
      );
      if (this.fallbackEmail) {
        return {
          destinatarios: [{ email: this.fallbackEmail, nome: 'Fallback (sem destinatários)' }],
          fallback: true,
        };
      }
      return { destinatarios: [], fallback: true };
    }
    return { destinatarios, fallback: false };
  }

  /**
   * Invalida o cache — chamar via endpoint `POST /alertas/refresh-destinatarios`
   * quando o Configurador atribuir/remover a role GESTOR_FISCAL.
   */
  invalidate(): void {
    this.cache = null;
  }
}
