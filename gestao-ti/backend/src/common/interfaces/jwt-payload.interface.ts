export class ModuloDepartamentoPayload {
  id: string;
  nome: string;
  role: string;
  funcionalidades: string[];
  /**
   * S12 (25/05) — true se este depto é do tipo "Tecnologia". Lido por
   * `ehStaffDeTI(user)` (roles.constant) — hoje só p/ artigo GLOBAL de conhecimento
   * real em users multi-perfil. Opcional pra retrocompat com tokens
   * pré-S12 (tratado como false → conservador, não vaza).
   */
  isTI?: boolean;
}

export class ModuloPayload {
  codigo: string;
  role: string;
  // Workspace Multi-Departamento (Onda 1 Sub-fase 1.4) — opcional pra retrocompat
  // com tokens emitidos antes da 1.4. Sub-fase 1.5 popula request com este array
  // via gestao-ti.guard.ts.
  departamentos?: ModuloDepartamentoPayload[];
}

export class JwtPayload {
  sub: string;
  username: string;
  email: string | null;
  filialId: string;
  filialCodigo: string;
  departamentoId: string;
  departamentoNome: string;
  modulos: ModuloPayload[];
  /**
   * Onda 3 S0 (24/05). Capabilities ativas do user (ex: OVERSIGHT_PLATAFORMA).
   * Opcional pra retrocompat com tokens emitidos antes da S0 (helpers leem
   * como [] via `??` em capability.helper.ts).
   */
  capabilities?: string[];
}
