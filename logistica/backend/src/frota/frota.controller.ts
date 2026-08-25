import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import { StatusViagem } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { rolesLogistica } from '../common/roles-logistica.js';
import { FrotaService } from './frota.service.js';
import { BuscarCondutorDto, ValidarCondutorDto, SaidaFrotaDto, SaidaIndividualDto, RetornoFrotaDto, RetornoPortariaDto, CancelarSaidaDto, AjusteGestorDto, AddParadaDto, RegistrarManutencaoDto, SaidaPortariaDto, PlanejarParadasDto, CheckinParadaDto, CriarLocalParadaDto, AtualizarLocalParadaDto, FILTROS_TIPO_VIAGEM, type FiltroTipoViagem, FILTROS_ESCOPO_VIAGEM, type FiltroEscopoViagem } from './dto.js';


@Controller('frota')
// REGISTRADOR_FROTA (login PADRÃO compartilhado) herda só os endpoints operacionais
// desta classe (saída/retorno/condutor/paradas). Os administrativos têm @Roles
// próprio SEM ele (getAllAndOverride substitui, não soma) → seguem bloqueados.
@Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA', 'REGISTRADOR_FROTA')
export class FrotaController {
  constructor(private readonly frota: FrotaService) {}

  /** Passo 1 da saída: nome do condutor pela matrícula (antes da senha). */
  @Post('condutor')
  buscarCondutor(@Body() dto: BuscarCondutorDto) {
    return this.frota.buscarCondutor(dto.matricula);
  }

  /** RDVs (planejamentos) candidatos p/ vincular à saída: do supervisor com essa
   *  matrícula, no mês, não concluídos. Alimenta o seletor do form de Saída (o 1º
   *  é o auto-match). */
  /** Prévia do acerto: departamento que responde pelas despesas + quem aprova.
   *  Alimenta o aviso da tela de Saída (inclusive "ninguém aprova este depto"). */
  @Get('previa-aprovacao')
  @Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA', 'REGISTRADOR_FROTA', 'PORTARIA', 'COORDENADOR', 'SUPERVISOR', 'SUPERVISOR_FROTA')
  previaAprovacao(
    @CurrentUser() user: JwtPayload,
    @Query('matricula') matricula?: string,
    @Query('departamentoId') departamentoId?: string,
  ) {
    return this.frota.previaAprovacao(user, matricula, departamentoId);
  }

  @Get('rdv-candidatos')
  @Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA', 'REGISTRADOR_FROTA', 'PORTARIA', 'COORDENADOR', 'SUPERVISOR', 'SUPERVISOR_FROTA')
  rdvCandidatos(@CurrentUser() user: JwtPayload, @Query('matricula') matricula?: string) {
    return this.frota.rdvCandidatosDoCondutor(user, matricula ?? '');
  }

  /** Valida matrícula+senha — SEMPRE 200 com {valida, motivo} (nunca 401). PORTARIA
   *  usa p/ validar o porteiro inline (mesma checagem do condutor). */
  @Post('condutor/validar')
  @Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA', 'REGISTRADOR_FROTA', 'PORTARIA', 'COORDENADOR', 'SUPERVISOR', 'SUPERVISOR_FROTA')
  validarCondutor(@Body() dto: ValidarCondutorDto) {
    return this.frota.validarCondutor(dto.matricula, dto.senha);
  }

  /** Gate do login PADRÃO: identifica o condutor da viagem (matrícula+senha) e
   *  devolve um token curto que libera operar a viagem. SEMPRE 200 {valida,...}. */
  @Post('viagens/:id/autenticar-condutor')
  autenticarCondutor(@Param('id') id: string, @Body() dto: ValidarCondutorDto, @CurrentUser() user: JwtPayload) {
    return this.frota.autenticarCondutor(id, dto.matricula, dto.senha, user);
  }

  /** Registrar saída de veículo (PADRAO: condutor valida matrícula+senha). */
  @Post('viagens')
  @Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA', 'REGISTRADOR_FROTA', 'SUPERVISOR_FROTA')
  saida(@Body() dto: SaidaFrotaDto, @CurrentUser() user: JwtPayload) {
    return this.frota.registrarSaida(dto, user);
  }

  /** Saída por usuário INDIVIDUAL (já autenticado): condutor = próprio usuário, sem
   *  senha. SUPERVISOR liberado p/ registrar a PRÓPRIA saída e vinculá-la ao RDV. */
  @Post('viagens/individual')
  @Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA', 'REGISTRADOR_FROTA', 'COORDENADOR', 'SUPERVISOR', 'SUPERVISOR_FROTA')
  saidaIndividual(@Body() dto: SaidaIndividualDto, @CurrentUser() user: JwtPayload) {
    return this.frota.registrarSaidaIndividual(dto, user);
  }

  /** EXCEÇÃO da portaria: busca condutor por nome (Protheus infoPortal). Gestores. */
  @Get('condutores/busca')
  @Roles('PORTARIA', 'GESTOR_ENTREGA', 'GESTOR_FROTA')
  buscarPorNome(@Query('nome') nome: string) {
    return this.frota.buscarCondutoresPorNome(nome ?? '');
  }

  /** Saída pela portaria: aponta ao condutor por NOME (sem senha do motorista); o
   *  porteiro identifica-se por matrícula+senha. Portaria + gestores (auditável). */
  @Post('viagens/portaria')
  @Roles('PORTARIA', 'GESTOR_ENTREGA', 'GESTOR_FROTA')
  saidaPortaria(@Body() dto: SaidaPortariaDto, @CurrentUser() user: JwtPayload) {
    return this.frota.registrarSaidaPortaria(dto, user);
  }

  /** Retorno pela portaria: encerra a rota (KM final) SEM a senha do motorista; o
   *  porteiro identifica-se por matrícula+senha. Portaria + gestores. */
  @Post('viagens/:id/retorno-portaria')
  @Roles('PORTARIA', 'GESTOR_ENTREGA', 'GESTOR_FROTA')
  retornoPortaria(@Param('id') id: string, @Body() dto: RetornoPortariaDto, @CurrentUser() user: JwtPayload) {
    return this.frota.registrarRetornoPortaria(id, dto, user);
  }

  /** Lista viagens da filial (filtros de situação e tipo opcionais). `tipo` aceita
   *  FROTA (default), ENTREGA ou TODAS — ver FiltroTipoViagem. */
  // PORTARIA precisa ler a lista/detalhe p/ o "Retorno pela portaria" (método
  // @Roles substitui o da classe — daí repetir os operacionais + PORTARIA).
  @Get('viagens')
  @Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA', 'REGISTRADOR_FROTA', 'PORTARIA', 'COORDENADOR', 'SUPERVISOR', 'SUPERVISOR_FROTA')
  listar(
    @CurrentUser() user: JwtPayload,
    @Query('situacao') situacao?: StatusViagem,
    @Query('tipo') tipo?: string,
    // `escopo=meus` é o que o APP manda: em campo cada um opera a SUA saída, e a
    // gestão (alterar/cancelar viagem de outro) é ato de DESKTOP. Sem o parâmetro
    // vale a listagem do desktop, onde gestor/ADMIN veem a frota inteira.
    @Query('escopo') escopo?: string,
  ) {
    // Validação EXPLÍCITA: um valor fora da lista chegaria ao service como chave
    // inexistente de TipoViagem (undefined), o filtro de tipo sumiria do where e a
    // lista passaria a incluir as viagens SUPERVISOR (RDV) — que não são saídas de
    // veículo. Rejeitar é mais seguro que cair no default em silêncio.
    if (tipo !== undefined && !(FILTROS_TIPO_VIAGEM as readonly string[]).includes(tipo)) {
      throw new BadRequestException(`tipo inválido: use ${FILTROS_TIPO_VIAGEM.join(', ')}.`);
    }
    // Mesmo tratamento do `tipo`: valor fora da lista não pode virar "sem escopo"
    // em silêncio — um `escopo=meu` (typo) devolveria a frota inteira ao app.
    if (escopo !== undefined && !(FILTROS_ESCOPO_VIAGEM as readonly string[]).includes(escopo)) {
      throw new BadRequestException(`escopo inválido: use ${FILTROS_ESCOPO_VIAGEM.join(', ')}.`);
    }
    return this.frota.listar(user, situacao, tipo as FiltroTipoViagem | undefined, escopo as FiltroEscopoViagem | undefined);
  }

  /** Detalhe de uma viagem de frota (página de operações). */
  @Get('viagens/:id')
  @Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA', 'REGISTRADOR_FROTA', 'PORTARIA', 'COORDENADOR', 'SUPERVISOR', 'SUPERVISOR_FROTA')
  obterViagem(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.frota.obterViagem(id, user);
  }

  /** Despesas lançadas na viagem (lista da tela de detalhe). PORTARIA lê p/ abrir
   *  o detalhe no "Retorno pela portaria". */
  @Get('viagens/:id/despesas')
  @Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA', 'REGISTRADOR_FROTA', 'PORTARIA', 'COORDENADOR', 'SUPERVISOR', 'SUPERVISOR_FROTA')
  despesasDaViagem(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.frota.despesasDaViagem(id, user);
  }

  /** Acerto da viagem (despesas × adiantamento → saldo) — folha imprimível. */
  @Get('viagens/:id/acerto')
  @Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA', 'REGISTRADOR_FROTA', 'PORTARIA', 'COORDENADOR', 'SUPERVISOR', 'SUPERVISOR_FROTA')
  acerto(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.frota.acertoViagem(id, user);
  }

  /** Registrar retorno (só o próprio condutor). SUPERVISOR fecha a sua saída. */
  @Post('viagens/:id/retorno')
  @Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA', 'REGISTRADOR_FROTA', 'COORDENADOR', 'SUPERVISOR', 'SUPERVISOR_FROTA')
  retorno(@Param('id') id: string, @Body() dto: RetornoFrotaDto, @CurrentUser() user: JwtPayload, @Headers('x-condutor-token') condutorToken?: string) {
    return this.frota.registrarRetorno(id, dto, user, condutorToken);
  }

  /** Cancelar saída registrada errada (EM_CURSO → CANCELADA, libera o veículo). Gestor. */
  @Patch('viagens/:id/cancelar')
  @Roles('GESTOR_FROTA', 'GESTOR_ENTREGA', 'ADMIN')
  cancelarSaida(@Param('id') id: string, @Body() dto: CancelarSaidaDto, @CurrentUser() user: JwtPayload) {
    return this.frota.cancelarSaida(id, dto, user);
  }

  /** Ajuste/fechamento por gestor de frota, supervisor do veículo ou Supervisor de Departamento. */
  @Patch('viagens/:id')
  @Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA', 'REGISTRADOR_FROTA', 'SUPERVISOR_FROTA')
  ajustar(
    @Param('id') id: string,
    @Body() dto: AjusteGestorDto,
    @CurrentUser() user: JwtPayload,
    @Headers('x-condutor-token') condutorToken?: string,
  ) {
    return this.frota.ajustarPorGestor(id, dto, user, rolesLogistica(user), condutorToken);
  }

  /** Encerrar / reabrir o ACERTO da viagem — trava despesa+adiantamento, INDEPENDENTE
   *  da conclusão (o veículo já foi liberado ao entregar). Gestor/dono (serviço). */
  @Post('viagens/:id/encerrar-acerto')
  @Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA', 'REGISTRADOR_FROTA', 'COORDENADOR', 'SUPERVISOR', 'SUPERVISOR_FROTA')
  encerrarAcerto(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.frota.encerrarAcerto(id, user, rolesLogistica(user));
  }
  @Post('viagens/:id/reabrir-acerto')
  @Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA', 'REGISTRADOR_FROTA', 'COORDENADOR', 'SUPERVISOR', 'SUPERVISOR_FROTA')
  reabrirAcerto(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.frota.reabrirAcerto(id, user, rolesLogistica(user));
  }

  /** Registrar manutenção (preventiva do ciclo ou corretiva/excepcional). */
  @Post('veiculos/:id/manutencao')
  @Roles('GESTOR_ENTREGA', 'GESTOR_FROTA')
  registrarManutencao(@Param('id') id: string, @Body() dto: RegistrarManutencaoDto, @CurrentUser() user: JwtPayload) {
    return this.frota.registrarManutencao(id, dto, user, rolesLogistica(user));
  }

  /** Histórico de manutenções do veículo. */
  @Get('veiculos/:id/manutencoes')
  @Roles('GESTOR_ENTREGA', 'GESTOR_FROTA')
  listarManutencoes(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.frota.listarManutencoes(id, user);
  }

  /** Linha do KM (hodômetro) da frota no mês: uma linha por veículo (ou de um só). Página /frota/linha-km. */
  @Get('hodometro')
  // Relatório de gestão — fora do REGISTRADOR_FROTA (mantém os papéis originais da classe).
  @Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA', 'SUPERVISOR_FROTA')
  hodometro(@CurrentUser() user: JwtPayload, @Query('mes') mes?: string, @Query('ano') ano?: string, @Query('veiculoId') veiculoId?: string, @Query('departamentoId') departamentoId?: string) {
    return this.frota.hodometroFrota(user, mes ? parseInt(mes, 10) : undefined, ano ? parseInt(ano, 10) : undefined, veiculoId || undefined, departamentoId || undefined);
  }

  /** Painel tempo real da frota (monitoramento) — gestores + Supervisor de Departamento
   *  (escopado) + Operador de Entrega (atende o cliente que liga perguntando da entrega:
   *  precisa ver as rotas na rua). Valor de custo é omitido para quem não pode ver. */
  @Get('painel')
  @Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA', 'SUPERVISOR_FROTA')
  painel(@CurrentUser() user: JwtPayload, @Query('mes') mes?: string, @Query('ano') ano?: string) {
    const agora = new Date();
    return this.frota.painelFrota(
      user, rolesLogistica(user),
      mes ? parseInt(mes, 10) : agora.getUTCMonth() + 1,
      ano ? parseInt(ano, 10) : agora.getUTCFullYear(),
    );
  }

  /** Departamentos p/ o filtro da Análise/Custos — escopado ao Supervisor de Departamento. */
  @Get('departamentos-filtro')
  @Roles('GESTOR_ENTREGA', 'GESTOR_FROTA', 'SUPERVISOR_FROTA')
  departamentosFiltro(@CurrentUser() user: JwtPayload) {
    return this.frota.departamentosDoFiltro(user);
  }

  /** Cadastro de locais/pontos de parada. Sem `scope` → todos (cadastro);
   *  com `scope=true` → só os relevantes p/ a saída (filial + veículo/depto/global). */
  @Get('locais')
  @Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA', 'REGISTRADOR_FROTA', 'PORTARIA', 'COORDENADOR', 'SUPERVISOR', 'SUPERVISOR_FROTA')
  listarLocais(
    @Query('ativos') ativos?: string,
    @Query('scope') scope?: string,
    @Query('filialId') filialId?: string,
    @Query('veiculoId') veiculoId?: string,
    @Query('departamentoId') departamentoId?: string,
  ) {
    return this.frota.listarLocais({
      somenteAtivos: ativos === 'true' || ativos === '1',
      scope: scope === 'true' || scope === '1',
      filialId, veiculoId, departamentoId,
    });
  }

  @Post('locais')
  @Roles('GESTOR_FROTA')
  criarLocal(@Body() dto: CriarLocalParadaDto) {
    return this.frota.criarLocal(dto);
  }

  @Patch('locais/:id')
  @Roles('GESTOR_FROTA')
  atualizarLocal(@Param('id') id: string, @Body() dto: AtualizarLocalParadaDto) {
    return this.frota.atualizarLocal(id, dto);
  }

  /** Paradas (pontos de rota / "caderno" da viagem). PORTARIA lê p/ abrir o detalhe. */
  @Get('viagens/:id/paradas')
  @Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA', 'REGISTRADOR_FROTA', 'PORTARIA', 'COORDENADOR', 'SUPERVISOR', 'SUPERVISOR_FROTA')
  listarParadas(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.frota.listarParadas(id, user);
  }

  // Operações de parada em campo: o condutor pode ser de vários perfis (inclusive
  // SUPERVISOR/SUPERVISOR_FROTA quando ele mesmo registra a saída). O @Roles só
  // libera o módulo; QUEM opera a viagem é barrado por identidade em assertOpera
  // (quem registrou a saída / supervisor do veículo / gestão da frota / condutor token).
  @Post('viagens/:id/paradas')
  @Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA', 'REGISTRADOR_FROTA', 'PORTARIA', 'COORDENADOR', 'SUPERVISOR', 'SUPERVISOR_FROTA')
  adicionarParada(@Param('id') id: string, @Body() dto: AddParadaDto, @CurrentUser() user: JwtPayload, @Headers('x-condutor-token') condutorToken?: string) {
    return this.frota.adicionarParada(id, dto, user, condutorToken);
  }

  /** Planeja N paradas (visitas) — status PLANEJADA. */
  @Post('viagens/:id/paradas/planejar')
  @Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA', 'REGISTRADOR_FROTA', 'PORTARIA', 'COORDENADOR', 'SUPERVISOR', 'SUPERVISOR_FROTA')
  planejarParadas(@Param('id') id: string, @Body() dto: PlanejarParadasDto, @CurrentUser() user: JwtPayload, @Headers('x-condutor-token') condutorToken?: string) {
    return this.frota.planejarParadas(id, dto, user, condutorToken);
  }

  /** Check-in numa parada planejada → REALIZADA (KM + GPS opcional). */
  @Patch('viagens/:id/paradas/:paradaId/checkin')
  @Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA', 'REGISTRADOR_FROTA', 'PORTARIA', 'COORDENADOR', 'SUPERVISOR', 'SUPERVISOR_FROTA')
  checkinParada(@Param('id') id: string, @Param('paradaId') paradaId: string, @Body() dto: CheckinParadaDto, @CurrentUser() user: JwtPayload, @Headers('x-condutor-token') condutorToken?: string) {
    return this.frota.checkinParada(id, paradaId, dto, user, condutorToken);
  }

  /** Marca uma parada planejada como PULADA. */
  @Patch('viagens/:id/paradas/:paradaId/pular')
  @Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA', 'REGISTRADOR_FROTA', 'PORTARIA', 'COORDENADOR', 'SUPERVISOR', 'SUPERVISOR_FROTA')
  pularParada(@Param('id') id: string, @Param('paradaId') paradaId: string, @CurrentUser() user: JwtPayload, @Headers('x-condutor-token') condutorToken?: string) {
    return this.frota.pularParada(id, paradaId, user, condutorToken);
  }

  @Delete('viagens/:id/paradas/:paradaId')
  @Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA', 'REGISTRADOR_FROTA', 'PORTARIA', 'COORDENADOR', 'SUPERVISOR', 'SUPERVISOR_FROTA')
  removerParada(@Param('id') id: string, @Param('paradaId') paradaId: string, @CurrentUser() user: JwtPayload, @Headers('x-condutor-token') condutorToken?: string) {
    return this.frota.removerParada(id, paradaId, user, condutorToken);
  }
}
