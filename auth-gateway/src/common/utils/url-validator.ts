import * as net from 'node:net';

/**
 * Valida que uma URL pode ser usada para fetch externo (webhook etc.) sem
 * permitir SSRF a recursos internos da rede CAPUL ou metadata do cloud.
 *
 * Bloqueia:
 *  - protocolos diferentes de http/https (file://, gopher://, ftp://)
 *  - hostnames localhost / 0.0.0.0
 *  - IPv4 loopback (127/8)
 *  - IPv4 link-local (169.254/16) — inclui metadata IMDSv1 do AWS/Azure/GCP
 *  - IPv4 RFC 1918 (10/8, 172.16-31/12, 192.168/16) — redes internas CAPUL
 *  - IPv4 multicast (224-239)
 *  - IPv6 loopback (::1), ULA (fc00::/7), link-local (fe80::/10)
 *
 * Limitação conhecida: não resolve DNS antes do fetch (DNS rebinding ainda
 * possível). Para o cenário "admin malicioso configura webhook" o impacto é
 * baixo — admin já tem privilégio. Validação por hostname literal é defesa
 * em profundidade, não solução completa.
 *
 * Auditoria 10/05/2026 #B2 — alert-notifier webhookAlerta sem validação.
 */
export function validatePublicUrl(url: string): { ok: true } | { ok: false; reason: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: 'URL malformada' };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { ok: false, reason: `Protocolo ${parsed.protocol} não permitido (apenas http/https)` };
  }

  const hostname = parsed.hostname.toLowerCase();

  if (hostname === 'localhost' || hostname === '0.0.0.0' || hostname === '') {
    return { ok: false, reason: `Hostname '${hostname || '(vazio)'}' não permitido` };
  }

  if (net.isIP(hostname)) {
    if (net.isIPv4(hostname) && isPrivateIPv4(hostname)) {
      return { ok: false, reason: `IP privado/reservado ${hostname} não permitido` };
    }
    if (net.isIPv6(hostname) && isPrivateIPv6(hostname)) {
      return { ok: false, reason: `IPv6 privado/reservado ${hostname} não permitido` };
    }
  }

  return { ok: true };
}

function isPrivateIPv4(ip: string): boolean {
  if (/^127\./.test(ip)) return true; // loopback
  if (/^169\.254\./.test(ip)) return true; // link-local + cloud metadata
  if (/^10\./.test(ip)) return true; // RFC 1918
  if (/^192\.168\./.test(ip)) return true; // RFC 1918
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) return true; // RFC 1918
  if (/^22[4-9]\./.test(ip) || /^23[0-9]\./.test(ip)) return true; // multicast
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  if (ip === '::1') return true; // loopback
  if (/^fc/i.test(ip) || /^fd/i.test(ip)) return true; // ULA
  if (/^fe80/i.test(ip)) return true; // link-local
  return false;
}
