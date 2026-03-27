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

export interface ModuloPayload {
  codigo: string;
  role: string;
}
