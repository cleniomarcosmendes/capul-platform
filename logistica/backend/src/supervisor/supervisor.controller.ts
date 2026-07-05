import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { SupervisorService } from './supervisor.service.js';
import type { ReciboBinario } from '../despesa/despesa.service.js';
import { AdicionarVisitaDto, ApontarVisitaDto, AtualizarAtividadeDto, AtualizarSupervisorDto, CriarAtividadeDto, CriarSupervisorDto, CriarViagemSupervisorDto, DecidirDespesaDto, DecidirPlanejamentoDto, EditarDespesaSupervisorDto, EditarViagemSupervisorDto, LancarAdiantamentoDto, LancarDespesaSupervisorDto } from './dto.js';

/** Converte o arquivo do multer no binário do comprovante (ou undefined). */
const reciboDe = (f?: Express.Multer.File): ReciboBinario | undefined =>
  f ? { buffer: f.buffer, mimetype: f.mimetype, size: f.size } : undefined;

// Leitura liberada aos operadores (escolhem atividade/região ao lançar a visita);
// escrita (cadastro dos catálogos) é do gestor. @Roles do método sobrepõe o da classe.
@Controller('supervisor')
@Roles('GESTOR_ENTREGA', 'GESTOR_FROTA', 'OPERADOR_ENTREGA', 'REGISTRADOR_FROTA', 'COORDENADOR', 'SUPERVISOR')
export class SupervisorController {
  constructor(private readonly svc: SupervisorService) {}

  // ---- Cadastro de Supervisor de Área + vínculo (Fase 6a) ----
  // Escrita: gestor / "supervisor de departamento" monta o time. Leitura liberada.
  @Get('supervisores')
  supervisores(@CurrentUser() user: JwtPayload, @Query('ativos') ativos?: string) {
    return this.svc.listarSupervisores(user, ativos === 'true');
  }
  @Post('supervisores')
  @Roles('GESTOR_ENTREGA', 'GESTOR_FROTA', 'SUPERVISOR')
  criarSupervisor(@Body() dto: CriarSupervisorDto, @CurrentUser() user: JwtPayload) {
    return this.svc.criarSupervisor(dto, user);
  }
  @Patch('supervisores/:id')
  @Roles('GESTOR_ENTREGA', 'GESTOR_FROTA', 'SUPERVISOR')
  atualizarSupervisor(@Param('id') id: string, @Body() dto: AtualizarSupervisorDto, @CurrentUser() user: JwtPayload) {
    return this.svc.atualizarSupervisor(id, dto, user);
  }

  // ---- Atividades ----
  @Get('atividades')
  atividades(@CurrentUser() user: JwtPayload, @Query('ativos') ativos?: string) {
    return this.svc.listarAtividades(user, ativos === 'true');
  }
  // Catálogo de tipos de despesa PRÓPRIO do fluxo Supervisores/RDV (herda o @Roles
  // da classe, que inclui COORDENADOR/SUPERVISOR) — desacopla do controller da frota.
  @Get('tipos-despesa')
  tiposDespesa(@Query('ativos') ativos?: string) {
    return this.svc.listarTiposDespesa(ativos !== 'false');
  }
  @Post('atividades')
  @Roles('GESTOR_ENTREGA', 'GESTOR_FROTA')
  criarAtividade(@Body() dto: CriarAtividadeDto, @CurrentUser() user: JwtPayload) {
    return this.svc.criarAtividade(dto, user);
  }
  @Patch('atividades/:id')
  @Roles('GESTOR_ENTREGA', 'GESTOR_FROTA')
  atualizarAtividade(@Param('id') id: string, @Body() dto: AtualizarAtividadeDto, @CurrentUser() user: JwtPayload) {
    return this.svc.atualizarAtividade(id, dto, user);
  }


  // ---- Viagem mensal do supervisor ----
  @Get('viagens')
  viagens(@CurrentUser() user: JwtPayload, @Query('mes') mes?: string, @Query('situacao') situacao?: string) {
    return this.svc.listarViagensSupervisor(user, mes ? Number(mes) : undefined, situacao);
  }
  @Get('viagens/:id')
  viagem(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.obterViagemSupervisor(id, user);
  }
  @Post('viagens')
  @Roles('GESTOR_ENTREGA', 'GESTOR_FROTA')
  criarViagem(@Body() dto: CriarViagemSupervisorDto, @CurrentUser() user: JwtPayload) {
    return this.svc.criarViagemSupervisor(dto, user);
  }
  @Patch('viagens/:id/concluir')
  @Roles('GESTOR_ENTREGA', 'GESTOR_FROTA')
  concluirViagem(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.concluirViagemSupervisor(id, user);
  }

  // ---- Workflow do planejamento (6b) ----
  @Patch('viagens/:id/enviar')
  enviarPlanejamento(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.enviarPlanejamento(id, user);
  }
  @Patch('viagens/:id/decidir')
  decidirPlanejamento(@Param('id') id: string, @Body() dto: DecidirPlanejamentoDto, @CurrentUser() user: JwtPayload) {
    return this.svc.decidirPlanejamento(id, dto.decisao, dto.comentario, user);
  }
  @Patch('viagens/:id/iniciar')
  iniciarExecucao(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.iniciarExecucao(id, user);
  }
  // Caixa de entrada do coordenador (planejamentos dos seus supervisores).
  @Get('coordenador/planejamentos')
  planejamentosCoordenador(@CurrentUser() user: JwtPayload, @Query('status') status?: string) {
    return this.svc.listarPlanejamentosCoordenador(user, status);
  }

  // ---- Adiantamentos (mensais, vários) + RDV mensal ----
  @Get('adiantamentos')
  adiantamentos(@CurrentUser() user: JwtPayload, @Query('supervisorId') supervisorId: string, @Query('mes') mes: string) {
    return this.svc.listarAdiantamentos(user, supervisorId, Number(mes));
  }
  @Post('adiantamentos')
  @Roles('GESTOR_ENTREGA', 'GESTOR_FROTA', 'COORDENADOR')
  lancarAdiantamento(@Body() dto: LancarAdiantamentoDto, @CurrentUser() user: JwtPayload) {
    return this.svc.lancarAdiantamento(dto, user);
  }
  @Delete('adiantamentos/:id')
  @Roles('GESTOR_ENTREGA', 'GESTOR_FROTA', 'COORDENADOR')
  removerAdiantamento(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.removerAdiantamento(id, user);
  }
  @Get('rdv-mensal')
  rdvMensal(@CurrentUser() user: JwtPayload, @Query('supervisorId') supervisorId: string, @Query('mes') mes: string) {
    return this.svc.rdvMensal(supervisorId, Number(mes), user);
  }

  // ---- Administração (Fase 5): correções do gestor ----
  @Patch('viagens/:id')
  @Roles('GESTOR_ENTREGA', 'GESTOR_FROTA')
  editarViagem(@Param('id') id: string, @Body() dto: EditarViagemSupervisorDto, @CurrentUser() user: JwtPayload) {
    return this.svc.editarViagem(id, dto, user);
  }
  @Patch('viagens/:id/reabrir')
  @Roles('GESTOR_ENTREGA', 'GESTOR_FROTA')
  reabrirViagem(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.reabrirViagem(id, user);
  }
  @Patch('viagens/:id/visitas/:paradaId')
  editarVisita(@Param('id') id: string, @Param('paradaId') paradaId: string, @Body() dto: AdicionarVisitaDto, @CurrentUser() user: JwtPayload) {
    return this.svc.editarVisita(id, paradaId, dto, user);
  }
  @Patch('viagens/:id/despesas/:despesaId')
  @UseInterceptors(FileInterceptor('comprovante', { limits: { fileSize: 15 * 1024 * 1024 } }))
  editarDespesa(@Param('id') id: string, @Param('despesaId') despesaId: string, @Body() dto: EditarDespesaSupervisorDto, @CurrentUser() user: JwtPayload, @UploadedFile() comprovante?: Express.Multer.File) {
    return this.svc.editarDespesa(id, despesaId, dto, user, reciboDe(comprovante));
  }

  // ---- Visitas da viagem (lançamento pelo operador/gestor) ----
  @Post('viagens/:id/visitas')
  adicionarVisita(@Param('id') id: string, @Body() dto: AdicionarVisitaDto, @CurrentUser() user: JwtPayload) {
    return this.svc.adicionarVisita(id, dto, user);
  }
  @Delete('viagens/:id/visitas/:paradaId')
  removerVisita(@Param('id') id: string, @Param('paradaId') paradaId: string, @CurrentUser() user: JwtPayload) {
    return this.svc.removerVisita(id, paradaId, user);
  }
  // Apontamento (6c): PLANEJADA → REALIZADA/PULADA
  @Patch('viagens/:id/visitas/:paradaId/apontar')
  apontarVisita(@Param('id') id: string, @Param('paradaId') paradaId: string, @Body() dto: ApontarVisitaDto, @CurrentUser() user: JwtPayload) {
    return this.svc.apontarVisita(id, paradaId, dto, user);
  }

  // ---- Despesas da viagem (compõem a RDV) ----
  // Comprovante (foto/PDF) opcional: multipart quando houver arquivo, JSON quando não.
  @Post('viagens/:id/despesas')
  @UseInterceptors(FileInterceptor('comprovante', { limits: { fileSize: 15 * 1024 * 1024 } }))
  lancarDespesa(@Param('id') id: string, @Body() dto: LancarDespesaSupervisorDto, @CurrentUser() user: JwtPayload, @UploadedFile() comprovante?: Express.Multer.File) {
    return this.svc.lancarDespesa(id, dto, user, reciboDe(comprovante));
  }
  @Delete('viagens/:id/despesas/:despesaId')
  removerDespesa(@Param('id') id: string, @Param('despesaId') despesaId: string, @CurrentUser() user: JwtPayload) {
    return this.svc.removerDespesa(id, despesaId, user);
  }
  // Download do comprovante (o coordenador vê antes de decidir).
  @Get('viagens/:id/despesas/:despesaId/comprovante')
  @Header('Cache-Control', 'private, no-store')
  async comprovanteDespesa(@Param('id') id: string, @Param('despesaId') despesaId: string, @CurrentUser() user: JwtPayload): Promise<StreamableFile> {
    const { buffer, mimeType } = await this.svc.obterReciboDespesa(id, despesaId, user);
    return new StreamableFile(buffer, { type: mimeType, disposition: `inline; filename="comprovante-${despesaId}"` });
  }
  // Decisão do coordenador sobre a despesa (6d): aprovar / rejeitar (contestar)
  @Patch('viagens/:id/despesas/:despesaId/decidir')
  decidirDespesa(@Param('id') id: string, @Param('despesaId') despesaId: string, @Body() dto: DecidirDespesaDto, @CurrentUser() user: JwtPayload) {
    return this.svc.decidirDespesa(id, despesaId, dto.decisao, dto.motivo, user);
  }

  // ---- RDV (Relatório de Despesas de Viagem) ----
  @Get('viagens/:id/rdv')
  rdv(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.rdv(id, user);
  }
}
