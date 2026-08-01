import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Put, Query, StreamableFile, UploadedFile, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { AnyFilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { SupervisorService } from './supervisor.service.js';
import type { ReciboBinario } from '../despesa/despesa.service.js';
import { AdicionarVisitaDto, ApontarVisitaDto, AtualizarAtividadeDto, AtualizarSupervisorDto, CancelarPlanejamentoDto, CriarAtividadeDto, CriarSupervisorDto, CriarViagemSupervisorDto, DecidirAdiantamentoDto, DecidirDespesaDto, DecidirPlanejamentoDto, DefinirSupervisorDepartamentoDto, DefinirVeiculoPlanejamentoDto, DevolverPlanejamentoDto, EditarDespesaSupervisorDto, EditarViagemSupervisorDto, LancarAdiantamentoDto, LancarDespesaSupervisorDto } from './dto.js';

/** Converte o arquivo do multer no binário do comprovante (ou undefined). */
const reciboDe = (f?: Express.Multer.File): ReciboBinario | undefined =>
  f ? { buffer: f.buffer, mimetype: f.mimetype, size: f.size } : undefined;
/** Vários arquivos (multer) → binários. AnyFiles pega qualquer nome de campo
 *  ('comprovante' legado OU 'comprovantes[]' novo) — retrocompatível. */
const recibosDe = (fs?: Express.Multer.File[]): ReciboBinario[] =>
  (fs ?? []).map((f) => ({ buffer: f.buffer, mimetype: f.mimetype, size: f.size }));

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
  supervisores(@CurrentUser() user: JwtPayload, @Query('ativos') ativos?: string, @Query('filialId') filialId?: string) {
    return this.svc.listarSupervisores(user, ativos === 'true', filialId);
  }
  // Escrita do cadastro ("montar o time" — inclui gravar `coordenadorId`, que define quem
  // aprova a prestação de contas): SÓ o Supervisor de Departamento (nos SEUS departamentos)
  // e ADMIN. O papel SUPERVISOR é o SUPERVISIONADO — não escreve aqui (senão se apontaria
  // como coordenador e aprovaria as próprias despesas). O self-service do RDV só LÊ isto.
  @Post('supervisores')
  @Roles('SUPERVISOR_FROTA')
  criarSupervisor(@Body() dto: CriarSupervisorDto, @CurrentUser() user: JwtPayload, @Query('filialId') filialId?: string) {
    return this.svc.criarSupervisor(dto, user, filialId);
  }
  @Patch('supervisores/:id')
  @Roles('SUPERVISOR_FROTA')
  atualizarSupervisor(@Param('id') id: string, @Body() dto: AtualizarSupervisorDto, @CurrentUser() user: JwtPayload, @Query('filialId') filialId?: string) {
    return this.svc.atualizarSupervisor(id, dto, user, filialId);
  }

  // ---- Quem responde por cada departamento no RDV (aba Equipe) ----
  // Leitura: quem já vê a aba. ESCRITA: só ADMIN (checado no serviço) — esta tabela é a
  // FONTE da autoridade do SUPERVISOR_FROTA; se ele a editasse, se acrescentaria em
  // qualquer departamento e aprovaria a prestação de contas de quem quisesse.
  @Get('departamentos-responsavel')
  supervisoresDepartamento(@CurrentUser() user: JwtPayload, @Query('filialId') filialId?: string) {
    return this.svc.listarSupervisoresDepartamento(user, filialId);
  }
  /** Filiais que já têm RDV montado — o ADMIN abre a aba já numa delas (a matriz, filial
   *  principal dele, costuma não ter representante e a tela abriria vazia). */
  @Get('filiais-rdv')
  filiaisComRdv(@CurrentUser() user: JwtPayload) {
    return this.svc.filiaisComRdv(user);
  }
  /** Departamentos DA FILIAL — seletor do "adicionar departamento" da amarração. */
  @Get('departamentos-filial')
  departamentosDaFilial(@CurrentUser() user: JwtPayload, @Query('filialId') filialId?: string) {
    return this.svc.departamentosDaFilial(user, filialId);
  }
  @Put('departamentos-responsavel/:departamentoId')
  definirSupervisorDepartamento(@Param('departamentoId') departamentoId: string, @Body() dto: DefinirSupervisorDepartamentoDto, @CurrentUser() user: JwtPayload, @Query('filialId') filialId?: string) {
    return this.svc.definirSupervisorDepartamento(departamentoId, dto.usuarioId, user, filialId);
  }
  @Delete('departamentos-responsavel/:departamentoId')
  removerSupervisorDepartamento(@Param('departamentoId') departamentoId: string, @CurrentUser() user: JwtPayload, @Query('filialId') filialId?: string) {
    return this.svc.removerSupervisorDepartamento(departamentoId, user, filialId);
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
  // `escopo=meus` é o que o APP manda: em campo cada um executa o SEU RDV. Sem o
  // parâmetro vale a listagem do desktop, que inclui o time (o aprovador monta e
  // ajusta o planejamento do subordinado).
  @Get('viagens')
  viagens(@CurrentUser() user: JwtPayload, @Query('mes') mes?: string, @Query('situacao') situacao?: string, @Query('escopo') escopo?: string) {
    return this.svc.listarViagensSupervisor(user, mes ? Number(mes) : undefined, situacao, escopo);
  }
  @Get('viagens/:id')
  viagem(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.obterViagemSupervisor(id, user);
  }
  @Post('viagens')
  @Roles('SUPERVISOR', 'COORDENADOR', 'SUPERVISOR_FROTA')
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
  // Veículo do planejamento — dado de PLANEJAMENTO (o aprovador também mexe, mesmo
  // escopo de incluir/alterar item do roteiro), não de execução.
  @Patch('viagens/:id/veiculo')
  @Roles('SUPERVISOR', 'COORDENADOR', 'SUPERVISOR_FROTA')
  definirVeiculoPlanejamento(@Param('id') id: string, @Body() dto: DefinirVeiculoPlanejamentoDto, @CurrentUser() user: JwtPayload) {
    return this.svc.definirVeiculoPlanejamento(id, dto.veiculoId ?? null, user);
  }

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
  /** Força maior DEPOIS do aval: Ajustar/Rejeitar só valem no ENVIADO. Mesma
   *  autoridade que decide (coordenador do representante / Supervisor de Departamento). */
  @Patch('viagens/:id/cancelar')
  @Roles('COORDENADOR', 'SUPERVISOR_FROTA')
  cancelarPlanejamento(@Param('id') id: string, @Body() dto: CancelarPlanejamentoDto, @CurrentUser() user: JwtPayload) {
    return this.svc.cancelarPlanejamento(id, dto.motivo, user);
  }
  /** Meio-termo entre seguir e cancelar: devolve o aprovado/em execução para o
   *  representante reconfigurar e reenviar (volta a AJUSTADO). */
  @Patch('viagens/:id/devolver')
  @Roles('COORDENADOR', 'SUPERVISOR_FROTA')
  devolverPlanejamento(@Param('id') id: string, @Body() dto: DevolverPlanejamentoDto, @CurrentUser() user: JwtPayload) {
    return this.svc.devolverPlanejamento(id, dto.comentario, user);
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
  // Lançar/remover adiantamento: só quem APROVA o representante (coordenador ou
  // supervisor de departamento). O auto-serviço do supervisor de área saiu do app em
  // 27/07 e do desktop em 01/08 — ninguém lança o próprio adiantamento. Ele continua
  // LENDO os seus (o @Roles da classe cobre o GET). Encerrar o mês (fechar/reabrir)
  // também não é do supervisionado.
  @Get('adiantamentos')
  adiantamentos(@CurrentUser() user: JwtPayload, @Query('supervisorId') supervisorId: string, @Query('mes') mes: string) {
    return this.svc.listarAdiantamentos(user, supervisorId, Number(mes));
  }
  @Post('adiantamentos')
  @Roles('COORDENADOR', 'SUPERVISOR_FROTA')
  lancarAdiantamento(@Body() dto: LancarAdiantamentoDto, @CurrentUser() user: JwtPayload) {
    return this.svc.lancarAdiantamento(dto, user);
  }
  @Delete('adiantamentos/:id')
  @Roles('COORDENADOR', 'SUPERVISOR_FROTA')
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
  // COORDENADOR entrou em 01/08 (varredura): ele decide, cancela, devolve e reabre o
  // planejamento do time, mas não editava este campo — mesma lacuna que o `reabrir`
  // tinha, no método vizinho. O escopo segue no serviço (`assertEscopoSupervisor`).
  @Patch('viagens/:id')
  @Roles('COORDENADOR', 'SUPERVISOR_FROTA')
  editarViagem(@Param('id') id: string, @Body() dto: EditarViagemSupervisorDto, @CurrentUser() user: JwtPayload) {
    return this.svc.editarViagem(id, dto, user);
  }
  // Reabrir UM planejamento concluído (para corrigir/lançar o que faltou). O
  // COORDENADOR entrou em 01/08: ele já reabria o MÊS INTEIRO do time
  // (`rdv-mensal/reabrir`), que é o poder maior, mas tomava "Perfil insuficiente" num
  // planejamento só — inconsistência, não decisão. O escopo continua no serviço
  // (`assertEscopoSupervisor`): ele alcança só quem ele coordena.
  @Patch('viagens/:id/reabrir')
  @Roles('COORDENADOR', 'SUPERVISOR_FROTA')
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
  @UseInterceptors(AnyFilesInterceptor({ limits: { fileSize: 15 * 1024 * 1024, files: 5 } }))
  lancarDespesa(@Param('id') id: string, @Body() dto: LancarDespesaSupervisorDto, @CurrentUser() user: JwtPayload, @UploadedFiles() comprovantes?: Express.Multer.File[]) {
    return this.svc.lancarDespesa(id, dto, user, recibosDe(comprovantes));
  }
  @Delete('viagens/:id/despesas/:despesaId')
  removerDespesa(@Param('id') id: string, @Param('despesaId') despesaId: string, @CurrentUser() user: JwtPayload) {
    return this.svc.removerDespesa(id, despesaId, user);
  }
  // Download do comprovante LEGADO (1 anexo, campo antigo) — o coordenador vê antes de decidir.
  @Get('viagens/:id/despesas/:despesaId/comprovante')
  @Header('Cache-Control', 'private, no-store')
  async comprovanteDespesa(@Param('id') id: string, @Param('despesaId') despesaId: string, @CurrentUser() user: JwtPayload): Promise<StreamableFile> {
    const { buffer, mimeType } = await this.svc.obterReciboDespesa(id, despesaId, user);
    return new StreamableFile(buffer, { type: mimeType, disposition: `inline; filename="comprovante-${despesaId}"` });
  }
  // Download de um anexo (novo — vários por despesa).
  @Get('viagens/:id/despesas/:despesaId/anexos/:anexoId')
  @Header('Cache-Control', 'private, no-store')
  async anexoDespesa(@Param('id') id: string, @Param('despesaId') despesaId: string, @Param('anexoId') anexoId: string, @CurrentUser() user: JwtPayload): Promise<StreamableFile> {
    const { buffer, mimeType } = await this.svc.obterAnexoDespesa(id, despesaId, anexoId, user);
    return new StreamableFile(buffer, { type: mimeType, disposition: `inline; filename="anexo-${anexoId}"` });
  }
  @Delete('viagens/:id/despesas/:despesaId/anexos/:anexoId')
  removerAnexoDespesa(@Param('id') id: string, @Param('despesaId') despesaId: string, @Param('anexoId') anexoId: string, @CurrentUser() user: JwtPayload) {
    return this.svc.removerAnexoDespesa(id, despesaId, anexoId, user);
  }
  // Decisão sobre a despesa (6d): aprovar / contestar. Quem decide é quem NÃO lançou
  // (serviço) — no caminho normal a autoridade aprova o que o representante lançou;
  // na exceção (autoridade lançou no RDV de outro) quem CONFERE é o representante,
  // porque a despesa entra na conta dele. Por isso SUPERVISOR entra no @Roles: ele
  // segue sem poder decidir o que ele mesmo lançou.
  @Patch('viagens/:id/despesas/:despesaId/decidir')
  @Roles('COORDENADOR', 'SUPERVISOR_FROTA', 'SUPERVISOR')
  decidirDespesa(@Param('id') id: string, @Param('despesaId') despesaId: string, @Body() dto: DecidirDespesaDto, @CurrentUser() user: JwtPayload) {
    return this.svc.decidirDespesa(id, despesaId, dto.decisao, dto.motivo, user);
  }

  // ---- RDV (Relatório de Despesas de Viagem) ----
  @Get('viagens/:id/rdv')
  rdv(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.rdv(id, user);
  }
}
