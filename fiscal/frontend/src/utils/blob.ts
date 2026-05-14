/**
 * Helpers de blob/anexo (Fiscal). Mantém paridade com `gestao-ti/utils/anexo.ts`
 * (duplicação consciente — frontends são isolados, não compartilham módulos).
 */

/**
 * Abre o blob em uma nova aba (PDF/XML usam o viewer nativo do browser, que
 * já oferece botão de download embutido). Evita o tradicional "force download"
 * que pula o viewer.
 */
export function abrirBlobEmNovaAba(blob: Blob, _filename?: string): void {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  // Mantém o URL vivo até o usuário fechar a aba (revoke aqui descartaria o
  // conteúdo antes do browser carregar). Browsers modernos limpam ao fim da
  // sessão.
}

/**
 * Força download tradicional do blob (fallback ou ação explícita "Baixar").
 */
export function baixarBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
