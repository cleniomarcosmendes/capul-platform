// Padronização 19/06/2026 — hint do seletor de arquivo (atributo `accept`) usado
// em TODOS os uploads de anexo do Workspace, espelhando a whitelist canônica do
// backend (anexo-mime.constant.ts: ALLOWED_MIMES_ANEXO + ALLOWED_EXTENSIONS_ANEXO).
// É só dica de UX; o backend é quem valida de fato.
//
// NÃO usar em telas de IMPORTAÇÃO de dados (ex.: ImportPage), que parseiam o
// arquivo e restringem a .xlsx de propósito.
export const ACCEPT_ANEXO =
  'image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.xml,.zip,.rar,.7z,.trc,.log';
