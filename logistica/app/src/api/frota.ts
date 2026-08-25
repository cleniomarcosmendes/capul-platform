import { api } from './client';
import { LOGISTICA_BASE } from './config';
import type { CondutorInfo, TipoDespesa, VeiculoFrota, ViagemFrota } from '../types/api';

// API de FROTA (Fase 2) — self-service. O condutor NÃO é usuário do sistema:
// se identifica por matrícula+senha (Protheus loginPortal) POR AÇÃO. A validação
// de senha responde SEMPRE 200 {valida, motivo} (nunca 401 que deslogaria).

/** Passo 1: nome do condutor pela matrícula (antes da senha). */
export async function buscarCondutor(matricula: string): Promise<CondutorInfo> {
  const { data } = await api.post<CondutorInfo>(`${LOGISTICA_BASE}/frota/condutor`, { matricula });
  return data;
}

export type ValidacaoCondutor =
  | { valida: true; matricula: string; nome: string }
  | { valida: false; motivo: 'CREDENCIAIS_INVALIDAS' | 'INDISPONIVEL' };

/** Passo 2: valida matrícula+senha — 200 sempre (resultado no corpo). */
export async function validarCondutor(matricula: string, senha: string): Promise<ValidacaoCondutor> {
  const { data } = await api.post<ValidacaoCondutor>(`${LOGISTICA_BASE}/frota/condutor/validar`, { matricula, senha });
  return data;
}

export type AutenticacaoCondutor =
  | { valida: true; token: string; expiraEmSeg: number; condutorNome: string }
  | { valida: false; motivo: 'CREDENCIAIS_INVALIDAS' | 'INDISPONIVEL' | 'NAO_E_O_CONDUTOR' };

/** Gate do login PADRÃO: identifica o condutor da viagem (matrícula+senha) e
 *  devolve o token que libera operar a viagem. SEMPRE 200 (resultado no corpo). */
export async function autenticarCondutor(viagemId: string, matricula: string, senha: string): Promise<AutenticacaoCondutor> {
  const { data } = await api.post<AutenticacaoCondutor>(`${LOGISTICA_BASE}/frota/viagens/${viagemId}/autenticar-condutor`, { matricula, senha });
  return data;
}

/** Veículos disponíveis da filial (pra escolher na saída). Filtra por departamento
 *  de lotação e/ou busca (placa/modelo/marca) quando informado. */
export async function veiculosDisponiveis(
  opts: { busca?: string } = {},
): Promise<VeiculoFrota[]> {
  const { data } = await api.get<VeiculoFrota[]>(`${LOGISTICA_BASE}/veiculos`, {
    params: {
      situacao: 'DISPONIVEL',
      // Frota é compartilhável: lista DISPONÍVEIS de QUALQUER filial/departamento.
      // O filtro "Filial · Departamento" da tela estreita a escolha (client-side).
      todasFiliais: 'true',
      ...(opts.busca?.trim() ? { busca: opts.busca.trim() } : {}),
    },
  });
  return data;
}

/**
 * Viagens de frota do PRÓPRIO usuário (default: em curso).
 *
 * `escopo=meus` é obrigatório aqui, exatamente como no RDV: sem ele o backend
 * devolve a listagem do DESKTOP, onde GESTOR_FROTA/ADMIN veem a frota inteira —
 * correto lá (é a tela de gestão), errado aqui, onde a lista significa "veículo
 * que EU estou operando". Visto na HLG em 25/08: o ADMIN abria o app e via a
 * saída registrada por outra pessoa.
 *
 * E é o que basta para a gestão ficar no desktop: sem o cartão na lista não há
 * caminho até o detalhe (não existe deep link nem busca por número no app).
 */
export async function listarViagensFrota(situacao: 'EM_CURSO' | 'CONCLUIDA' = 'EM_CURSO'): Promise<ViagemFrota[]> {
  const { data } = await api.get<ViagemFrota[]>(`${LOGISTICA_BASE}/frota/viagens`, { params: { situacao, escopo: 'meus' } });
  return data;
}

/** Parada planejada da rota: local + cliente (SA1) opcional. O cliente faz a entrega
 *  alimentar a consolidação da localização do local (geo). */
export interface ParadaPlanejadaApp { local: string; clienteMatricula?: string; clienteNome?: string }

export interface SaidaPayload {
  matricula: string;
  senha: string;
  veiculoId: string;
  kmInicial: number;
  finalidade?: string;
  paradasPlanejadas?: ParadaPlanejadaApp[];
  /** ISO 8601 — só no lançamento retroativo ("Saí antes"). Sem ela vale agora. */
  dataHoraSaida?: string;
  /** Departamento do usuário — ver SaidaIndividualPayload. */
  departamentoSolicitanteId?: string;
}

/** Registrar saída PADRAO (revalida matrícula+senha no backend). */
export async function registrarSaida(p: SaidaPayload): Promise<ViagemFrota> {
  const { data } = await api.post<ViagemFrota>(`${LOGISTICA_BASE}/frota/viagens`, p);
  return data;
}

export interface SaidaIndividualPayload {
  veiculoId: string;
  kmInicial: number;
  finalidade?: string;
  paradasPlanejadas?: ParadaPlanejadaApp[];
  /** ISO 8601 — só no lançamento retroativo ("Saí antes"). Sem ela vale agora. */
  dataHoraSaida?: string;
  /** Só quando o usuário logado não tem matrícula no cadastro. SEM senha —
   *  o login INDIVIDUAL já autenticou a pessoa (mesma regra do retorno). */
  matricula?: string;
  /** Quem pediu o veículo. O app manda o departamento do usuário automaticamente
   *  (sem campo na tela): alimenta a análise de custo de frota por departamento,
   *  que estava cega porque a saída pelo celular nunca informava isso. */
  departamentoSolicitanteId?: string;
}

/** Registrar saída INDIVIDUAL — o próprio usuário logado é o condutor (sem senha). */
export async function registrarSaidaIndividual(p: SaidaIndividualPayload): Promise<ViagemFrota> {
  const { data } = await api.post<ViagemFrota>(`${LOGISTICA_BASE}/frota/viagens/individual`, p);
  return data;
}

export interface RetornoPayload {
  // PADRÃO usa o token de condutor (header) → matrícula/senha opcionais.
  matricula?: string;
  senha?: string;
  kmFinal: number;
  observacoes?: string;
  /** ISO 8601 — só no lançamento retroativo ("Cheguei antes"). Sem ela vale agora. */
  dataHoraChegada?: string;
}

/** Registrar retorno (só o próprio condutor; revalida senha). */
export async function registrarRetorno(viagemId: string, p: RetornoPayload): Promise<ViagemFrota> {
  const { data } = await api.post<ViagemFrota>(`${LOGISTICA_BASE}/frota/viagens/${viagemId}/retorno`, p);
  return data;
}

/** Tipos de despesa ativos (pra o select do lançamento). */
/** `dataHora` (ISO): QUANDO a parada aconteceu — preenchido ao enfileirar sem
 *  sinal. Sem ela o servidor carimba a hora em que a fila subiu, e uma viagem
 *  de dias volta com todas as paradas empilhadas no minuto da sincronização. */
export interface ParadaPayload { local: string; km?: number; observacao?: string; latitude?: number; longitude?: number; precisaoM?: number; noLocal?: boolean; clienteMatricula?: string; clienteNome?: string; idempotencyKey?: string; dataHora?: string }

/** Registra uma parada (ad-hoc) na viagem em curso — o "caderno" da frota. */
export async function adicionarParadaFrota(viagemId: string, p: ParadaPayload): Promise<void> {
  await api.post(`${LOGISTICA_BASE}/frota/viagens/${viagemId}/paradas`, p);
}

export interface ParadaFrotaItem {
  id: string; sequencia: number; status: 'PLANEJADA' | 'REALIZADA' | 'PULADA';
  local: string | null; planejadoLocal: string | null;
  km: number | null; realizadaEm: string | null; observacao: string | null;
}

/** Lista as paradas da viagem (planejadas + realizadas + puladas). */
export async function listarParadasFrota(viagemId: string): Promise<ParadaFrotaItem[]> {
  const { data } = await api.get<ParadaFrotaItem[]>(`${LOGISTICA_BASE}/frota/viagens/${viagemId}/paradas`);
  return data;
}

export interface CheckinPayload { km?: number; latitude?: number; longitude?: number; observacao?: string; precisaoM?: number; noLocal?: boolean; clienteMatricula?: string; clienteNome?: string; dataHora?: string }

/** Check-in numa parada planejada → REALIZADA (KM + GPS opcional + obs). */
export async function checkinParadaFrota(viagemId: string, paradaId: string, p: CheckinPayload): Promise<void> {
  await api.patch(`${LOGISTICA_BASE}/frota/viagens/${viagemId}/paradas/${paradaId}/checkin`, p);
}

/** Marca uma parada planejada como PULADA. */
export async function pularParadaFrota(viagemId: string, paradaId: string): Promise<void> {
  await api.patch(`${LOGISTICA_BASE}/frota/viagens/${viagemId}/paradas/${paradaId}/pular`, {});
}

export interface LocalParada { id: string; nome: string; ativo: boolean; veiculoId?: string | null; departamentoId?: string | null; filialId?: string | null }

/** Locais/pontos de parada cadastrados (atalho do planejamento). Filtra pela
 *  filial (+ globais) quando informada — pra busca/sugestões no app. */
export async function listarLocaisParada(filialId?: string): Promise<LocalParada[]> {
  const params: Record<string, string> = { ativos: 'true' };
  if (filialId) params.filialId = filialId;
  const { data } = await api.get<LocalParada[]>(`${LOGISTICA_BASE}/frota/locais`, { params });
  return data;
}

export async function tiposDespesa(): Promise<TipoDespesa[]> {
  const { data } = await api.get<TipoDespesa[]>(`${LOGISTICA_BASE}/despesas/tipos`, { params: { ativos: 'true' } });
  return data;
}

export interface FornecedorDespesa { id: string; nome: string; ativo: boolean }

/** Fornecedores ativos do cadastro (postos etc.) pro lançamento de despesa. */
export async function fornecedoresDespesa(): Promise<FornecedorDespesa[]> {
  const { data } = await api.get<FornecedorDespesa[]>(`${LOGISTICA_BASE}/despesas/fornecedores`, { params: { ativos: 'true' } });
  return data;
}

export interface DespesaViagemPayload {
  viagemId: string;
  tipoDespesaId: string;
  valor: number;
  dataDespesa?: string; // AAAA-MM-DD (opcional → hoje); backend ancora meio-dia
  fornecedorId?: string;
  fornecedor?: string;
  observacao?: string;
  // Nota fiscal / documento (ex.: nota de débito da borracharia). semNota=true
  // → lançamento sem nota (documento fica vazio).
  numeroDocumento?: string;
  semNota?: boolean;
  idempotencyKey?: string;
}

/**
 * Lançar despesa na viagem em curso → PENDENTE. Login PADRÃO re-identifica o
 * condutor (matrícula+senha); INDIVIDUAL herda o próprio login. Foto do cupom
 * OPCIONAL (multipart). Caso de uso mais forte do mobile: fotografar o recibo na rua.
 */
export async function lancarDespesaViagem(p: DespesaViagemPayload, fotoUris?: string[]): Promise<void> {
  const form = new FormData();
  form.append('viagemId', p.viagemId);
  form.append('tipoDespesaId', p.tipoDespesaId);
  form.append('valor', String(p.valor));
  if (p.dataDespesa) form.append('dataDespesa', p.dataDespesa);
  if (p.fornecedorId) form.append('fornecedorId', p.fornecedorId);
  if (p.fornecedor) form.append('fornecedor', p.fornecedor);
  if (p.observacao) form.append('observacao', p.observacao);
  if (p.semNota) form.append('semNota', 'true');
  else if (p.numeroDocumento) form.append('numeroDocumento', p.numeroDocumento);
  if (p.idempotencyKey) form.append('idempotencyKey', p.idempotencyKey);
  (fotoUris ?? []).filter(Boolean).forEach((uri, i) => {
    const isPng = uri.toLowerCase().endsWith('.png');
    form.append('comprovantes', {
      uri,
      name: isPng ? `recibo-${i + 1}.png` : `recibo-${i + 1}.jpg`,
      type: isPng ? 'image/png' : 'image/jpeg',
    } as unknown as Blob);
  });
  await api.post(`${LOGISTICA_BASE}/despesas/viagem`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 90_000,
  });
}
