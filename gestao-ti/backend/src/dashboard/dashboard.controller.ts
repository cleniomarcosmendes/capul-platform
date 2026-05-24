import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { GestaoTiRole } from '../common/decorators/gestao-ti-role.decorator.js';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';
import { ROLES_GESTORES, ROLES_TI } from '../common/constants/roles.constant.js';
import { RequiresFuncionalidade } from '../common/decorators/requires-funcionalidade.decorator.js';

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
    @CurrentUser() user?: JwtPayload,
    @GestaoTiRole() role?: string,
  ) {
    return this.service.getResumo({ dataInicio, dataFim, departamentoId }, user, role);
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
    @CurrentUser() user?: JwtPayload,
    @GestaoTiRole() role?: string,
  ) {
    return this.service.getDisponibilidade({ dataInicio, dataFim, softwareId, filialId }, user, role);
  }

  @Get('financeiro')
  @Roles(...STAFF)
  getFinanceiro(
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @CurrentUser() user?: JwtPayload,
    @GestaoTiRole() role?: string,
  ) {
    return this.service.getFinanceiro({ dataInicio, dataFim }, user, role);
  }

  @Get('ordens-servico')
  @Roles(...MANAGERS)
  getOrdensServico(
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('filialId') filialId?: string,
    @CurrentUser() user?: JwtPayload,
    @GestaoTiRole() role?: string,
  ) {
    return this.service.getOrdensServico({ dataInicio, dataFim, filialId }, user, role);
  }

  @Get('csat')
  @Roles(...MANAGERS)
  getCsat(
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('departamentoId') departamentoId?: string,
    @CurrentUser() user?: JwtPayload,
    @GestaoTiRole() role?: string,
  ) {
    return this.service.getCsat({ dataInicio, dataFim, departamentoId }, user, role);
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
  getTecnicos(@CurrentUser() user: JwtPayload) {
    // SUPORTE_TI: retorna apenas tecnicos das equipes onde e lider
    const role = user.modulos?.find((m: { codigo: string; role: string }) => m.codigo === 'WORKSPACE')?.role;
    if (role === 'SUPORTE') {
      return this.service.getTecnicosDaEquipe(user.sub);
    }
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
    @CurrentUser() user?: JwtPayload,
    @GestaoTiRole() role?: string,
  ) {
    return this.service.buscarChamados({ q, status, prioridade, equipeId, tecnicoId, dataInicio, dataFim }, user, role);
  }

  @Get('acompanhamento-atividade')
  @Roles(...STAFF)
  getAcompanhamentoAtividade(
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
    @Query('atividadeId') atividadeId: string,
  ) {
    return this.service.getAcompanhamentoAtividade(user, role, atividadeId);
  }

  @Get('acompanhamento-atividade/buscar')
  @Roles(...STAFF)
  buscarAtividades(
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
    @Query('q') q?: string,
    @Query('projetoId') projetoId?: string,
    @Query('status') status?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('responsavelId') responsavelId?: string,
    @Query('faseId') faseId?: string,
  ) {
    return this.service.buscarAtividades(user, role, q, projetoId, status, dataInicio, dataFim, responsavelId, faseId);
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

  // ─── Painel de Gestão (25/05) ──────────────────────────────────
  // Foco: itens com prazo onde o user tem vínculo formal. Distinto
  // de Dashboard (agregação), Monitor (real-time), Acompanhamento
  // (produtividade), Indicadores (KPIs mensais).

  @Get('painel-chamados')
  @RequiresFuncionalidade('PAINEL_GESTAO_CHAMADO')
  getPainelChamados(
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
    @Query('equipeId') equipeId?: string,
  ) {
    return this.service.getPainelChamados(user, role, equipeId);
  }

  @Get('painel-projetos')
  @RequiresFuncionalidade('PAINEL_GESTAO_PROJETO')
  getPainelProjetos(
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.getPainelProjetos(user, role);
  }

  @Get('relatorio-os')
  @Roles(...STAFF)
  async getRelatorioOs(
    @Query('tecnicoId') tecnicoId: string,
    @Query('dataInicio') dataInicio: string,
    @Query('dataFim') dataFim: string,
    @CurrentUser() user: JwtPayload,
  ) {
    // Gestores e líderes de equipe (SUPORTE_TI) podem ver relatórios de outros técnicos
    const role = user.modulos?.find((m: { codigo: string; role: string }) => m.codigo === 'WORKSPACE')?.role;
    const isManager = MANAGERS.some((r) => r === role);
    const isSuporte = role === 'SUPORTE';

    if (!isManager && !isSuporte) {
      // Tecnico comum: so ve o proprio
      return this.service.getRelatorioOs(user.sub, dataInicio, dataFim);
    }

    if (isSuporte && tecnicoId && tecnicoId !== user.sub) {
      // SUPORTE_TI: validar que o tecnico e da sua equipe
      const permitidos = await this.service.getTecnicosDaEquipe(user.sub);
      if (!permitidos.some((t) => t.id === tecnicoId)) {
        return this.service.getRelatorioOs(user.sub, dataInicio, dataFim);
      }
    }

    const userId = (isManager || isSuporte) ? tecnicoId : user.sub;
    return this.service.getRelatorioOs(userId, dataInicio, dataFim);
  }

  @Get('relatorio-chamado')
  @Roles(...STAFF)
  getRelatorioChamado(@Query('chamadoId') chamadoId: string) {
    return this.service.getRelatorioChamado(chamadoId);
  }

  @Get('relatorio-projeto')
  @Roles(...STAFF)
  getRelatorioProjeto(@Query('projetoId') projetoId: string) {
    return this.service.getRelatorioProjeto(projetoId);
  }

  @Get('indicadores-estrategicos')
  @Roles(...MANAGERS)
  getIndicadores(
    @Query('mes') mes: string,
    @Query('ano') ano: string,
    @Query('tiposParada') tiposParada?: string,
    @CurrentUser() user?: JwtPayload,
    @GestaoTiRole() role?: string,
  ) {
    const m = parseInt(mes, 10) || new Date().getMonth() + 1;
    const a = parseInt(ano, 10) || new Date().getFullYear();
    const tipos = tiposParada ? tiposParada.split(',') : undefined;
    return this.service.getIndicadores(m, a, tipos, user, role);
  }
}
