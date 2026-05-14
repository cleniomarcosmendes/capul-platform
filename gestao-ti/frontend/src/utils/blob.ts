/**
 * Adiciona `; charset=utf-8` ao mime quando for tipo textual (text/*, application/json,
 * application/xml, application/javascript, etc.). Evita mojibake ao abrir arquivos
 * baixados como blob — browser sem charset explícito default pra Latin-1 e renderiza
 * caracteres acentuados como `Ã£`, `Ã­`, etc. (incidente 14/05/2026 — TXT de chamado).
 *
 * Mimes binários (image/*, application/pdf, etc.) ficam intactos.
 */
export function withCharsetUtf8(mimeType: string | null | undefined): string {
  if (!mimeType) return 'application/octet-stream';
  // Já tem charset declarado pelo servidor — respeita.
  if (/;\s*charset=/i.test(mimeType)) return mimeType;
  const lower = mimeType.toLowerCase();
  const isTextual =
    lower.startsWith('text/') ||
    lower === 'application/json' ||
    lower === 'application/xml' ||
    lower === 'application/javascript' ||
    lower === 'application/x-javascript' ||
    lower === 'application/ld+json' ||
    lower.endsWith('+xml') ||
    lower.endsWith('+json');
  return isTextual ? `${mimeType}; charset=utf-8` : mimeType;
}
