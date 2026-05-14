/**
 * Helpers de anexo (clicar abrir vs baixar). Centraliza o set de mimes
 * visualizáveis e a lógica de fallback — antes essa lógica estava
 * duplicada em 7+ páginas (sweep 14/05/2026).
 */

const VIEWABLE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'application/pdf',
  'text/plain',
  'text/csv',
]);

/**
 * `true` se o browser consegue exibir o arquivo inline (imagens, PDF, txt,
 * csv). Demais mimes (zip, docx, xlsx, etc.) fazem download direto.
 *
 * Aceita mime com charset (ex: `text/plain; charset=utf-8`) — extrai só a
 * parte principal antes do `;`.
 */
export function isViewableMime(mime: string | null | undefined): boolean {
  if (!mime) return false;
  const main = mime.toLowerCase().split(';')[0].trim();
  return VIEWABLE_MIMES.has(main);
}

/**
 * Tenta abrir o anexo no browser; se mime não for viewable, baixa direto.
 * Se `abrir` falhar (erro de rede, mime rejeitado pelo browser, etc.),
 * cai pro download como fallback.
 *
 * Cada caller passa thunks pra abrir/baixar — assim funciona com qualquer
 * service signature (chamado, pendência, contrato, etc.).
 *
 * @example
 * ```tsx
 * onClick={() => abrirAnexoOuBaixar(
 *   a.mimeType,
 *   () => chamadoService.abrirAnexo(chamado.id, a.id, a.mimeType),
 *   () => chamadoService.downloadAnexo(chamado.id, a.id, a.nomeOriginal),
 * )}
 * ```
 */
export async function abrirAnexoOuBaixar(
  mimeType: string | null | undefined,
  abrir: () => Promise<void>,
  baixar: () => Promise<void> | void,
): Promise<void> {
  if (isViewableMime(mimeType)) {
    try {
      await abrir();
      return;
    } catch {
      // cai pro fallback abaixo
    }
  }
  await baixar();
}
