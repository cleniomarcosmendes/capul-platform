import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { StatusViagem } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { FrotaService } from './frota.service.js';
import { BuscarCondutorDto, ValidarCondutorDto, SaidaFrotaDto, SaidaIndividualDto, RetornoFrotaDto, AjusteGestorDto, AddParadaDto, RegistrarManutencaoDto, SaidaPortariaDto, PlanejarParadasDto, CheckinParadaDto, CriarLocalParadaDto, AtualizarLocalParadaDto } from './dto.js';

const roleLogistica = (user: JwtPayload) => user.modulos?.find((m) => m.codigo === 'LOGISTICA')?.role;

@Controller('frota')
@Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA')
export class FrotaController {
  constructor(private readonly frota: FrotaService) {}

  /** Passo 1 da saída: nome do condutor pela matrícula (antes da senha). */
  @Post('condutor')
  buscarCondutor(@Body() dto: BuscarCondutorDto) {
    return this.frota.buscarCondutor(dto.matricula);
  }

  /** Valida matrícula+senha — SEMPRE 200 com {valida, motivo} (nunca 401). */
  @Post('condutor/validar')
  validarCondutor(@Body() dto: ValidarCondutorDto) {
    return this.frota.validarCondutor(dto.matricula, dto.senha);
  }

  /** Registrar saída de veículo (PADRAO: condutor valida matrícula+senha). */
  @Post('viagens')
  saida(@Body() dto: SaidaFrotaDto, @CurrentUser() user: JwtPayload) {
    return this.frota.registrarSaida(dto, user);
  }

  /** Saída por usuário INDIVIDUAL (já autenticado): condutor = próprio usuário, sem senha. */
  @Post('viagens/individual')
  saidaIndividual(@Body() dto: SaidaIndividualDto, @CurrentUser() user: JwtPayload) {
    return this.frota.registrarSaidaIndividual(dto, user);
  }

  /** EXCEÇÃO da portaria: busca condutor por nome (Protheus infoPortal). Gestores. */
  @Get('condutores/busca')
  @Roles('GESTOR_ENTREGA', 'GESTOR_FROTA')
  buscarPorNome(@Query('nome') nome: string) {
    return this.frota.buscarCondutoresPorNome(nome ?? '');
  }

  /** EXCEÇÃO da portaria: aponta a saída ao condutor SEM senha. Gestores (auditável). */
  @Post('viagens/portaria')
  @Roles('GESTOR_ENTREGA', 'GESTOR_FROTA')
  saidaPortaria(@Body() dto: SaidaPortariaDto, @CurrentUser() user: JwtPayload) {
    return this.frota.registrarSaidaPortaria(dto, user);
  }

  /** Lista viagens de frota da filial (filtro de situação opcional). */
  @Get('viagens')
  listar(@CurrentUser() user: JwtPayload, @Query('situacao') situacao?: StatusViagem) {
    return this.frota.listar(user.filialId!, situacao);
  }

  /** Detalhe de uma viagem de frota (página de operações). */
  @Get('viagens/:id')
  obterViagem(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.frota.obterViagem(id, user.filialId!);
  }

  /** Despesas lançadas na viagem (lista da tela de detalhe). */
  @Get('viagens/:id/despesas')
  despesasDaViagem(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.frota.despesasDaViagem(id, user.filialId!);
  }

  /** Registrar retorno (só o próprio condutor). */
  @Post('viagens/:id/retorno')
  retorno(@Param('id') id: string, @Body() dto: RetornoFrotaDto, @CurrentUser() user: JwtPayload) {
    return this.frota.registrarRetorno(id, dto, user);
  }

  /** Ajuste/fechamento por gestor de frota ou supervisor do veículo. */
  @Patch('viagens/:id')
  ajustar(@Param('id') id: string, @Body() dto: AjusteGestorDto, @CurrentUser() user: JwtPayload) {
    return this.frota.ajustarPorGestor(id, dto, user, roleLogistica(user));
  }

  /** Registrar manutenção feita no veículo — reseta o alerta preventivo por KM. */
  @Post('veiculos/:id/manutencao')
  @Roles('GESTOR_ENTREGA', 'GESTOR_FROTA')
  registrarManutencao(@Param('id') id: string, @Body() dto: RegistrarManutencaoDto, @CurrentUser() user: JwtPayload) {
    return this.frota.registrarManutencao(id, dto, user, roleLogistica(user));
  }

  /** Painel tempo real da frota (monitoramento) — gestores. */
  @Get('painel')
  @Roles('GESTOR_ENTREGA', 'GESTOR_FROTA')
  painel(@CurrentUser() user: JwtPayload, @Query('mes') mes?: string, @Query('ano') ano?: string) {
    const agora = new Date();
    return this.frota.painelFrota(
      user, roleLogistica(user),
      mes ? parseInt(mes, 10) : agora.getUTCMonth() + 1,
      ano ? parseInt(ano, 10) : agora.getUTCFullYear(),
    );
  }

  /** Cadastro de locais/pontos de parada. Sem `scope` → todos (cadastro);
   *  com `scope=true` → só os relevantes p/ a saída (filial + veículo/depto/global). */
  @Get('locais')
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

  /** Paradas (pontos de rota / "caderno" da viagem). */
  @Get('viagens/:id/paradas')
  listarParadas(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.frota.listarParadas(id, user);
  }

  @Post('viagens/:id/paradas')
  adicionarParada(@Param('id') id: string, @Body() dto: AddParadaDto, @CurrentUser() user: JwtPayload) {
    return this.frota.adicionarParada(id, dto, user);
  }

  /** Planeja N paradas (visitas) — status PLANEJADA. */
  @Post('viagens/:id/paradas/planejar')
  planejarParadas(@Param('id') id: string, @Body() dto: PlanejarParadasDto, @CurrentUser() user: JwtPayload) {
    return this.frota.planejarParadas(id, dto, user);
  }

  /** Check-in numa parada planejada → REALIZADA (KM + GPS opcional). */
  @Patch('viagens/:id/paradas/:paradaId/checkin')
  checkinParada(@Param('id') id: string, @Param('paradaId') paradaId: string, @Body() dto: CheckinParadaDto, @CurrentUser() user: JwtPayload) {
    return this.frota.checkinParada(id, paradaId, dto, user);
  }

  /** Marca uma parada planejada como PULADA. */
  @Patch('viagens/:id/paradas/:paradaId/pular')
  pularParada(@Param('id') id: string, @Param('paradaId') paradaId: string, @CurrentUser() user: JwtPayload) {
    return this.frota.pularParada(id, paradaId, user);
  }

  @Delete('viagens/:id/paradas/:paradaId')
  removerParada(@Param('id') id: string, @Param('paradaId') paradaId: string, @CurrentUser() user: JwtPayload) {
    return this.frota.removerParada(id, paradaId, user);
  }
}
