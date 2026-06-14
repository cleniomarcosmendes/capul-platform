// Decodifica o papel da Logística direto do access token (sem lib). O JWT da
// plataforma carrega `modulos: [{ codigo, role }]` — pegamos o role de LOGISTICA
// pra decidir a tela inicial (ENTREGADOR → entregas; demais → frota).

interface JwtPayload {
  modulos?: { codigo: string; role: string }[];
}

/** Base64URL → string (atob é global no Hermes/RN ≥0.74). */
function decodeBase64Url(b64url: string): string {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(
    b64url.length + ((4 - (b64url.length % 4)) % 4),
    '=',
  );
  return atob(b64);
}

export function papelLogistica(accessToken: string | null): string | null {
  if (!accessToken) return null;
  try {
    const payload = accessToken.split('.')[1];
    if (!payload) return null;
    const json = JSON.parse(decodeBase64Url(payload)) as JwtPayload;
    return json.modulos?.find((m) => m.codigo === 'LOGISTICA')?.role ?? null;
  } catch {
    return null;
  }
}
