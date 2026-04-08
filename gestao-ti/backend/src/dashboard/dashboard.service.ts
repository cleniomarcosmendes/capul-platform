import { Injectable } from '@nestjs/common';
import { DashboardResumoService } from './services/dashboard-resumo.service.js';
import { DashboardOperacionalService } from './services/dashboard-operacional.service.js';
import { DashboardFinanceiroService } from './services/dashboard-financeiro.service.js';
import { DashboardAcompanhamentoService } from './services/dashboard-acompanhamento.service.js';
import { DashboardIndicadoresService } from './services/dashboard-indicadores.service.js';

@Injectable()
export class DashboardService {
  constructor(
    private readonly resumo: DashboardResumoService,
    private readonly operacional: DashboardOperacionalService,
    private readonly financeiro: DashboardFinanceiroService,
    private readonly acompanhamento: DashboardAcompanhamentoService,
    private readonly indicadores: DashboardIndicadoresService,
  ) {}

  async getResumo(filters?: { dataInicio?: string; dataFim?: string; departamentoId?: string }) {
    return this.resumo.getResumo(filters);
  }

  async getExecutivo(filters?: { dataInicio?: string; dataFim?: string }) {
    return this.resumo.getExecutivo(filters);
  }

  async getDisponibilidade(filters: {
    dataInicio?: string;
    dataFim?: string;
    softwareId?: string;
    filialId?: string;
  }) {
    return this.operacional.getDisponibilidade(filters);
  }

  async getOrdensServico(filters?: { dataInicio?: string; dataFim?: string; filialId?: string }) {
    return this.operacional.getOrdensServico(filters);
  }

  async getTecnicosAtivos() {
    return this.operacional.getTecnicosAtivos();
  }

  async getFinanceiro(filters?: { dataInicio?: string; dataFim?: string }) {
    return this.financeiro.getFinanceiro(filters);
  }

  async getCsat(filters?: { dataInicio?: string; dataFim?: string; departamentoId?: string }) {
    return this.financeiro.getCsat(filters);
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

  async buscarChamados(filters: { q?: string; status?: string; prioridade?: string; equipeId?: string; tecnicoId?: string; dataInicio?: string; dataFim?: string }) {
    return this.acompanhamento.buscarChamados(filters);
  }

  async getAcompanhamentoChamado(chamadoId: string) {
    return this.acompanhamento.getAcompanhamentoChamado(chamadoId);
  }

  async listarProjetosAtivos() {
    return this.acompanhamento.listarProjetosAtivos();
  }

  async buscarAtividades(q?: string, projetoId?: string, status?: string, dataInicio?: string, dataFim?: string, responsavelId?: string, faseId?: string) {
    return this.acompanhamento.buscarAtividades(q, projetoId, status, dataInicio, dataFim, responsavelId, faseId);
  }

  async listarFasesAtivas() {
    return this.acompanhamento.listarFasesAtivas();
  }

  async getAcompanhamentoAtividade(atividadeId: string) {
    return this.acompanhamento.getAcompanhamentoAtividade(atividadeId);
  }

  async getMinhasPendencias(userId: string) {
    return this.acompanhamento.getMinhasPendencias(userId);
  }

  async getRelatorioOs(tecnicoId: string, dataInicio: string, dataFim: string) {
    return this.acompanhamento.getRelatorioOs(tecnicoId, dataInicio, dataFim);
  }

  getIndicadores(mes: number, ano: number, tiposParada?: string[]) {
    return this.indicadores.getIndicadores(mes, ano, tiposParada);
  }
}
