import { Injectable } from '@nestjs/common';
import { DashboardResumoService } from './services/dashboard-resumo.service.js';
import { DashboardOperacionalService } from './services/dashboard-operacional.service.js';
import { DashboardFinanceiroService } from './services/dashboard-financeiro.service.js';
import { DashboardAcompanhamentoService } from './services/dashboard-acompanhamento.service.js';
import { DashboardRelatorioService } from './services/dashboard-relatorio.service.js';
import { DashboardIndicadoresService } from './services/dashboard-indicadores.service.js';
import { DashboardPainelService } from './services/dashboard-painel.service.js';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';

@Injectable()
export class DashboardService {
  constructor(
    private readonly resumo: DashboardResumoService,
    private readonly operacional: DashboardOperacionalService,
    private readonly financeiro: DashboardFinanceiroService,
    private readonly acompanhamento: DashboardAcompanhamentoService,
    private readonly relatorio: DashboardRelatorioService,
    private readonly indicadores: DashboardIndicadoresService,
    private readonly painel: DashboardPainelService,
  ) {}

  // ─── Painel de Gestão (25/05) ─────────────────────────────────────

  getPainelChamados(user: JwtPayload, role: string, equipeId?: string) {
    return this.painel.getPainelChamados(user, role, equipeId);
  }

  getPainelProjetos(user: JwtPayload, role: string) {
    return this.painel.getPainelProjetos(user, role);
  }

  async getResumo(
    filters?: { dataInicio?: string; dataFim?: string; departamentoId?: string },
    user?: JwtPayload,
    role?: string,
  ) {
    return this.resumo.getResumo(filters, user, role);
  }

  async getExecutivo(filters?: { dataInicio?: string; dataFim?: string }) {
    return this.resumo.getExecutivo(filters);
  }

  async getDisponibilidade(
    filters: {
      dataInicio?: string;
      dataFim?: string;
      softwareId?: string;
      filialId?: string;
    },
    user?: JwtPayload,
    role?: string,
  ) {
    return this.operacional.getDisponibilidade(filters, user, role);
  }

  async getOrdensServico(
    filters?: { dataInicio?: string; dataFim?: string; filialId?: string },
    user?: JwtPayload,
    role?: string,
  ) {
    return this.operacional.getOrdensServico(filters, user, role);
  }

  async getTecnicosAtivos() {
    return this.operacional.getTecnicosAtivos();
  }

  async getTecnicosDaEquipe(userId: string) {
    return this.operacional.getTecnicosDaEquipe(userId);
  }

  async getFinanceiro(
    filters?: { dataInicio?: string; dataFim?: string },
    user?: JwtPayload,
    role?: string,
  ) {
    return this.financeiro.getFinanceiro(filters, user, role);
  }

  async getCsat(
    filters?: { dataInicio?: string; dataFim?: string; departamentoId?: string },
    user?: JwtPayload,
    role?: string,
  ) {
    return this.financeiro.getCsat(filters, user, role);
  }

  async getAcompanhamento(filters: {
    usuarioId?: string;
    dataInicio?: string;
    dataFim?: string;
    tzOffset?: number;
  }) {
    return this.acompanhamento.getAcompanhamento(filters);
  }

  async listarEquipes() {
    return this.acompanhamento.listarEquipes();
  }

  async buscarChamados(
    filters: { q?: string; status?: string; prioridade?: string; equipeId?: string; tecnicoId?: string; dataInicio?: string; dataFim?: string },
    user?: JwtPayload,
    role?: string,
  ) {
    return this.acompanhamento.buscarChamados(filters, user, role);
  }

  async getAcompanhamentoChamado(chamadoId: string) {
    return this.acompanhamento.getAcompanhamentoChamado(chamadoId);
  }

  async listarProjetosAtivos() {
    return this.acompanhamento.listarProjetosAtivos();
  }

  async buscarAtividades(
    user: JwtPayload,
    role: string,
    q?: string,
    projetoId?: string,
    status?: string,
    dataInicio?: string,
    dataFim?: string,
    responsavelId?: string,
    faseId?: string,
  ) {
    return this.acompanhamento.buscarAtividades(user, role, q, projetoId, status, dataInicio, dataFim, responsavelId, faseId);
  }

  async listarFasesAtivas() {
    return this.acompanhamento.listarFasesAtivas();
  }

  async getAcompanhamentoAtividade(user: JwtPayload, role: string, atividadeId: string) {
    return this.acompanhamento.getAcompanhamentoAtividade(user, role, atividadeId);
  }

  async getMinhasPendencias(userId: string) {
    return this.relatorio.getMinhasPendencias(userId);
  }

  async getRelatorioOs(tecnicoId: string, dataInicio: string, dataFim: string) {
    return this.relatorio.getRelatorioOs(tecnicoId, dataInicio, dataFim);
  }

  async getRelatorioChamado(chamadoId: string) {
    return this.relatorio.getRelatorioChamado(chamadoId);
  }

  async getRelatorioProjeto(projetoId: string) {
    return this.relatorio.getRelatorioProjeto(projetoId);
  }

  getIndicadores(mes: number, ano: number, tiposParada?: string[], user?: JwtPayload, role?: string) {
    return this.indicadores.getIndicadores(mes, ano, tiposParada, user, role);
  }
}
