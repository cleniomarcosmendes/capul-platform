import { Controller, ForbiddenException, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { GestaoTiRole } from '../common/decorators/gestao-ti-role.decorator.js';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';
import { ROLES_GESTORES, ROLES_TI, getDeptosOndeStaff } from '../common/constants/roles.constant.js';
import { hasCapability } from '../common/helpers/capability.helper.js';
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
  // 29/05 — sem @Roles(...STAFF): o RolesGuard avalia a role PRINCIPAL do JWT,
  // que pra user multi-perfil pode ser USUARIO_CHAVE em T.I. mesmo ele sendo
  // GESTOR em outro depto. Check manual abaixo via getDeptosOndeStaff respeita
  // Workspace Multi-Depto (memory feedback_workspace_role_por_depto).
  getTecnicos(@CurrentUser() user: JwtPayload) {
    const isOversight = hasCapability(user, 'OVERSIGHT_PLATAFORMA');
    const deptosStaff = getDeptosOndeStaff(user);
    if (!isOversight && deptosStaff.length === 0) {
      throw new ForbiddenException(
        'Acesso restrito a ADMIN/GESTOR/SUPORTE de algum workspace.',
      );
    }
    // OVERSIGHT_PLATAFORMA: vê técnicos de toda a plataforma.
    if (isOversight) {
      return this.service.getTecnicosAtivos();
    }
    // SUPORTE em algum depto: técnicos das equipes onde é líder (mais restrito
    // que o filtro por depto — preservado da regra anterior).
    const isSuporte = (user.modulos ?? [])
      .find((m) => m.codigo === 'WORKSPACE')
      ?.departamentos?.some((d) => d.role === 'SUPORTE') ?? false;
    if (isSuporte && !(user.modulos ?? [])
      .find((m) => m.codigo === 'WORKSPACE')
      ?.departamentos?.some((d) => d.role === 'ADMIN' || d.role === 'GESTOR')) {
      return this.service.getTecnicosDaEquipe(user.sub);
    }
    // ADMIN/GESTOR sem oversight: restringe aos deptos onde é STAFF.
    return this.service.getTecnicosAtivos(deptosStaff);
  }

  @Get('acompanhamento-chamado')
  @Roles(...STAFF)
  getAcompanhamentoChamado(@Query('chamadoId') chamadoId: string) {
    return this.service.getAcompanhamentoChamado(chamadoId);
  }

  @Get('acompanhamento-chamado/equipes')
  // 29/05 — sem @Roles(...STAFF) pelo mesmo motivo do getTecnicos: roles guard
  // não respeita role per-depto (memory feedback_workspace_role_por_depto).
  listarEquipes(@CurrentUser() user: JwtPayload) {
    const isOversight = hasCapability(user, 'OVERSIGHT_PLATAFORMA');
    const deptosStaff = getDeptosOndeStaff(user);
    if (!isOversight && deptosStaff.length === 0) {
      throw new ForbiddenException(
        'Acesso restrito a ADMIN/GESTOR/SUPORTE de algum workspace.',
      );
    }
    // OVERSIGHT_PLATAFORMA: vê todas as equipes da plataforma.
    if (isOversight) {
      return this.service.listarEquipes();
    }
    // STAFF sem oversight: só equipes dos deptos onde é staff.
    return this.service.listarEquipes(deptosStaff);
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

  // Indicadores — Análise: investimento do mês agrupado (centro de custo, tipo
  // de produto, departamento). Total reconcilia com o KPI manchete.
  @Get('investimento-analitico')
  @Roles(...MANAGERS)
  getInvestimentoAnalitico(
    @Query('mes') mes: string,
    @Query('ano') ano: string,
    @CurrentUser() user?: JwtPayload,
    @GestaoTiRole() role?: string,
  ) {
    const m = parseInt(mes, 10) || new Date().getMonth() + 1;
    const a = parseInt(ano, 10) || new Date().getFullYear();
    return this.service.getInvestimentoAnalitico(m, a, user, role);
  }

  // Drill-down: documentos (NFs/parcelas) que compõem um grupo do analítico.
  @Get('investimento-analitico/documentos')
  @Roles(...MANAGERS)
  getInvestimentoDocumentos(
    @Query('mes') mes: string,
    @Query('ano') ano: string,
    @Query('dimensao') dimensao: 'centroCusto' | 'tipoProduto' | 'departamento',
    @Query('chave') chave: string,
    @CurrentUser() user?: JwtPayload,
    @GestaoTiRole() role?: string,
  ) {
    const m = parseInt(mes, 10) || new Date().getMonth() + 1;
    const a = parseInt(ano, 10) || new Date().getFullYear();
    return this.service.getInvestimentoDocumentos(m, a, dimensao, chave, user, role);
  }

  @Get('chamados-analitico')
  @Roles(...MANAGERS)
  getChamadosAnalitico(
    @Query('mes') mes: string, @Query('ano') ano: string,
    @CurrentUser() user?: JwtPayload, @GestaoTiRole() role?: string,
  ) {
    const m = parseInt(mes, 10) || new Date().getMonth() + 1;
    const a = parseInt(ano, 10) || new Date().getFullYear();
    return this.service.getChamadosAnalitico(m, a, user, role);
  }

  @Get('chamados-analitico/documentos')
  @Roles(...MANAGERS)
  getChamadosDocumentos(
    @Query('mes') mes: string, @Query('ano') ano: string,
    @Query('dimensao') dimensao: 'setor' | 'prioridade' | 'equipe',
    @Query('chave') chave: string,
    @CurrentUser() user?: JwtPayload, @GestaoTiRole() role?: string,
  ) {
    const m = parseInt(mes, 10) || new Date().getMonth() + 1;
    const a = parseInt(ano, 10) || new Date().getFullYear();
    return this.service.getChamadosDocumentos(m, a, dimensao, chave, user, role);
  }

  // ── Operacionais (Análise): Licenças / Disponibilidade / Horas Dev ──
  @Get('licencas-analitico')
  @Roles(...MANAGERS)
  getLicencasAnalitico(@CurrentUser() user?: JwtPayload, @GestaoTiRole() role?: string) {
    return this.service.getLicencasAnalitico(user, role);
  }
  @Get('licencas-analitico/documentos')
  @Roles(...MANAGERS)
  getLicencasDocumentos(@Query('dimensao') dimensao: 'fornecedor' | 'software' | 'categoria', @Query('chave') chave: string, @CurrentUser() user?: JwtPayload, @GestaoTiRole() role?: string) {
    return this.service.getLicencasDocumentos(dimensao, chave, user, role);
  }

  @Get('disponibilidade-analitico')
  @Roles(...MANAGERS)
  getDisponibilidadeAnalitico(@Query('mes') mes: string, @Query('ano') ano: string, @CurrentUser() user?: JwtPayload, @GestaoTiRole() role?: string) {
    const m = parseInt(mes, 10) || new Date().getMonth() + 1;
    const a = parseInt(ano, 10) || new Date().getFullYear();
    return this.service.getDisponibilidadeAnalitico(m, a, user, role);
  }
  @Get('disponibilidade-analitico/documentos')
  @Roles(...MANAGERS)
  getDisponibilidadeDocumentos(@Query('mes') mes: string, @Query('ano') ano: string, @Query('dimensao') dimensao: 'software' | 'tipo' | 'motivo', @Query('chave') chave: string, @CurrentUser() user?: JwtPayload, @GestaoTiRole() role?: string) {
    const m = parseInt(mes, 10) || new Date().getMonth() + 1;
    const a = parseInt(ano, 10) || new Date().getFullYear();
    return this.service.getDisponibilidadeDocumentos(m, a, dimensao, chave, user, role);
  }

  @Get('horas-dev-analitico')
  @Roles(...MANAGERS)
  getHorasDevAnalitico(@Query('mes') mes: string, @Query('ano') ano: string, @CurrentUser() user?: JwtPayload, @GestaoTiRole() role?: string) {
    const m = parseInt(mes, 10) || new Date().getMonth() + 1;
    const a = parseInt(ano, 10) || new Date().getFullYear();
    return this.service.getHorasDevAnalitico(m, a, user, role);
  }
  @Get('horas-dev-analitico/documentos')
  @Roles(...MANAGERS)
  getHorasDevDocumentos(@Query('mes') mes: string, @Query('ano') ano: string, @Query('dimensao') dimensao: 'projeto' | 'analista', @Query('chave') chave: string, @CurrentUser() user?: JwtPayload, @GestaoTiRole() role?: string) {
    const m = parseInt(mes, 10) || new Date().getMonth() + 1;
    const a = parseInt(ano, 10) || new Date().getFullYear();
    return this.service.getHorasDevDocumentos(m, a, dimensao, chave, user, role);
  }
}
