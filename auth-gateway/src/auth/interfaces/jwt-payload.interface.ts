export interface JwtPayload {
  sub: string;
  username: string;
  email: string | null;
  tipo: string;
  filialId: string | null;
  filialCodigo: string | null;
  departamentoId: string;
  departamentoNome: string;
  modulos: ModuloPayload[];
  /**
   * Capabilities ativas do user (Onda 3 S0).
   * Exemplos: 'OVERSIGHT_PLATAFORMA' (bypass em cadastros operacionais).
   * Capabilities sensíveis LGPD (FISCAL_CONSULTA_SOCIOS) seguem validadas
   * on-demand contra o DB (defesa em profundidade); o JWT carrega apenas
   * pra cache de performance em capabilities operacionais.
   */
  capabilities: string[];
}

export interface ModuloDepartamentoPayload {
  id: string;
  nome: string;
  role: string;
  funcionalidades: string[];
  /**
   * S12 (25/05) — true se este depto é do tipo "Tecnologia". Consumido por
   * `hasStaffPerfilEmTI(user)` no gestao-ti pra resolver multi-perfil sem
   * confiar no `role` denormalizado. Tokens antigos sem este campo são
   * tratados como isTI=false (conservador — não vaza visibilidade).
   */
  isTI: boolean;
}

export interface ModuloPayload {
  codigo: string;
  /**
   * Role denormalizada (= role do primeiro depto em `departamentos[]`).
   * Mantida por retrocompatibilidade (Sub-fase 1.4 — caminho A).
   * Será removida na Sub-fase 1.6 após guards iterarem departamentos[].
   */
  role: string;
  /**
   * NOVO na Sub-fase 1.4: cada depto onde o user tem permissão nesse módulo.
   */
  departamentos: ModuloDepartamentoPayload[];
}
