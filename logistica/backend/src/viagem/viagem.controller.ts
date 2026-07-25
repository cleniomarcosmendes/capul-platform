import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { StatusViagem } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { assertMesmaFilial, resolverFilialLeitura } from '../common/filial-scope.js';
import { ViagemService } from './viagem.service.js';
import { RotaService } from '../rota/rota.service.js';
import { AdicionarEntregasDto, ConcluirViagemDto, CorrigirLocalDto, CreateViagemDto, DespacharViagemDto, ForcarEncerramentoDto, IniciarViagemDto, ReordenarViagemDto, ReverterLocalDto, SugerirOrdemDto, UpdateViagemDto } from './dto.js';

@Controller('viagens')
@Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA')
export class ViagemController {
  constructor(
    private readonly viagens: ViagemService,
    private readonly rota: RotaService,
  ) {}

  @Post()
  criar(@Body() dto: CreateViagemDto, @CurrentUser() user: JwtPayload) {
    assertMesmaFilial(user, dto.filialId);
    return this.viagens.create(dto, user.sub);
  }

  /**
   * Sugere a MELHOR ORDEM das entregas selecionadas (Fase 1c): geocodifica e
   * ordena por distância a partir da filial (nearest-neighbor + 2-opt).
   * Sugestão — o operador revisa; sem coordenada vai pro fim da lista.
   */
  @Post('sugerir-ordem')
  sugerirOrdem(@Body() dto: SugerirOrdemDto, @CurrentUser() user: JwtPayload) {
    assertMesmaFilial(user, dto.filialId);
    return this.rota.sugerirOrdem(dto.filialId, dto.entregaIds);
  }

  /**
   * Corrige à mão a coordenada de UMA parada (o operador arrastou o pin no mapa
   * da montagem). Vale para as próximas entregas no mesmo endereço — é o que
   * conserta na raiz o endereço que o provedor só resolve por município.
   */
  @Post('corrigir-local')
  corrigirLocal(@Body() dto: CorrigirLocalDto, @CurrentUser() user: JwtPayload) {
    assertMesmaFilial(user, dto.filialId);
    return this.rota.corrigirLocal(dto.filialId, dto.entregaId, dto.lat, dto.lng, user.sub);
  }

  /** Desfaz a correção manual (arraste errado não pode ficar grudado). */
  @Post('reverter-local')
  reverterLocal(@Body() dto: ReverterLocalDto, @CurrentUser() user: JwtPayload) {
    assertMesmaFilial(user, dto.filialId);
    return this.rota.reverterLocal(dto.filialId, dto.entregaId);
  }

  @Get()
  listar(
    @CurrentUser() user: JwtPayload,
    @Query('filialId') filialId?: string,
    @Query('situacao') situacao?: StatusViagem,
    @Query('veiculoId') veiculoId?: string,
  ) {
    return this.viagens.list({ filialId: resolverFilialLeitura(user, filialId), situacao, veiculoId });
  }

  // Viagens do próprio entregador (app — Fase 1b). DEVE vir antes de @Get(':id')
  // senão o Nest casa "minhas" como :id. Sem situacao → só acionáveis.
  // ENTREGADOR (role do app) é liberado aqui — o @Roles do método sobrepõe o da classe.
  @Get('minhas')
  @Roles('ENTREGADOR', 'OPERADOR_ENTREGA', 'GESTOR_ENTREGA')
  minhas(@CurrentUser() user: JwtPayload, @Query('situacao') situacao?: StatusViagem) {
    return this.viagens.listMinhas(user.sub, situacao);
  }

  // Detalhe da viagem — o app do entregador precisa pra montar a rota/paradas.
  @Get(':id')
  @Roles('ENTREGADOR', 'OPERADOR_ENTREGA', 'GESTOR_ENTREGA')
  obter(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.viagens.findOne(id, user);
  }

  /** Edição do RASCUNHO: define/troca veículo e motorista (12/06). */
  @Patch(':id')
  atualizar(@Param('id') id: string, @Body() dto: UpdateViagemDto, @CurrentUser() user: JwtPayload) {
    return this.viagens.atualizar(id, dto, user.filialId);
  }

  /** Adiciona entregas PENDENTES ao fim da rota do rascunho (12/06). */
  @Post(':id/entregas')
  adicionarEntregas(@Param('id') id: string, @Body() dto: AdicionarEntregasDto, @CurrentUser() user: JwtPayload) {
    return this.viagens.adicionarEntregas(id, dto.entregaIds, user.filialId);
  }

  /** Re-sequencia as paradas do rascunho (setas/Sugerir ordem no detalhe). */
  @Patch(':id/ordem')
  reordenar(@Param('id') id: string, @Body() dto: ReordenarViagemDto, @CurrentUser() user: JwtPayload) {
    return this.viagens.reordenar(id, dto.entregaIds, user.filialId);
  }

  @Post(':id/despachar')
  despachar(@Param('id') id: string, @Body() dto: DespacharViagemDto, @CurrentUser() user: JwtPayload) {
    return this.viagens.despachar(id, dto, user.filialId);
  }

  /** "Iniciar entrega" (app): o entregador registra o KM de saída na hora. */
  @Post(':id/iniciar')
  @Roles('ENTREGADOR', 'OPERADOR_ENTREGA', 'GESTOR_ENTREGA')
  iniciar(@Param('id') id: string, @Body() dto: IniciarViagemDto, @CurrentUser() user: JwtPayload) {
    return this.viagens.iniciar(id, dto, user.filialId);
  }

  /** "Encerrar entrega" (app) / Concluir (balcão): registra o KM de chegada e
   *  fecha a rota (libera o veículo + atualiza o odômetro). ENTREGADOR liberado. */
  @Post(':id/concluir')
  @Roles('ENTREGADOR', 'OPERADOR_ENTREGA', 'GESTOR_ENTREGA')
  concluir(@Param('id') id: string, @Body() dto: ConcluirViagemDto, @CurrentUser() user: JwtPayload) {
    return this.viagens.concluir(id, user.filialId, user.sub, dto);
  }

  /** Encerramento FORÇADO pelo gestor de entrega (rota pendurada): KM final
   *  obrigatório + auditoria. Só GESTOR_ENTREGA (e ADMIN via guard). */
  @Post(':id/forcar-encerramento')
  @Roles('GESTOR_ENTREGA')
  forcarEncerramento(@Param('id') id: string, @Body() dto: ForcarEncerramentoDto, @CurrentUser() user: JwtPayload) {
    return this.viagens.forcarEncerramento(id, dto, user.filialId, user.sub);
  }

  @Delete(':id/entregas/:entregaId')
  removerEntrega(@Param('id') id: string, @Param('entregaId') entregaId: string, @CurrentUser() user: JwtPayload) {
    return this.viagens.removerEntrega(id, entregaId, user.filialId);
  }

  @Delete(':id')
  descartar(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.viagens.descartar(id, user.filialId);
  }
}
