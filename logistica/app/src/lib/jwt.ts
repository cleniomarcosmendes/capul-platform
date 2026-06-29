// Decodifica o papel da Logística direto do access token (sem lib). O JWT da
// plataforma carrega `modulos: [{ codigo, role }]` — pegamos o role de LOGISTICA
// pra decidir o que o usuário pode operar (lançador FROTA/ENTREGA).

interface JwtPayload {
  modulos?: { codigo: string; role: string }[];
  tipo?: string;
  departamentoId?: string;
  filialId?: string;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Decodificação base64 SEM depender de `atob`/Buffer — alguns runtimes do Expo
// Go não expõem `atob`, e aí o decode falhava silenciosamente (role virava null
// → todo usuário parecia "sem permissão"). Implementação pura resolve em qualquer
// runtime.
function base64ToBytes(b64: string): number[] {
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < b64.length; i++) {
    const ch = b64[i];
    if (ch === '=') break;
    const val = B64.indexOf(ch);
    if (val === -1) continue;
    buffer = (buffer << 6) | val;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return bytes;
}

// Bytes UTF-8 → string JS (cobre acentos do nome/depto sem mojibake).
function utf8Decode(bytes: number[]): string {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i++];
    if (b < 0x80) {
      out += String.fromCharCode(b);
    } else if (b >= 0xc0 && b < 0xe0) {
      out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i++] & 0x3f));
    } else if (b >= 0xe0 && b < 0xf0) {
      out += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f));
    } else {
      const cp = ((b & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
      const c = cp - 0x10000;
      out += String.fromCharCode(0xd800 + (c >> 10), 0xdc00 + (c & 0x3ff));
    }
  }
  return out;
}

function decodeBase64Url(b64url: string): string {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  return utf8Decode(base64ToBytes(b64));
}

function decodePayload(accessToken: string | null): JwtPayload | null {
  if (!accessToken) return null;
  try {
    const payload = accessToken.split('.')[1];
    if (!payload) return null;
    return JSON.parse(decodeBase64Url(payload)) as JwtPayload;
  } catch {
    return null;
  }
}

export function papelLogistica(accessToken: string | null): string | null {
  return decodePayload(accessToken)?.modulos?.find((m) => m.codigo === 'LOGISTICA')?.role ?? null;
}

/** Tipo do usuário: 'INDIVIDUAL' (pessoa) | 'PADRAO' (login genérico). */
export function tipoUsuario(accessToken: string | null): string | null {
  return decodePayload(accessToken)?.tipo ?? null;
}

/** Departamento (lotação) do usuário — usado p/ filtrar veículos na saída de frota. */
export function departamentoUsuario(accessToken: string | null): string | null {
  return decodePayload(accessToken)?.departamentoId ?? null;
}

export function filialUsuario(accessToken: string | null): string | null {
  return decodePayload(accessToken)?.filialId ?? null;
}
