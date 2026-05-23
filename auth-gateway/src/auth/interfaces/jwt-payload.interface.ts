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
}

export interface ModuloDepartamentoPayload {
  id: string;
  nome: string;
  role: string;
  funcionalidades: string[];
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
