import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { Agent as HttpsAgent } from 'node:https';
import { CertificadoReaderService } from '../certificado/certificado-reader.service.js';
import { SefazCaService } from './sefaz-ca.service.js';

/**
 * Constrói e cacheia o `https.Agent` com mTLS usando o certificado A1 ativo +
 * a cadeia TLS ICP-Brasil carregada pelo `SefazCaService`.
 *
 * ## Validação TLS da cadeia ICP-Brasil
 *
 * Os servidores da SEFAZ são assinados pela cadeia **ICP-Brasil**. O
 * `SefazCaService` é responsável por carregar, atualizar e parsear essa cadeia.
 * Este agent apenas consome o bundle pronto.
 *
 * - **Cadeia presente** → TLS totalmente validado (`rejectUnauthorized: true`)
 * - **Cadeia ausente** + `FISCAL_SEFAZ_TLS_STRICT=true` → bootstrap aborta
 * - **Cadeia ausente** sem strict → modo inseguro com WARNING visível
 *
 * ## Auto-refresh no boot
 *
 * Se `FISCAL_SEFAZ_CA_AUTO_REFRESH=true`, no `onModuleInit` o agent solicita
 * ao `SefazCaService` para atualizar a cadeia quando a idade estiver > 30 dias.
 *
 * ## Cache
 *
 * Cache local de 10min do `https.Agent`, invalidado quando o certificado A1
 * for trocado (via `SefazAgentService.invalidate`) ou quando a cadeia TLS
 * for atualizada (via `SefazCaController.refresh`).
 */
@Injectable()
export class SefazAgentService implements OnModuleInit {
  private readonly logger = new Logger(SefazAgentService.name);
  private cached: { certId: string; agent: HttpsAgent; expiraEm: number } | null = null;
  private readonly CACHE_TTL_MS = 10 * 60 * 1000;
  private readonly tlsStrict: boolean;

  constructor(
    private readonly certReader: CertificadoReaderService,
    private readonly ca: SefazCaService,
  ) {
    this.tlsStrict = process.env.FISCAL_SEFAZ_TLS_STRICT === 'true';
  }

  async onModuleInit(): Promise<void> {
    // 1. Auto-refresh da cadeia TLS se habilitado
    try {
      await this.ca.verificarAutoRefreshBoot();
    } catch (err) {
      this.logger.error(`Auto-refresh falhou: ${(err as Error).message}`);
    }

    // 2. Validação estrita: aborta bootstrap se FISCAL_SEFAZ_TLS_STRICT=true
    // e a cadeia não estiver carregada após o auto-refresh.
    const bundle = this.ca.loadBundle();
    if (!bundle || bundle.length === 0) {
      if (this.tlsStrict) {
        this.logger.error(
          'FISCAL_SEFAZ_TLS_STRICT=true mas cadeia ICP-Brasil ausente. ' +
            'Configure os certificados ou desative a flag. Abortando.',
        );
        throw new Error('Cadeia ICP-Brasil ausente em modo estrito');
      }
      this.logger.warn(
        `⚠️  [INSEGURO] Cadeia ICP-Brasil não carregada. ` +
          `Conexões SEFAZ vão usar 'rejectUnauthorized: false' (vulnerável a MITM). ` +
          `Para operar em modo seguro: (1) popular o diretório da cadeia ` +
          `(auto-refresh via FISCAL_SEFAZ_CA_AUTO_REFRESH=true ou POST /sefaz/ca/refresh); ` +
          `(2) definir FISCAL_SEFAZ_TLS_STRICT=true em produção.`,
      );
    } else {
      this.logger.log(`✓ Cadeia ICP-Brasil carregada (${bundle.length} certificados)`);
    }
  }

  async getAgent(): Promise<HttpsAgent> {
    if (this.cached && this.cached.expiraEm > Date.now()) {
      return this.cached.agent;
    }

    const cert = await this.certReader.loadActive();
    if (!cert.buffer || cert.buffer.length === 0) {
      throw new ServiceUnavailableException('Certificado ativo sem binário disponível.');
    }

    const caBundle = this.ca.loadBundle();
    const usaValidacaoTls = caBundle !== null && caBundle.length > 0;

    const agent = new HttpsAgent({
      pfx: cert.buffer,
      passphrase: cert.senha,
      // Quando temos a cadeia ICP-Brasil carregada, validamos TLS integralmente.
      // Sem ela, desabilitamos a verificação (INSEGURO — apenas dev local).
      ca: usaValidacaoTls ? caBundle : undefined,
      rejectUnauthorized: usaValidacaoTls,
      keepAlive: true,
      keepAliveMsecs: 30_000,
      // SEFAZ ainda aceita TLS 1.2 — alguns endpoints antigos não fecham handshake em TLS 1.3
      minVersion: 'TLSv1.2',
      maxVersion: 'TLSv1.3',
    });

    this.cached = { certId: cert.id, agent, expiraEm: Date.now() + this.CACHE_TTL_MS };
    this.logger.log(
      `SEFAZ mTLS agent construído a partir do certificado ${cert.id} ` +
        `(validação TLS ICP-Brasil: ${usaValidacaoTls ? 'ATIVA' : 'DESATIVADA — modo inseguro'})`,
    );
    return agent;
  }

  /**
   * Força rebuild do agent — chamar após troca de certificado ou refresh da cadeia TLS.
   */
  invalidate(): void {
    this.cached?.agent.destroy();
    this.cached = null;
    this.certReader.invalidateCache();
  }
}
