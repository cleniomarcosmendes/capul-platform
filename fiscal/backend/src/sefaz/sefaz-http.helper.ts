import { request as httpsRequest, type Agent as HttpsAgent } from 'node:https';
import { URL } from 'node:url';

/**
 * POST SOAP 1.2 via `node:https` — aceita mTLS via `https.Agent` com pfx.
 *
 * Motivação: undici não aceita `https.Agent` diretamente; Node https, sim.
 * Este helper é um wrapper simples que promisifica `https.request` com body
 * fixo (POST), timeouts configuráveis e leitura completa da resposta.
 */
export interface SoapPostOptions {
  url: string;
  envelope: string;
  agent: HttpsAgent;
  soapAction?: string;
  timeoutMs?: number;
}

export interface SoapPostResult {
  statusCode: number;
  rawResponse: string;
}

export function soapPost(opts: SoapPostOptions): Promise<SoapPostResult> {
  return new Promise((resolve, reject) => {
    const url = new URL(opts.url);
    const req = httpsRequest(
      {
        method: 'POST',
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        agent: opts.agent,
        headers: {
          'content-type': 'application/soap+xml; charset=utf-8',
          'content-length': Buffer.byteLength(opts.envelope),
          accept: 'application/soap+xml, text/xml',
          'user-agent': 'capul-fiscal/0.1',
          ...(opts.soapAction ? { SOAPAction: opts.soapAction } : {}),
        },
        timeout: opts.timeoutMs ?? 30_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            rawResponse: Buffer.concat(chunks).toString('utf8'),
          });
        });
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error(`SOAP timeout após ${opts.timeoutMs ?? 30_000}ms — ${opts.url}`));
    });
    req.write(opts.envelope);
    req.end();
  });
}
