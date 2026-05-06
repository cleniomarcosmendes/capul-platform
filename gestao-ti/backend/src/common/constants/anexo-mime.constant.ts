import * as path from 'path';

/**
 * Whitelist canônica de MIME types aceitos em uploads de anexos do
 * módulo Gestão TI. Padronizada em 06/05/2026 — antes cada controller
 * tinha sua própria lista divergente, levando a inconsistências
 * (ex: contrato e compra aceitavam QUALQUER arquivo).
 *
 * NÃO incluir 'application/octet-stream' aqui — permitiria upload de
 * qualquer binário (ex: .exe renomeado para .pdf). Para tipos legítimos
 * com MIME genérico, ver `ALLOWED_EXTENSIONS_ANEXO`.
 */
export const ALLOWED_MIMES_ANEXO = [
  // Imagens
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
  // Documentos
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // Texto
  'text/plain', 'text/csv',
  // Arquivos compactados
  'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
  // Certificados (chamados de cert/A1, etc.)
  'application/x-pkcs12', 'application/pkcs12',
];

/**
 * Extensões permitidas mesmo quando o MIME chega como genérico
 * (octet-stream / text/plain). Cobre tipos legítimos que browsers
 * não detectam corretamente:
 *   .trc — trace files Oracle/SQL Server (debug de chamados de banco)
 *   .log — arquivos de log em geral
 *
 * Validação por extensão case-insensitive.
 */
export const ALLOWED_EXTENSIONS_ANEXO = ['.trc', '.log'];

/**
 * Decide se um arquivo é permitido como anexo no Gestão TI.
 * Aceita se MIME está na whitelist OU se a extensão está na whitelist
 * de extensões adicionais.
 *
 * Usar dentro de `fileFilter` do Multer:
 * ```typescript
 * fileFilter: (_req, file, cb) => {
 *   if (isAnexoPermitido(file)) return cb(null, true);
 *   return cb(new BadRequestException('Tipo de arquivo nao permitido'), false);
 * },
 * ```
 */
export function isAnexoPermitido(file: { mimetype: string; originalname: string }): boolean {
  if (ALLOWED_MIMES_ANEXO.includes(file.mimetype)) return true;
  const ext = path.extname(file.originalname).toLowerCase();
  return ALLOWED_EXTENSIONS_ANEXO.includes(ext);
}

/**
 * Para download: decide se o MIME pode descer ao browser como o original
 * ou se deve cair pra octet-stream (force download). Tipos com MIME na
 * whitelist mantêm o original (permite inline em PDF/imagem); tipos por
 * extensão (.trc, .log) descem como octet-stream.
 */
export function mimeTypeParaDownload(anexoMimeType: string): string {
  return ALLOWED_MIMES_ANEXO.includes(anexoMimeType)
    ? anexoMimeType
    : 'application/octet-stream';
}
