import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
  unlinkSync,
} from 'node:fs';
import { join } from 'node:path';
import * as tls from 'node:tls';
import { X509Certificate } from 'node:crypto';
import { MailTransportService } from '../alertas/mail-transport.service.js';
import { DestinatariosResolver } from '../alertas/destinatarios.resolver.js';
import { CertificadoReaderService } from '../certificado/certificado-reader.service.js';

export type SefazCaModo =
  /** Cadeia carregada e TLS validado corretamente */
  | 'VALIDACAO_ATIVA'
  /** Modo inseguro: rejectUnauthorized=false porque a pasta está vazia */
  | 'INSEGURO_SEM_CADEIA'
  /** FISCAL_SEFAZ_TLS_STRICT=true + cadeia ausente → bootstrap aborta antes de chegar aqui */
  | 'BLOQUEADO';

export type SefazCaSeveridade = 'OK' | 'ATENCAO' | 'CRITICO';

export interface SefazCertificadoInfo {
  arquivo: string;
  commonName: string | null;
  issuer: string | null;
  validoDe: string;
  validoAte: string;
  diasParaVencer: number;
  serial: string;
}

export interface SefazCaStatus {
  modo: SefazCaModo;
  severidade: SefazCaSeveridade;
  mensagem: string;
  totalCertificados: number;
  idadeDias: number | null;
  ultimoRefresh: string | null;
  proximaVerificacaoAutomatica: string | null;
  autoRefreshAtivo: boolean;
  tlsStrict: boolean;
  caPath: string;
  certificados: SefazCertificadoInfo[];
  ultimasAtualizacoes: SefazRefreshLog[];
}

export interface SefazRefreshLog {
  timestamp: string;
  origem: 'BOOT' | 'CRON' | 'MANUAL';
  usuarioEmail: string | null;
  endpointsProcessados: number;
  certificadosExtraidos: number;
  sucesso: boolean;
  mensagem: string;
}

export interface SefazRefreshResult {
  sucesso: boolean;
  certificadosExtraidos: number;
  arquivosSalvos: string[];
  mensagem: string;
  logs: string[];
}

/**
 * Endpoints representativos usados para extrair a cadeia TLS ICP-Brasil.
 * Escolhidos para cobrir os 3 padrões de infra da SEFAZ: autorizador próprio
 * (MG), nacional (AN) e virtual (SVRS).
 */
const ENDPOINTS_PARA_EXTRACAO: ReadonlyArray<{ host: string; label: string }> = [
  { host: 'nfe.fazenda.mg.gov.br', label: 'MG — autorizador próprio' },
  { host: 'www1.nfe.fazenda.gov.br', label: 'AN — nacional (NFeDistribuicaoDFe)' },
  { host: 'nfe.svrs.rs.gov.br', label: 'SVRS — virtual (fallback)' },
];

const IDADE_ATENCAO_DIAS = 60;
const IDADE_CRITICO_DIAS = 90;
const IDADE_ALERTA_EMAIL_DIAS = 75;
const MAX_LOGS_GUARDADOS = 20;

/**
 * Serviço de gestão da cadeia TLS ICP-Brasil da SEFAZ.
 *
 * Responsabilidades:
 *  1. Carregar os certificados `.pem`/`.crt`/`.cer` do diretório configurado
 *  2. Parsear cada certificado (CN, issuer, validade) via `X509Certificate`
 *  3. Extrair/atualizar a cadeia diretamente dos endpoints SEFAZ via TLS
 *  4. Expor status agregado para health check, UI e alertas
 *  5. Manter histórico das últimas N atualizações (em memória)
 *
 * O `SefazAgentService` consome este service para construir o `https.Agent`
 * com a cadeia correta — antes ele fazia o load inline.
 */
@Injectable()
export class SefazCaService {
  private readonly logger = new Logger(SefazCaService.name);
  private readonly caPath: string;
  private readonly autoRefresh: boolean;
  private readonly tlsStrict: boolean;
  private readonly historicoLogs: SefazRefreshLog[] = [];
  /** Dedup: guarda último envio de alerta email para não spam diário */
  private ultimoAlertaEnviado: Date | null = null;

  constructor(
    private readonly mail: MailTransportService,
    private readonly destinatarios: DestinatariosResolver,
    private readonly certReader: CertificadoReaderService,
  ) {
    this.caPath = process.env.FISCAL_SEFAZ_CA_PATH ?? '/app/certs/icp-brasil';
    this.autoRefresh = process.env.FISCAL_SEFAZ_CA_AUTO_REFRESH === 'true';
    this.tlsStrict = process.env.FISCAL_SEFAZ_TLS_STRICT === 'true';

    // Garante que a pasta existe (não vai criar .pem, só o container)
    if (!existsSync(this.caPath)) {
      try {
        mkdirSync(this.caPath, { recursive: true });
      } catch {
        // Ignorado — o erro vai ser reportado no status()
      }
    }
  }

  /**
   * Carrega os buffers brutos de todos os certificados `.pem`/`.crt`/`.cer`
   * da pasta + o trust store público do Node (Mozilla) como fallback.
   *
   * A combinação é intencional:
   * - **Arquivos locais**: cadeia ICP-Brasil extraída dos endpoints SEFAZ
   *   (ACs estaduais, raízes ICP-Brasil, SERPRO, etc).
   * - **Mozilla trust store** (via `tls.rootCertificates`): cobre endpoints que
   *   usam certificados comerciais (ex: `www1.nfe.fazenda.gov.br` é assinado
   *   pela cadeia Sectigo/USERTrust/AAA, que NÃO é ICP-Brasil).
   *
   * Sem os roots Mozilla, a validação TLS falha para endpoints nacionais.
   * Com eles, qualquer CA publicamente confiável funciona.
   *
   * Retorna `null` se nem o trust store nativo do Node estiver disponível
   * (caso improvável em Node 18+).
   */
  loadBundle(): Buffer[] | null {
    const bundle: Buffer[] = [];

    // 1. Certificados locais (cadeia ICP-Brasil extraída dos endpoints SEFAZ)
    if (existsSync(this.caPath)) {
      try {
        const files = this.listarArquivosCert();
        for (const f of files) {
          bundle.push(readFileSync(join(this.caPath, f)));
        }
      } catch (err) {
        this.logger.error(`Falha ao carregar arquivos locais: ${(err as Error).message}`);
      }
    }

    // 2. Trust store público do Node (Mozilla) — fallback universal
    try {
      const rootCerts = tls.rootCertificates;
      for (const pem of rootCerts) {
        bundle.push(Buffer.from(pem, 'utf8'));
      }
    } catch (err) {
      this.logger.warn(`tls.rootCertificates indisponível: ${(err as Error).message}`);
    }

    if (bundle.length === 0) return null;
    return bundle;
  }

  /**
   * Conta apenas os certificados ICP-Brasil locais (sem os roots Mozilla).
   * Usado pelo status/UI — o número de "ACs carregadas da SEFAZ".
   */
  private contarCertsLocais(): number {
    if (!existsSync(this.caPath)) return 0;
    try {
      const files = this.listarArquivosCert();
      let total = 0;
      for (const f of files) {
        const pem = readFileSync(join(this.caPath, f), 'utf8');
        total += (pem.match(/BEGIN CERTIFICATE/g) ?? []).length;
      }
      return total;
    } catch {
      return 0;
    }
  }

  /**
   * Status completo da cadeia TLS. Consumido pelo controller, health check,
   * dashboard e AdminPage.
   */
  getStatus(): SefazCaStatus {
    // O status considera SÓ os certs locais (cadeia ICP-Brasil extraída).
    // Os roots Mozilla são um fallback técnico silencioso no loadBundle.
    const totalLocais = this.contarCertsLocais();
    const temCadeia = totalLocais > 0;

    const certificados = temCadeia ? this.parsearCertificados() : [];
    const idadeDias = temCadeia ? this.calcularIdadeDias() : null;

    let modo: SefazCaModo;
    let severidade: SefazCaSeveridade;
    let mensagem: string;

    if (!temCadeia) {
      modo = this.tlsStrict ? 'BLOQUEADO' : 'INSEGURO_SEM_CADEIA';
      severidade = 'CRITICO';
      mensagem = this.tlsStrict
        ? 'FISCAL_SEFAZ_TLS_STRICT=true mas cadeia ausente — bootstrap deveria ter abortado.'
        : 'Cadeia ICP-Brasil não carregada. Conexões SEFAZ em modo inseguro (rejectUnauthorized: false). Atualizar antes de ir para produção.';
    } else if (idadeDias !== null && idadeDias > IDADE_CRITICO_DIAS) {
      modo = 'VALIDACAO_ATIVA';
      severidade = 'CRITICO';
      mensagem = `Cadeia TLS há ${idadeDias} dias sem atualização (> ${IDADE_CRITICO_DIAS}d). Atualizar imediatamente.`;
    } else if (idadeDias !== null && idadeDias > IDADE_ATENCAO_DIAS) {
      modo = 'VALIDACAO_ATIVA';
      severidade = 'ATENCAO';
      mensagem = `Cadeia TLS há ${idadeDias} dias sem atualização. Considere atualizar.`;
    } else {
      modo = 'VALIDACAO_ATIVA';
      severidade = 'OK';
      mensagem = `Cadeia TLS validada (${certificados.length} certificados${idadeDias !== null ? `, ${idadeDias} dias desde última atualização` : ''}).`;
    }

    // Detecta certificados individuais perto do vencimento
    const certsPertoVencer = certificados.filter((c) => c.diasParaVencer < 30);
    if (certsPertoVencer.length > 0 && severidade !== 'CRITICO') {
      severidade = 'ATENCAO';
      mensagem += ` ⚠ ${certsPertoVencer.length} certificado(s) vencendo em menos de 30 dias.`;
    }

    return {
      modo,
      severidade,
      mensagem,
      totalCertificados: certificados.length,
      idadeDias,
      ultimoRefresh: idadeDias !== null ? this.formatarUltimoRefresh() : null,
      proximaVerificacaoAutomatica: this.autoRefresh
        ? this.calcularProximaVerificacao()
        : null,
      autoRefreshAtivo: this.autoRefresh,
      tlsStrict: this.tlsStrict,
      caPath: this.caPath,
      certificados,
      ultimasAtualizacoes: [...this.historicoLogs].reverse(),
    };
  }

  /**
   * Extrai a cadeia TLS dos endpoints SEFAZ conhecidos e salva como `.pem`.
   * Sempre preserva os arquivos antigos em caso de falha parcial.
   */
  async refresh(
    origem: SefazRefreshLog['origem'],
    usuarioEmail: string | null = null,
  ): Promise<SefazRefreshResult> {
    this.logger.log(`Iniciando refresh da cadeia TLS (origem=${origem}, usuario=${usuarioEmail ?? 'system'})`);
    const logs: string[] = [];
    const novosCerts: Map<string, Buffer> = new Map();
    let endpointsOk = 0;

    // Carrega o A1 ativo — vários endpoints SEFAZ (MG, SP, BA) exigem TLS mútuo
    // e recusam handshake sem cert cliente. Outros (AN, SVRS) aceitam conexão
    // anônima. Tentamos sempre com o A1; se não houver, seguimos sem.
    let clientPfx: { buffer: Buffer; senha: string } | null = null;
    try {
      const cert = await this.certReader.loadActive();
      if (cert.buffer && cert.buffer.length > 0) {
        clientPfx = { buffer: cert.buffer, senha: cert.senha };
      }
    } catch (err) {
      this.logger.warn(
        `Refresh sem cert cliente A1 (${(err as Error).message}) — endpoints com TLS mútuo podem falhar`,
      );
    }

    for (const ep of ENDPOINTS_PARA_EXTRACAO) {
      try {
        const chain = await this.fetchChainViaTls(ep.host, 443, clientPfx);
        if (chain.length === 0) {
          logs.push(`⚠ ${ep.label}: resposta TLS sem certificados`);
          continue;
        }
        // Salva todos exceto o leaf (certificado do servidor em si) —
        // guardamos só ACs raiz/intermediárias. Leaf rotaciona muito.
        const intermediariosERaiz = chain.slice(1);
        for (let i = 0; i < intermediariosERaiz.length; i++) {
          const der = intermediariosERaiz[i];
          if (!der) continue;
          const pem = this.derToPem(der);
          // Nome do arquivo baseado no fingerprint curto para evitar duplicatas
          const nome = this.gerarNomeArquivo(pem, ep.host, i);
          if (nome) novosCerts.set(nome, Buffer.from(pem, 'utf8'));
        }
        endpointsOk++;
        logs.push(`✓ ${ep.label}: ${intermediariosERaiz.length} AC(s) extraída(s)`);
      } catch (err) {
        logs.push(`✗ ${ep.label}: ${(err as Error).message}`);
        this.logger.warn(`Refresh falhou para ${ep.host}: ${(err as Error).message}`);
      }
    }

    if (novosCerts.size === 0) {
      const msg = 'Nenhum certificado extraído dos endpoints SEFAZ. Cadeia antiga preservada.';
      this.logger.error(msg);
      this.registrarLog({
        origem,
        usuarioEmail,
        endpointsProcessados: ENDPOINTS_PARA_EXTRACAO.length,
        certificadosExtraidos: 0,
        sucesso: false,
        mensagem: msg,
      });
      return {
        sucesso: false,
        certificadosExtraidos: 0,
        arquivosSalvos: [],
        mensagem: msg,
        logs,
      };
    }

    // Sucesso parcial ou total: remove os antigos .pem e salva os novos
    // Os arquivos antigos só são removidos AGORA (depois da extração bem-sucedida),
    // garantindo que nunca ficamos sem cadeia se o refresh falhar no meio.
    try {
      for (const arquivo of this.listarArquivosCert()) {
        try {
          unlinkSync(join(this.caPath, arquivo));
        } catch {
          /* ignore — arquivo pode ter sumido */
        }
      }
      for (const [nome, buffer] of novosCerts.entries()) {
        writeFileSync(join(this.caPath, nome), buffer, { mode: 0o644 });
      }
    } catch (err) {
      const msg = `Falha ao escrever arquivos atualizados: ${(err as Error).message}`;
      this.logger.error(msg);
      this.registrarLog({
        origem,
        usuarioEmail,
        endpointsProcessados: ENDPOINTS_PARA_EXTRACAO.length,
        certificadosExtraidos: 0,
        sucesso: false,
        mensagem: msg,
      });
      return { sucesso: false, certificadosExtraidos: 0, arquivosSalvos: [], mensagem: msg, logs };
    }

    const mensagem = `Cadeia TLS atualizada: ${novosCerts.size} certificado(s) de ${endpointsOk}/${ENDPOINTS_PARA_EXTRACAO.length} endpoints.`;
    this.logger.log(mensagem);
    this.registrarLog({
      origem,
      usuarioEmail,
      endpointsProcessados: ENDPOINTS_PARA_EXTRACAO.length,
      certificadosExtraidos: novosCerts.size,
      sucesso: true,
      mensagem,
    });

    return {
      sucesso: true,
      certificadosExtraidos: novosCerts.size,
      arquivosSalvos: Array.from(novosCerts.keys()),
      mensagem,
      logs,
    };
  }

  /**
   * Verifica se um auto-refresh é necessário no boot. Chamado pelo
   * `SefazAgentService` durante a construção.
   */
  async verificarAutoRefreshBoot(): Promise<void> {
    if (!this.autoRefresh) return;

    const idade = this.calcularIdadeDias();
    if (idade === null || idade > 30) {
      this.logger.log(
        `Auto-refresh ativo e cadeia ${idade === null ? 'ausente' : `com ${idade}d`}. Extraindo dos endpoints SEFAZ…`,
      );
      await this.refresh('BOOT');
    } else {
      this.logger.log(`Auto-refresh ativo mas cadeia está em dia (${idade}d). Nenhuma ação necessária.`);
    }
  }

  /**
   * Cron diário (03:00) que checa a idade da cadeia e dispara refresh
   * automaticamente quando passa de 30 dias. Só roda se `FISCAL_SEFAZ_CA_AUTO_REFRESH=true`.
   *
   * Falha silenciosa: se o refresh não funcionar, a cadeia antiga é preservada
   * e o health check vai mostrar warning/crítico conforme a idade avança.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'sefaz-ca-auto-refresh' })
  async cronDiario(): Promise<void> {
    // 1. Tentativa de refresh automático se habilitado e cadeia >30d
    if (this.autoRefresh) {
      const idade = this.calcularIdadeDias();
      if (idade === null) {
        this.logger.warn('[Cron diário] Cadeia ausente — tentando refresh inicial');
      } else if (idade > 30) {
        this.logger.log(`[Cron diário] Cadeia com ${idade}d — disparando refresh automático`);
      }

      if (idade === null || idade > 30) {
        try {
          await this.refresh('CRON');
        } catch (err) {
          this.logger.error(`[Cron diário] Falha no refresh: ${(err as Error).message}`);
        }
      }
    }

    // 2. Alerta por email se a cadeia ainda estiver velha após o refresh
    //    (ou se auto-refresh estiver desligado e a cadeia envelheceu)
    await this.verificarEAlertarSeVelha();
  }

  /**
   * Dispara alerta por e-mail para GESTOR_FISCAL quando a cadeia atinge idade
   * crítica. Dedup: envia no máximo 1 alerta por semana para não virar spam.
   *
   * Usado pelo cron diário. Pode ser chamado manualmente para forçar um teste.
   */
  async verificarEAlertarSeVelha(): Promise<{ enviado: boolean; motivo: string }> {
    const idade = this.calcularIdadeDias();

    if (idade === null || idade < IDADE_ALERTA_EMAIL_DIAS) {
      return { enviado: false, motivo: 'Cadeia em dia, alerta desnecessário' };
    }

    // Dedup: não reenvia se já alertou nos últimos 7 dias
    if (this.ultimoAlertaEnviado) {
      const horasDesdeUltimo =
        (Date.now() - this.ultimoAlertaEnviado.getTime()) / (1000 * 60 * 60);
      if (horasDesdeUltimo < 24 * 7) {
        return {
          enviado: false,
          motivo: `Alerta recente enviado há ${Math.floor(horasDesdeUltimo)}h`,
        };
      }
    }

    if (!this.mail.isEnabled()) {
      this.logger.warn(
        `[Alerta TLS] Cadeia com ${idade}d mas SMTP desabilitado — não envia email.`,
      );
      return { enviado: false, motivo: 'SMTP desabilitado' };
    }

    const resolved = await this.destinatarios.resolve();
    if (resolved.destinatarios.length === 0) {
      return { enviado: false, motivo: 'Nenhum destinatário disponível' };
    }

    const nivel = idade > IDADE_CRITICO_DIAS ? 'CRÍTICO' : 'AVISO';
    const subject = `[Fiscal] ${nivel}: Cadeia TLS SEFAZ com ${idade} dias sem atualização`;
    const html = this.montarTemplateAlertaHtml(idade);
    const text =
      `${subject}\n\n` +
      `A cadeia de certificados TLS ICP-Brasil usada para validar conexões com a SEFAZ ` +
      `está há ${idade} dias sem atualização.\n\n` +
      `Ação recomendada: acessar o Módulo Fiscal → Administração → Cadeia TLS SEFAZ ` +
      `e clicar em "Atualizar cadeia agora". Ou aguardar a próxima execução do ` +
      `refresh automático (cron diário às 03:00).\n\n` +
      `Limites: ${IDADE_ATENCAO_DIAS}d = atenção, ${IDADE_CRITICO_DIAS}d = crítico. ` +
      `Acima disso, as consultas SEFAZ podem falhar se a SEFAZ rotacionar os certificados.`;

    const result = await this.mail.send({
      to: resolved.destinatarios.map((d) => d.email),
      subject,
      html,
      text,
    });

    if (result.sent) {
      this.ultimoAlertaEnviado = new Date();
      this.logger.log(
        `[Alerta TLS] Email enviado para ${resolved.destinatarios.length} destinatário(s) (idade=${idade}d)`,
      );
      return { enviado: true, motivo: `Enviado para ${resolved.destinatarios.length} destinatário(s)` };
    }

    this.logger.error(`[Alerta TLS] Falha no envio: ${result.error}`);
    return { enviado: false, motivo: `Falha no SMTP: ${result.error}` };
  }

  private montarTemplateAlertaHtml(idade: number): string {
    const nivelCor = idade > IDADE_CRITICO_DIAS ? '#dc2626' : '#d97706';
    return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:-apple-system,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#334155">
      <div style="border-left:4px solid ${nivelCor};padding-left:16px;margin-bottom:24px">
        <h2 style="margin:0;color:${nivelCor}">⚠️ Cadeia TLS SEFAZ desatualizada</h2>
        <p style="margin:8px 0 0;color:#64748b;font-size:14px">Módulo Fiscal · Capul Platform</p>
      </div>
      <p>A cadeia de certificados ICP-Brasil usada para validar conexões com a SEFAZ
      está há <strong>${idade} dias</strong> sem atualização.</p>
      <p><strong>Por que isso importa:</strong> se a SEFAZ rotacionar os certificados dos
      servidores (eles fazem isso a cada ~12 meses), nossas consultas podem começar a
      falhar com erro de TLS porque a nova cadeia não estará no nosso trust store.</p>
      <div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:16px 0">
        <p style="margin:0 0 8px"><strong>Ação recomendada:</strong></p>
        <ol style="margin:0;padding-left:20px">
          <li>Acessar <strong>Módulo Fiscal → Administração → Cadeia TLS SEFAZ</strong></li>
          <li>Clicar em <strong>"Atualizar cadeia agora"</strong></li>
          <li>Verificar que a idade zerou</li>
        </ol>
      </div>
      <p style="font-size:12px;color:#94a3b8">Limites: ${IDADE_ATENCAO_DIAS}d = atenção · ${IDADE_CRITICO_DIAS}d = crítico.<br>
      Este é um alerta automático enviado pelo Módulo Fiscal. Você está recebendo porque tem a role GESTOR_FISCAL.</p>
    </body></html>`;
  }

  // ---------------- helpers privados ----------------

  private listarArquivosCert(): string[] {
    return readdirSync(this.caPath).filter(
      (f) => f.endsWith('.pem') || f.endsWith('.crt') || f.endsWith('.cer'),
    );
  }

  private parsearCertificados(): SefazCertificadoInfo[] {
    const arquivos = this.listarArquivosCert();
    const resultado: SefazCertificadoInfo[] = [];
    const agora = Date.now();

    for (const arquivo of arquivos) {
      try {
        const pemCompleto = readFileSync(join(this.caPath, arquivo), 'utf8');
        // Arquivo pode ter múltiplos certificados concatenados
        const blocos = pemCompleto
          .split(/(?=-----BEGIN CERTIFICATE-----)/g)
          .filter((b) => b.includes('BEGIN CERTIFICATE'));

        for (const bloco of blocos) {
          try {
            const cert = new X509Certificate(bloco);
            const validTo = new Date(cert.validTo).getTime();
            const diasParaVencer = Math.floor((validTo - agora) / (1000 * 60 * 60 * 24));
            resultado.push({
              arquivo,
              commonName: this.extrairCn(cert.subject),
              issuer: this.extrairCn(cert.issuer),
              validoDe: new Date(cert.validFrom).toISOString(),
              validoAte: new Date(cert.validTo).toISOString(),
              diasParaVencer,
              serial: cert.serialNumber,
            });
          } catch (err) {
            this.logger.warn(
              `Falha ao parsear certificado em ${arquivo}: ${(err as Error).message}`,
            );
          }
        }
      } catch (err) {
        this.logger.warn(`Falha ao ler ${arquivo}: ${(err as Error).message}`);
      }
    }

    return resultado;
  }

  private extrairCn(dn: string): string | null {
    // dn vem como "CN=AC SERPRO v5\nOU=..." ou "CN=AC SERPRO v5, OU=..."
    const match = dn.match(/CN=([^,\n]+)/);
    return match?.[1]?.trim() ?? null;
  }

  private calcularIdadeDias(): number | null {
    try {
      const arquivos = this.listarArquivosCert();
      if (arquivos.length === 0) return null;
      // Usa o mais recente mtime como "última atualização"
      const mtimes = arquivos.map((f) => statSync(join(this.caPath, f)).mtimeMs);
      const maisRecente = Math.max(...mtimes);
      return Math.floor((Date.now() - maisRecente) / (1000 * 60 * 60 * 24));
    } catch {
      return null;
    }
  }

  private formatarUltimoRefresh(): string | null {
    try {
      const arquivos = this.listarArquivosCert();
      if (arquivos.length === 0) return null;
      const mtimes = arquivos.map((f) => statSync(join(this.caPath, f)).mtimeMs);
      return new Date(Math.max(...mtimes)).toISOString();
    } catch {
      return null;
    }
  }

  private calcularProximaVerificacao(): string {
    // Auto-refresh acontece: (a) no boot se > 30d; (b) cron diário
    // Aproximação: "amanhã 03:00 local" ou quando a idade atingir 30d.
    const proximo = new Date();
    proximo.setDate(proximo.getDate() + 1);
    proximo.setHours(3, 0, 0, 0);
    return proximo.toISOString();
  }

  private fetchChainViaTls(
    host: string,
    port = 443,
    clientPfx: { buffer: Buffer; senha: string } | null = null,
  ): Promise<Buffer[]> {
    return new Promise((resolve, reject) => {
      const socket = tls.connect(
        {
          host,
          port,
          servername: host,
          rejectUnauthorized: false,
          // TLS mútuo quando necessário (MG, SP, BA exigem cliente A1)
          ...(clientPfx ? { pfx: clientPfx.buffer, passphrase: clientPfx.senha } : {}),
        },
        () => {
          try {
            const chain: Buffer[] = [];
            const visitados = new Set<string>();
            let atual = socket.getPeerCertificate(true);
            let guard = 0;
            while (atual && guard < 10) {
              const fingerprint = atual.fingerprint256 ?? atual.fingerprint ?? '';
              if (fingerprint && visitados.has(fingerprint)) break;
              if (fingerprint) visitados.add(fingerprint);
              if (atual.raw) chain.push(atual.raw);
              if (!atual.issuerCertificate || atual.issuerCertificate === atual) break;
              atual = atual.issuerCertificate;
              guard++;
            }
            socket.end();
            resolve(chain);
          } catch (err) {
            socket.end();
            reject(err as Error);
          }
        },
      );
      socket.setTimeout(10_000, () => {
        socket.destroy();
        reject(new Error(`Timeout conectando a ${host}:${port}`));
      });
      socket.on('error', (err) => reject(err));
    });
  }

  private derToPem(der: Buffer): string {
    const base64 = der.toString('base64');
    const lines = base64.match(/.{1,64}/g) ?? [base64];
    return `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----\n`;
  }

  private gerarNomeArquivo(pem: string, host: string, index: number): string | null {
    try {
      const cert = new X509Certificate(pem);
      const cn = this.extrairCn(cert.subject) ?? `unknown-${host}-${index}`;
      const slug = cn
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .toLowerCase()
        .slice(0, 60);
      return `${slug}.pem`;
    } catch {
      return `${host.replace(/[^a-z0-9]/gi, '-')}-${index}.pem`;
    }
  }

  private registrarLog(log: Omit<SefazRefreshLog, 'timestamp'>): void {
    this.historicoLogs.push({ ...log, timestamp: new Date().toISOString() });
    if (this.historicoLogs.length > MAX_LOGS_GUARDADOS) {
      this.historicoLogs.splice(0, this.historicoLogs.length - MAX_LOGS_GUARDADOS);
    }
  }
}
