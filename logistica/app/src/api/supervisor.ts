import { api } from './client';
import { LOGISTICA_BASE } from './config';

// Cliente do módulo Supervisores/RDV no app (Fase 4). Reusa o JWT do usuário
// logado; endpoints escopados por filial no backend.

export interface ViagemSup {
  id: string; numero: number; situacao: string; mesReferencia?: number | null;
  adiantamento?: string | number | null; condutorNome?: string | null;
  regiao?: { id: string; nome: string } | null;
  _count?: { paradas: number; despesas: number };
}
export interface VisitaSup {
  id: string; sequencia: number; clienteNome?: string | null; municipio?: string | null;
  propriedade?: string | null; observacao?: string | null; dataHora?: string | null;
  atividade?: { nome: string } | null;
}
export interface DespesaSup {
  id: string; valor: number | string; dataDespesa?: string | null;
  tipoDespesa?: { nome: string; categoria: string } | null;
}
export interface ViagemSupDetalhe extends ViagemSup { paradas: VisitaSup[]; despesas: DespesaSup[] }
export interface AtividadeSup { id: string; nome: string; ativo?: boolean }
export interface RegiaoSup { id: string; nome: string; ativo?: boolean }
export interface TipoDespesaSup { id: string; nome: string; categoria: string; ativo?: boolean }

export interface NovaVisita {
  atividadeId?: string; regiaoId?: string; clienteNome: string;
  municipio?: string; propriedade?: string; observacao?: string; dataVisita?: string;
}
export interface NovaDespesa {
  tipoDespesaId: string; valor: number; data?: string; fornecedor?: string; observacao?: string;
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
export async function lancarDespesaApp(id: string, body: NovaDespesa): Promise<void> {
  await api.post(`${B}/viagens/${id}/despesas`, body);
}
export async function listarAtividadesSup(): Promise<AtividadeSup[]> {
  const { data } = await api.get<AtividadeSup[]>(`${B}/atividades`, { params: { ativos: true } });
  return data;
}
export async function listarRegioesSup(): Promise<RegiaoSup[]> {
  const { data } = await api.get<RegiaoSup[]>(`${B}/regioes`, { params: { ativos: true } });
  return data;
}
export async function listarTiposDespesaSup(): Promise<TipoDespesaSup[]> {
  const { data } = await api.get<TipoDespesaSup[]>(`${LOGISTICA_BASE}/despesas/tipos`);
  return data.filter((t) => t.ativo !== false);
}
