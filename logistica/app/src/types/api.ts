// Tipos do que a API da Logística devolve (subconjunto que o app usa).

export type StatusViagem = 'RASCUNHO' | 'EM_CURSO' | 'CONCLUIDA' | 'CANCELADA';
export type StatusEntrega =
  | 'PENDENTE'
  | 'EM_VIAGEM'
  | 'ENTREGUE'
  | 'NAO_ENTREGUE'
  | 'CANCELADA';

export interface Entrega {
  id: string;
  numero: number;
  destinatarioNome: string;
  telefone: string | null;
  endLogradouro: string;
  endNumero: string | null;
  endComplemento: string | null;
  endBairro: string | null;
  endCidade: string | null;
  endUf: string | null;
  endReferencia: string | null;
  horario: string | null;
  observacoes: string | null;
  quantidadeVolumes: number;
  status: StatusEntrega;
}

export interface Parada {
  id: string;
  sequencia: number;
  local: string | null;
  entrega: Entrega | null;
}

export interface Viagem {
  id: string;
  numero: number;
  situacao: StatusViagem;
  filialId: string;
  motoristaId: string;
  criadoEm: string;
  totalVolumes?: number;
  veiculo?: { placa: string; modelo?: string | null } | null;
  paradas?: Parada[];
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  mfaRequired?: boolean;
}
