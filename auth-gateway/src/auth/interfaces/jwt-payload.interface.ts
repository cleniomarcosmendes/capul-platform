export interface JwtPayload {
  sub: string;
  username: string;
  email: string | null;
  filialId: string | null;
  filialCodigo: string | null;
  modulos: ModuloPayload[];
}

export interface ModuloPayload {
  codigo: string;
  role: string;
}
