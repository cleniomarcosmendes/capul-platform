import { Injectable, Logger } from '@nestjs/common';
import { request as undiciRequest } from 'undici';
import type { Readable } from 'node:stream';

// F1.2 — Cliente WebDAV da base pública CNPJ (RFB Dados Abertos).
// A RFB migrou p/ Nextcloud público (achado F0): NÃO há mais diretório
// previsível com HEAD; acesso = WebDAV (PROPFIND lista / GET baixa) e o
// token do share público PODE ROTACIONAR → resolvido dinâmico via redirect
// do root (nunca hardcode). Sem certificado, sem SEFAZ — zero risco.
// TODO F1.4: RFB_BASE_HOST migra p/ config no Configurador (hoje env+default).
const RFB_HOST = (process.env.RFB_BASE_HOST || 'https://arquivos.receitafederal.gov.br').replace(/\/+$/, '');
const CNPJ_PATH = 'Dados/Cadastros/CNPJ';
const TOKEN_TTL_MS = 6 * 60 * 60 * 1000;
// Timeout de INATIVIDADE do corpo do download (undici: tempo máximo entre dois
// chunks consecutivos — NÃO é duração total). Um arquivo grande saudável emite
// chunks continuamente, então nunca chega perto disto; só dispara se o socket
// do Nextcloud da RFB ficar mudo (sem mandar dados e sem fechar). Antes era 0
// (desligado) — e um socket pendurado deixava o pipeline esperando p/ sempre,
// virando import zumbi (incidente 22/05: ~8h travado em `empresas`, COPY
// congelada, status IMPORTANDO eterno). Com timeout finito o hang vira erro →
// o retry 3× de RfbImportacaoService.carregarComRetry passa a resolver sozinho.
const STREAM_IDLE_TIMEOUT_MS = 5 * 60 * 1000;

export interface RfbEntry {
  name: string;
  isDir: boolean;
  size: number;
}

@Injectable()
export class RfbWebdavService {
  private readonly logger = new Logger(RfbWebdavService.name);
  private token: string | null = null;
  private tokenAt = 0;

  /** Resolve o token público do share Nextcloud seguindo o 302 do root.
   *  Cache TTL; re-resolve forçado em 401 (rotação de token). */
  async resolverToken(force = false): Promise<string> {
    if (!force && this.token && Date.now() - this.tokenAt < TOKEN_TTL_MS) return this.token;
    // undici.request NÃO segue redirect por default → o 302 + header
    // `location` (com /s/<token>) volta direto, que é o que queremos.
    const { statusCode, headers } = await undiciRequest(`${RFB_HOST}/`, {
      method: 'GET',
      headersTimeout: 20000,
      bodyTimeout: 20000,
    });
    const loc = String(headers['location'] || '');
    const m = loc.match(/\/s\/([A-Za-z0-9_-]+)/);
    if (statusCode !== 302 || !m) {
      throw new Error(`RFB: não consegui resolver token do share (status ${statusCode}, location="${loc}")`);
    }
    this.token = m[1];
    this.tokenAt = Date.now();
    this.logger.log(`RFB token resolvido (${this.token.slice(0, 4)}…)`);
    return this.token;
  }

  private authHeader(token: string): string {
    return 'Basic ' + Buffer.from(`${token}:`).toString('base64');
  }
  private davBase(token: string): string {
    return `${RFB_HOST}/public.php/dav/files/${token}`;
  }

  /** PROPFIND Depth:1 → filhos diretos (nome, isDir, size). */
  async propfind(relPath: string): Promise<RfbEntry[]> {
    let token = await this.resolverToken();
    let res = await this.doPropfind(token, relPath);
    if (res.statusCode === 401) {
      token = await this.resolverToken(true);
      res = await this.doPropfind(token, relPath);
    }
    if (res.statusCode >= 400) throw new Error(`RFB PROPFIND ${relPath} → HTTP ${res.statusCode}`);
    return this.parsePropfind(await res.body.text(), token, relPath);
  }

  private doPropfind(token: string, relPath: string) {
    const url = `${this.davBase(token)}/${relPath}`.replace(/\/+$/, '') + '/';
    return undiciRequest(url, {
      method: 'PROPFIND',
      headers: { Depth: '1', Authorization: this.authHeader(token) },
      headersTimeout: 30000,
      bodyTimeout: 120000,
    });
  }

  private parsePropfind(xml: string, token: string, relPath: string): RfbEntry[] {
    const base = `/public.php/dav/files/${token}/`;
    const self = relPath.replace(/\/+$/, '');
    const out: RfbEntry[] = [];
    for (const b of xml.split(/<\/?[a-z]*:?response>/i)) {
      const hrefM = b.match(/<[a-z]*:?href>([^<]+)<\/[a-z]*:?href>/i);
      if (!hrefM) continue;
      const rel = decodeURIComponent(hrefM[1]).replace(base, '').replace(/\/+$/, '');
      if (!rel || rel === self) continue; // ignora a própria pasta
      const name = rel.split('/').pop() || rel;
      const isDir = /<[a-z]*:?collection\s*\/?>/i.test(b);
      const sizeM = b.match(/<[a-z]*:?getcontentlength>(\d+)<\/[a-z]*:?getcontentlength>/i);
      out.push({ name, isDir, size: sizeM ? parseInt(sizeM[1], 10) : 0 });
    }
    return out;
  }

  /** Versões (pastas AAAA-MM) ordenadas ascendente. */
  async listarVersoes(): Promise<string[]> {
    const entries = await this.propfind(CNPJ_PATH);
    return entries
      .filter((e) => e.isDir && /^\d{4}-\d{2}$/.test(e.name))
      .map((e) => e.name)
      .sort();
  }

  /** Arquivos de uma versão (nome + tamanho em bytes). */
  async listarArquivos(versao: string): Promise<RfbEntry[]> {
    return (await this.propfind(`${CNPJ_PATH}/${versao}`)).filter((e) => !e.isDir);
  }

  /** Stream de download (F1.3). Suporta Range p/ retomada. `bodyTimeout` é
   *  timeout de INATIVIDADE entre chunks (não duração total) — ver
   *  STREAM_IDLE_TIMEOUT_MS: protege contra socket pendurado da RFB. */
  async abrirStream(versao: string, arquivo: string, range?: string): Promise<Readable> {
    const token = await this.resolverToken();
    const url = `${this.davBase(token)}/${CNPJ_PATH}/${versao}/${arquivo}`;
    const headers: Record<string, string> = { Authorization: this.authHeader(token) };
    if (range) headers['Range'] = range;
    const { statusCode, body } = await undiciRequest(url, {
      method: 'GET',
      headers,
      headersTimeout: 30000,
      bodyTimeout: STREAM_IDLE_TIMEOUT_MS,
    });
    if (statusCode >= 400) throw new Error(`RFB GET ${versao}/${arquivo} → HTTP ${statusCode}`);
    return body as unknown as Readable;
  }
}
