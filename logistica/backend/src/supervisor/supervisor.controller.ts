import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { SupervisorService } from './supervisor.service.js';
import type { ReciboBinario } from '../despesa/despesa.service.js';
import { AdicionarVisitaDto, ApontarVisitaDto, AtualizarAtividadeDto, AtualizarSupervisorDto, CriarAtividadeDto, CriarSupervisorDto, CriarViagemSupervisorDto, DecidirAdiantamentoDto, DecidirDespesaDto, DecidirPlanejamentoDto, EditarDespesaSupervisorDto, EditarViagemSupervisorDto, LancarAdiantamentoDto, LancarDespesaSupervisorDto } from './dto.js';

/** Converte o arquivo do multer no binário do comprovante (ou undefined). */
const reciboDe = (f?: Express.Multer.File): ReciboBinario | undefined =>
  f ? { buffer: f.buffer, mimetype: f.mimetype, size: f.size } : undefined;

// RDV/Supervisores é processo INTERNO do setor: quem administra é o SUPERVISOR_FROTA
// ("Supervisor de Departamento", escopado aos SEUS departamentos no serviço) e o
// COORDENADOR (só o seu time). Os GESTORES (entrega/frota) NÃO participam — frota é
// veículo, não processo interno. ADMIN passa sempre (guard). @Roles do método sobrepõe
// o da classe.
@Controller('supervisor')
@Roles('OPERADOR_ENTREGA', 'REGISTRADOR_FROTA', 'COORDENADOR', 'SUPERVISOR', 'SUPERVISOR_FROTA')
export class SupervisorController {
  constructor(private readonly svc: SupervisorService) {}

  // ---- Cadastro de Supervisor de Área + vínculo (Fase 6a) ----
  @Get('supervisores')
  supervisores(@CurrentUser() user: JwtPayload, @Query('ativos') ativos?: string) {
    return this.svc.listarSupervisores(user, ativos === 'true');
  }
  // Escrita do cadastro ("montar o time" — inclui gravar `coordenadorId`, que define quem
  // aprova a prestação de contas): SÓ o Supervisor de Departamento (nos SEUS departamentos)
  // e ADMIN. O papel SUPERVISOR é o SUPERVISIONADO — não escreve aqui (senão se apontaria
  // como coordenador e aprovaria as próprias despesas). O self-service do RDV só LÊ isto.
  @Post('supervisores')
  @Roles('SUPERVISOR_FROTA')
  criarSupervisor(@Body() dto: CriarSupervisorDto, @CurrentUser() user: JwtPayload) {
    return this.svc.criarSupervisor(dto, user);
  }
  @Patch('supervisores/:id')
  @Roles('SUPERVISOR_FROTA')
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
  @Roles('SUPERVISOR_FROTA')
  criarAtividade(@Body() dto: CriarAtividadeDto, @CurrentUser() user: JwtPayload) {
    return this.svc.criarAtividade(dto, user);
  }
  @Patch('atividades/:id')
  @Roles('SUPERVISOR_FROTA')
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
  @Roles('SUPERVISOR', 'SUPERVISOR_FROTA')
  criarViagem(@Body() dto: CriarViagemSupervisorDto, @CurrentUser() user: JwtPayload) {
    return this.svc.criarViagemSupervisor(dto, user);
  }
  // Concluir o RDV: o próprio SUPERVISOR (fecha o seu), o COORDENADOR e o Supervisor de
  // Departamento — mesmos atores do workflow (enviar/decidir/iniciar). O escopo (filial +
  // departamento/coordenação) é aplicado no serviço.
  @Patch('viagens/:id/concluir')
  @Roles('SUPERVISOR', 'COORDENADOR', 'SUPERVISOR_FROTA')
  concluirViagem(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.concluirViagemSupervisor(id, user);
  }

  // ---- Workflow do planejamento (6b) ----
  // Atores: o SUPERVISOR dono envia/inicia o seu; o COORDENADOR e o Supervisor de
  // Departamento decidem (cada um no seu escopo). Operador/registrador NÃO participam da
  // aprovação. Decidir nunca é do supervisionado (ele não decide o próprio).
  @Patch('viagens/:id/enviar')
  @Roles('SUPERVISOR', 'COORDENADOR', 'SUPERVISOR_FROTA')
  enviarPlanejamento(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.enviarPlanejamento(id, user);
  }
  @Patch('viagens/:id/decidir')
  @Roles('COORDENADOR', 'SUPERVISOR_FROTA')
  decidirPlanejamento(@Param('id') id: string, @Body() dto: DecidirPlanejamentoDto, @CurrentUser() user: JwtPayload) {
    return this.svc.decidirPlanejamento(id, dto.decisao, dto.comentario, user);
  }
  @Patch('viagens/:id/iniciar')
  @Roles('SUPERVISOR', 'COORDENADOR', 'SUPERVISOR_FROTA')
  iniciarExecucao(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.iniciarExecucao(id, user);
  }
  // Caixa de entrada do coordenador (planejamentos dos seus supervisores).
  @Get('coordenador/planejamentos')
  planejamentosCoordenador(@CurrentUser() user: JwtPayload, @Query('status') status?: string) {
    return this.svc.listarPlanejamentosCoordenador(user, status);
  }

  // ---- Adiantamentos (mensais, vários) + RDV mensal ----
  // Lançar/remover: o COORDENADOR, o Supervisor de Departamento e o próprio SUPERVISOR de
  // área (auto-serviço, só no SEU cadastro — escopo aplicado no serviço). Encerrar o mês
  // (fechar/reabrir) NÃO é do supervisionado — segue coordenador/departamento.
  @Get('adiantamentos')
  adiantamentos(@CurrentUser() user: JwtPayload, @Query('supervisorId') supervisorId: string, @Query('mes') mes: string) {
    return this.svc.listarAdiantamentos(user, supervisorId, Number(mes));
  }
  @Post('adiantamentos')
  @Roles('COORDENADOR', 'SUPERVISOR', 'SUPERVISOR_FROTA')
  lancarAdiantamento(@Body() dto: LancarAdiantamentoDto, @CurrentUser() user: JwtPayload) {
    return this.svc.lancarAdiantamento(dto, user);
  }
  @Delete('adiantamentos/:id')
  @Roles('COORDENADOR', 'SUPERVISOR', 'SUPERVISOR_FROTA')
  removerAdiantamento(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.removerAdiantamento(id, user);
  }
  /** Coordenador / Supervisor de Departamento aprova/rejeita o adiantamento PENDENTE
   *  (auto-serviço do supervisor de área). O supervisionado não decide o próprio. */
  @Patch('adiantamentos/:id/decidir')
  @Roles('COORDENADOR', 'SUPERVISOR_FROTA')
  decidirAdiantamento(@Param('id') id: string, @Body() dto: DecidirAdiantamentoDto, @CurrentUser() user: JwtPayload) {
    return this.svc.decidirAdiantamento(id, dto.decisao, dto.motivo, user);
  }
  /** Cadastro do supervisor de área LOGADO (auto-serviço) — o front fixa o "meu"
   *  supervisorId no Fechamento sem seletor. null se ainda não montado no time. */
  @Get('meu-cadastro')
  meuCadastro(@CurrentUser() user: JwtPayload) {
    return this.svc.meuCadastroSupervisor(user);
  }
  @Get('rdv-mensal')
  rdvMensal(@CurrentUser() user: JwtPayload, @Query('supervisorId') supervisorId: string, @Query('mes') mes: string) {
    return this.svc.rdvMensal(supervisorId, Number(mes), user);
  }

  /** Encerra o RDV do mês (trava despesas/adiantamentos/visitas). Coordenador/Supervisor de Departamento. */
  @Post('rdv-mensal/fechar')
  @Roles('COORDENADOR', 'SUPERVISOR_FROTA')
  fecharRdv(@CurrentUser() user: JwtPayload, @Body() dto: { supervisorId: string; mesReferencia: number }) {
    return this.svc.fecharRdv(dto.supervisorId, Number(dto.mesReferencia), user);
  }

  /** Reabre o RDV do mês (libera lançamentos). Coordenador/Supervisor de Departamento. */
  @Post('rdv-mensal/reabrir')
  @Roles('COORDENADOR', 'SUPERVISOR_FROTA')
  reabrirRdv(@CurrentUser() user: JwtPayload, @Body() dto: { supervisorId: string; mesReferencia: number }) {
    return this.svc.reabrirRdv(dto.supervisorId, Number(dto.mesReferencia), user);
  }

  // ---- Administração (Fase 5): correções do Supervisor de Departamento / ADMIN ----
  @Patch('viagens/:id')
  @Roles('SUPERVISOR_FROTA')
  editarViagem(@Param('id') id: string, @Body() dto: EditarViagemSupervisorDto, @CurrentUser() user: JwtPayload) {
    return this.svc.editarViagem(id, dto, user);
  }
  @Patch('viagens/:id/reabrir')
  @Roles('SUPERVISOR_FROTA')
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
  // Decisão do coordenador sobre a despesa (6d): aprovar / rejeitar (contestar).
  // Só coordenador/gestor — o supervisionado nunca aprova a própria despesa.
  @Patch('viagens/:id/despesas/:despesaId/decidir')
  @Roles('COORDENADOR', 'SUPERVISOR_FROTA')
  decidirDespesa(@Param('id') id: string, @Param('despesaId') despesaId: string, @Body() dto: DecidirDespesaDto, @CurrentUser() user: JwtPayload) {
    return this.svc.decidirDespesa(id, despesaId, dto.decisao, dto.motivo, user);
  }

  // ---- RDV (Relatório de Despesas de Viagem) ----
  @Get('viagens/:id/rdv')
  rdv(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.rdv(id, user);
  }
}
