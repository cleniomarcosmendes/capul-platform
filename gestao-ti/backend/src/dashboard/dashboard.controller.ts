import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';
import { ROLES_GESTORES, ROLES_TI } from '../common/constants/roles.constant.js';

const STAFF = [...ROLES_TI];
const MANAGERS = [...ROLES_GESTORES];

@Controller('dashboard')
@UseGuards(JwtAuthGuard, GestaoTiGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get()
  @Roles(...STAFF)
  getResumo(
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('departamentoId') departamentoId?: string,
  ) {
    return this.service.getResumo({ dataInicio, dataFim, departamentoId });
  }

  @Get('executivo')
  @Roles(...MANAGERS)
  getExecutivo(
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
  ) {
    return this.service.getExecutivo({ dataInicio, dataFim });
  }

  @Get('disponibilidade')
  @Roles(...STAFF)
  getDisponibilidade(
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('softwareId') softwareId?: string,
    @Query('filialId') filialId?: string,
  ) {
    return this.service.getDisponibilidade({ dataInicio, dataFim, softwareId, filialId });
  }

  @Get('financeiro')
  @Roles(...STAFF)
  getFinanceiro(
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
  ) {
    return this.service.getFinanceiro({ dataInicio, dataFim });
  }

  @Get('ordens-servico')
  @Roles(...MANAGERS)
  getOrdensServico(
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('filialId') filialId?: string,
  ) {
    return this.service.getOrdensServico({ dataInicio, dataFim, filialId });
  }

  @Get('csat')
  @Roles(...MANAGERS)
  getCsat(
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('departamentoId') departamentoId?: string,
  ) {
    return this.service.getCsat({ dataInicio, dataFim, departamentoId });
  }

  @Get('acompanhamento')
  @Roles(...STAFF)
  getAcompanhamento(
    @Query('usuarioId') usuarioId?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('tzOffset') tzOffset?: string,
  ) {
    return this.service.getAcompanhamento({ usuarioId, dataInicio, dataFim, tzOffset: tzOffset ? parseInt(tzOffset, 10) : 0 });
  }

  @Get('acompanhamento/tecnicos')
  @Roles(...STAFF)
  getTecnicos() {
    return this.service.getTecnicosAtivos();
  }

  @Get('acompanhamento-chamado')
  @Roles(...STAFF)
  getAcompanhamentoChamado(@Query('chamadoId') chamadoId: string) {
    return this.service.getAcompanhamentoChamado(chamadoId);
  }

  @Get('acompanhamento-chamado/equipes')
  @Roles(...STAFF)
  listarEquipes() {
    return this.service.listarEquipes();
  }

  @Get('acompanhamento-chamado/buscar')
  @Roles(...STAFF)
  buscarChamados(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('prioridade') prioridade?: string,
    @Query('equipeId') equipeId?: string,
    @Query('tecnicoId') tecnicoId?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
  ) {
    return this.service.buscarChamados({ q, status, prioridade, equipeId, tecnicoId, dataInicio, dataFim });
  }

  @Get('acompanhamento-atividade')
  @Roles(...STAFF)
  getAcompanhamentoAtividade(@Query('atividadeId') atividadeId: string) {
    return this.service.getAcompanhamentoAtividade(atividadeId);
  }

  @Get('acompanhamento-atividade/buscar')
  @Roles(...STAFF)
  buscarAtividades(
    @Query('q') q?: string,
    @Query('projetoId') projetoId?: string,
    @Query('status') status?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('responsavelId') responsavelId?: string,
    @Query('faseId') faseId?: string,
  ) {
    return this.service.buscarAtividades(q, projetoId, status, dataInicio, dataFim, responsavelId, faseId);
  }

  @Get('acompanhamento-atividade/projetos')
  @Roles(...STAFF)
  listarProjetosAtivos() {
    return this.service.listarProjetosAtivos();
  }

  @Get('acompanhamento-atividade/fases')
  @Roles(...STAFF)
  listarFasesAtivas() {
    return this.service.listarFasesAtivas();
  }

  @Get('minhas-pendencias')
  getMinhasPendencias(@CurrentUser() user: JwtPayload) {
    return this.service.getMinhasPendencias(user.sub);
  }

  @Get('relatorio-os')
  @Roles(...STAFF)
  getRelatorioOs(
    @Query('tecnicoId') tecnicoId: string,
    @Query('dataInicio') dataInicio: string,
    @Query('dataFim') dataFim: string,
    @CurrentUser() user: JwtPayload,
  ) {
    // Não-gestores só podem ver o próprio relatório
    const isManager = MANAGERS.some((r) => user.modulos?.some((m: { codigo: string; role: string }) => m.codigo === 'GESTAO_TI' && r === m.role));
    const userId = isManager ? tecnicoId : user.sub;
    return this.service.getRelatorioOs(userId, dataInicio, dataFim);
  }

  @Get('indicadores-estrategicos')
  @Roles(...MANAGERS)
  getIndicadores(
    @Query('mes') mes: string,
    @Query('ano') ano: string,
    @Query('tiposParada') tiposParada?: string,
  ) {
    const m = parseInt(mes, 10) || new Date().getMonth() + 1;
    const a = parseInt(ano, 10) || new Date().getFullYear();
    const tipos = tiposParada ? tiposParada.split(',') : undefined;
    return this.service.getIndicadores(m, a, tipos);
  }
}
