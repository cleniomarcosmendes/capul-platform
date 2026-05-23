export class ModuloDepartamentoPayload {
  id: string;
  nome: string;
  role: string;
  funcionalidades: string[];
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
}
