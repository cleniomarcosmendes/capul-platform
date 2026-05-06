import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Servico de presenca: mantem em Redis o conjunto de usuarios "online agora"
 * e o aviso atual da plataforma (banner para parada/manutencao).
 *
 * Modelo:
 *   active:user:<id>     1, TTL 120s     — atualizado pelo heartbeat
 *   aviso:plataforma     JSON, TTL var    — set pelo ADMIN_TI
 *
 * "Online" = chave `active:user:<id>` ainda nao expirou (heartbeat nos
 * ultimos 120s = aba aberta + visivel no momento). Quem fechou a aba some
 * em ~2min sem precisar de logout explicito.
 */
@Injectable()
export class PresencaService {
  private readonly logger = new Logger(PresencaService.name);
  private readonly TTL_HEARTBEAT_SEGUNDOS = 120;
  private readonly KEY_AVISO = 'aviso:plataforma';
  private readonly PREFIXO_ATIVO = 'active:user:';

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Marca usuario como ativo. Chamado pelo frontend a cada 60s enquanto a
   * aba esta visivel. TTL 120s da margem caso o frontend atrase um ciclo.
   *
   * Retorna o aviso atual (se houver) pra o frontend exibir banner.
   */
  async heartbeat(usuarioId: string): Promise<{
    aviso: { mensagem: string; criadoEm: string; ate: string } | null;
  }> {
    if (!this.redis) return { aviso: null };
    try {
      await this.redis.set(`${this.PREFIXO_ATIVO}${usuarioId}`, '1', 'EX', this.TTL_HEARTBEAT_SEGUNDOS);
      const avisoRaw = await this.redis.get(this.KEY_AVISO);
      return { aviso: avisoRaw ? JSON.parse(avisoRaw) : null };
    } catch (err) {
      this.logger.warn(`heartbeat falhou: ${(err as Error).message}`);
      return { aviso: null };
    }
  }

  /**
   * Lista usuarios online — combina chaves Redis com dados de core.usuarios.
   * Cada item retorna `ttlRestante` (segundos) — aproximadamente quanto tempo
   * desde o ultimo heartbeat (TTL inicial 120s — TTL atual = idade).
   */
  async listarOnline(): Promise<Array<{
    id: string;
    username: string;
    nome: string;
    email: string | null;
    departamentoNome: string | null;
    filialPrincipalCodigo: string | null;
    filialPrincipalNome: string | null;
    ultimoLogin: Date | null;
    ttlRestante: number;
  }>> {
    if (!this.redis) return [];

    let keys: string[];
    try {
      keys = await this.redis.keys(`${this.PREFIXO_ATIVO}*`);
    } catch (err) {
      this.logger.warn(`listarOnline keys falhou: ${(err as Error).message}`);
      return [];
    }
    if (keys.length === 0) return [];

    const ids = keys.map((k) => k.replace(this.PREFIXO_ATIVO, ''));

    // Pega TTL de cada chave (multi pra reduzir round-trips)
    const ttls = await Promise.all(keys.map((k) => this.redis!.ttl(k)));
    const ttlPorId = new Map<string, number>();
    ids.forEach((id, i) => ttlPorId.set(id, ttls[i] ?? 0));

    const usuarios = await this.prisma.usuario.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        username: true,
        nome: true,
        email: true,
        ultimoLogin: true,
        departamento: { select: { nome: true } },
        filialPrincipal: { select: { codigo: true, nomeFantasia: true } },
      },
    });

    // Mantem ordem por TTL desc (mais ativo primeiro)
    return usuarios
      .map((u) => ({
        id: u.id,
        username: u.username,
        nome: u.nome,
        email: u.email,
        departamentoNome: u.departamento?.nome ?? null,
        filialPrincipalCodigo: u.filialPrincipal?.codigo ?? null,
        filialPrincipalNome: u.filialPrincipal?.nomeFantasia ?? null,
        ultimoLogin: u.ultimoLogin,
        ttlRestante: ttlPorId.get(u.id) ?? 0,
      }))
      .sort((a, b) => b.ttlRestante - a.ttlRestante);
  }

  /**
   * Cria/atualiza o aviso da plataforma. Visivel a todos os usuarios online
   * (entregue no proximo heartbeat). TTL configuravel (default 30min).
   */
  async definirAviso(mensagem: string, ttlSegundos = 1800): Promise<{
    mensagem: string;
    criadoEm: string;
    ate: string;
    ttlSegundos: number;
  }> {
    if (!this.redis) {
      throw new Error('Redis indisponivel — aviso nao pode ser persistido.');
    }
    const agora = new Date();
    const payload = {
      mensagem,
      criadoEm: agora.toISOString(),
      ate: new Date(agora.getTime() + ttlSegundos * 1000).toISOString(),
    };
    await this.redis.set(this.KEY_AVISO, JSON.stringify(payload), 'EX', ttlSegundos);
    return { ...payload, ttlSegundos };
  }

  async lerAviso(): Promise<{ mensagem: string; criadoEm: string; ate: string } | null> {
    if (!this.redis) return null;
    const raw = await this.redis.get(this.KEY_AVISO);
    return raw ? JSON.parse(raw) : null;
  }

  async limparAviso(): Promise<void> {
    if (!this.redis) return;
    await this.redis.del(this.KEY_AVISO);
  }
}
