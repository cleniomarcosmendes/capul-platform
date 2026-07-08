import { api } from './client';
import { LOGISTICA_BASE } from './config';

// Cliente do módulo Supervisores/RDV no app (Fase 4). Reusa o JWT do usuário
// logado; endpoints escopados por filial no backend.

// Redesenho 6a–6d: o planejamento tem um ciclo próprio (statusPlanejamento); a
// visita nasce PLANEJADA e é apontada REALIZADA/PULADA na execução; a despesa
// nasce PENDENTE e o coordenador decide (aprovação é feita no desktop). Região
// foi REMOVIDA — município vem do cliente/digitação.
export type StatusPlanejamento = 'RASCUNHO' | 'ENVIADO' | 'APROVADO' | 'AJUSTADO' | 'REJEITADO' | 'EM_EXECUCAO' | 'CONCLUIDO';
export type StatusVisita = 'PLANEJADA' | 'REALIZADA' | 'PULADA';
export type SituacaoDespesa = 'PENDENTE' | 'APROVADA' | 'CONTESTADA';

export interface ViagemSup {
  id: string; numero: number; situacao: string; mesReferencia?: number | null;
  statusPlanejamento?: StatusPlanejamento | null;
  adiantamento?: string | number | null; condutorNome?: string | null;
  comentarioCoordenador?: string | null;
  _count?: { paradas: number; despesas: number };
}
export interface VisitaSup {
  id: string; sequencia: number; status?: StatusVisita | null;
  clienteNome?: string | null; municipio?: string | null;
  propriedade?: string | null; observacao?: string | null; dataHora?: string | null;
  atividadeId?: string | null; atividade?: { nome: string } | null;
}
export interface DespesaSup {
  id: string; valor: number | string; dataDespesa?: string | null; situacao?: SituacaoDespesa | null;
  comprovanteObjectKey?: string | null;
  tipoDespesa?: { nome: string; categoria: string } | null;
}
export interface ViagemSupDetalhe extends ViagemSup { paradas: VisitaSup[]; despesas: DespesaSup[] }
export interface AtividadeSup { id: string; nome: string; ativo?: boolean }
export interface TipoDespesaSup { id: string; nome: string; categoria: string; ativo?: boolean }

export interface NovaVisita {
  atividadeId?: string; clienteNome: string;
  municipio?: string; propriedade?: string; observacao?: string; dataVisita?: string;
  latitude?: number; longitude?: number; // GPS da visita (igual às paradas da frota)
  idempotencyKey?: string; // fila offline: dedup no reenvio
}
export interface NovaDespesa {
  tipoDespesaId: string; valor: number; data?: string; fornecedor?: string; observacao?: string;
  idempotencyKey?: string; // fila offline: dedup no reenvio
}

const B = `${LOGISTICA_BASE}/supervisor`;

export async function listarViagensSupervisor(situacao?: string): Promise<ViagemSup[]> {
  const { data } = await api.get<ViagemSup[]>(`${B}/viagens`, { params: situacao ? { situacao } : {} });
  return data;
}
export async function obterViagemSupervisor(id: string): Promise<ViagemSupDetalhe> {
  const { data } = await api.get<ViagemSupDetalhe>(`${B}/viagens/${id}`);
  return data;
}
export async function adicionarVisitaApp(id: string, body: NovaVisita): Promise<void> {
  await api.post(`${B}/viagens/${id}/visitas`, body);
}
/**
 * Lança a despesa do supervisor → PENDENTE (coordenador aprova/rejeita depois).
 * Comprovante (foto do recibo) OPCIONAL — caso de uso forte no campo: fotografar
 * na hora. Com foto → multipart; sem foto → JSON. Backend aceita os dois.
 */
export async function lancarDespesaApp(id: string, body: NovaDespesa, fotoUri?: string): Promise<void> {
  if (!fotoUri) {
    await api.post(`${B}/viagens/${id}/despesas`, body);
    return;
  }
  const form = new FormData();
  form.append('tipoDespesaId', body.tipoDespesaId);
  form.append('valor', String(body.valor));
  if (body.data) form.append('data', body.data);
  if (body.fornecedor) form.append('fornecedor', body.fornecedor);
  if (body.observacao) form.append('observacao', body.observacao);
  if (body.idempotencyKey) form.append('idempotencyKey', body.idempotencyKey);
  const isPng = fotoUri.toLowerCase().endsWith('.png');
  form.append('comprovante', {
    uri: fotoUri,
    name: isPng ? 'comprovante.png' : 'comprovante.jpg',
    type: isPng ? 'image/png' : 'image/jpeg',
  } as unknown as Blob);
  await api.post(`${B}/viagens/${id}/despesas`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60_000,
  });
}
/** Apontamento da visita (6c): PLANEJADA → REALIZADA ou PULADA (na execução). */
export async function apontarVisitaApp(id: string, paradaId: string, status: 'REALIZADA' | 'PULADA', coords?: { latitude?: number; longitude?: number }): Promise<void> {
  await api.patch(`${B}/viagens/${id}/visitas/${paradaId}/apontar`, { status, ...(coords ?? {}) });
}
/** Cria o planejamento (RDV) do supervisor LOGADO — sem matrícula/senha: o backend
 *  identifica pelo JWT (role SUPERVISOR) e liga ao cadastro pela matrícula do login. */
export async function criarPlanejamentoApp(mesReferencia: number, veiculoId?: string): Promise<{ id: string; numero: number }> {
  const { data } = await api.post<{ id: string; numero: number }>(`${B}/viagens`, { mesReferencia, veiculoId });
  return data;
}
/** Workflow do supervisor: enviar ao coordenador · iniciar execução · concluir. */
export async function enviarPlanejamentoApp(id: string): Promise<void> { await api.patch(`${B}/viagens/${id}/enviar`); }
export async function iniciarExecucaoApp(id: string): Promise<void> { await api.patch(`${B}/viagens/${id}/iniciar`); }
export async function concluirPlanejamentoApp(id: string): Promise<void> { await api.patch(`${B}/viagens/${id}/concluir`); }

export async function listarAtividadesSup(): Promise<AtividadeSup[]> {
  const { data } = await api.get<AtividadeSup[]>(`${B}/atividades`, { params: { ativos: true } });
  return data;
}
export async function listarTiposDespesaSup(): Promise<TipoDespesaSup[]> {
  // Endpoint PRÓPRIO do supervisor (gateado pelas roles do supervisor) — desacopla
  // do controller da frota (/despesas/tipos exigia role de frota).
  const { data } = await api.get<TipoDespesaSup[]>(`${B}/tipos-despesa`);
  return data.filter((t) => t.ativo !== false);
}
