/**
 * Rótulos do módulo Supervisores/RDV compartilhados entre as telas.
 *
 * Vive fora do arquivo de páginas porque exportar função junto com componente
 * quebra o fast-refresh do Vite (regra `react-refresh/only-export-components`).
 */

/**
 * Papel do representante no RDV.
 *
 * O cadastro (`logistica.supervisor`) guarda matrícula e nome — o papel está na
 * permissão do módulo LOGISTICA, no Configurador, e vem do backend em
 * `papelRepresentante`. As telas chamavam todo representante de "Supervisor",
 * inclusive o coordenador, que também tem RDV próprio.
 */
const PAPEL_LABEL: Record<string, string> = {
  COORDENADOR: 'Coordenador',
  SUPERVISOR: 'Supervisor de Área',
  SUPERVISOR_FROTA: 'Supervisor de Departamento',
};

/** Sem papel definido (cadastro sem conta no módulo) fica o rótulo neutro. */
export const papelLabel = (p?: string | null) => (p ? PAPEL_LABEL[p] ?? p : 'Representante');
