/**
 * Helpers de CNPJ — auditoria 10/05/2026 #DT3-M3.
 *
 * Centraliza operações repetidas em 7+ arquivos do fiscal-backend
 * (cadastro, receita, dacte, danfe, nfe, cruzamento, etc.).
 *
 * Mantém apenas operações puras (sem side-effects, sem injeção de
 * dependências) — funções utilitárias importáveis diretamente.
 */

/** Remove tudo que não for dígito. Útil pra normalizar CNPJ vindo de UI/CSV. */
export function onlyDigits(cnpj: string | null | undefined): string {
  if (!cnpj) return '';
  return cnpj.replace(/\D/g, '');
}

/** Retorna true se a string tem exatamente 14 dígitos após remover não-dígitos. */
export function isValidCnpjLength(cnpj: string | null | undefined): boolean {
  return onlyDigits(cnpj).length === 14;
}

/** Retorna true se a string tem exatamente 11 dígitos (CPF) após normalizar. */
export function isValidCpfLength(cpfOuCnpj: string | null | undefined): boolean {
  return onlyDigits(cpfOuCnpj).length === 11;
}

/**
 * Formata CNPJ no padrão visual brasileiro: 12.345.678/0001-90.
 * Se input não tiver 14 dígitos, retorna o input original (não quebra UI).
 */
export function formatCnpj(cnpj: string | null | undefined): string {
  const digits = onlyDigits(cnpj);
  if (digits.length !== 14) return cnpj ?? '';
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

/**
 * Formata CPF no padrão visual: 123.456.789-01.
 * Se input não tiver 11 dígitos, retorna o input original.
 */
export function formatCpf(cpf: string | null | undefined): string {
  const digits = onlyDigits(cpf);
  if (digits.length !== 11) return cpf ?? '';
  return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
}

/**
 * Formata CPF ou CNPJ automaticamente baseado no comprimento.
 * Útil pra exibir documentos onde o tipo varia (destinatário NF-e, etc).
 */
export function formatCpfCnpj(doc: string | null | undefined): string {
  const digits = onlyDigits(doc);
  if (digits.length === 14) return formatCnpj(digits);
  if (digits.length === 11) return formatCpf(digits);
  return doc ?? '';
}
