export class ModuloPayload {
  codigo: string;
  role: string;
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
