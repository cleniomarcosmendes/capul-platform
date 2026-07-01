import { Body, Controller, Get, Param, Patch, Post, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { StatusEntrega } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { assertMesmaFilial, resolverFilialLeitura } from '../common/filial-scope.js';
import { EntregaService, type ProvaBinaria } from './entrega.service.js';
import { BaixarEntregaDto, CancelarEntregaDto, CreateEntregaDto, UpdateEntregaDto, ValidarOperadorDto } from './dto.js';

@Controller('entregas')
@Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA')
export class EntregaController {
  constructor(private readonly entregas: EntregaService) {}

  // REGISTRADOR_ENTREGA (caixa) entra aqui — só incluir/alterar. O @Roles do
  // método sobrepõe o da classe.
  @Post()
  @Roles('REGISTRADOR_ENTREGA', 'OPERADOR_ENTREGA', 'GESTOR_ENTREGA')
  criar(@Body() dto: CreateEntregaDto, @CurrentUser() user: JwtPayload) {
    assertMesmaFilial(user, dto.filialId);
    return this.entregas.create(dto, user);
  }

  /** Lista (default PENDENTE = fila de montagem). Filtros: filialId, status. */
  @Get()
  listar(@CurrentUser() user: JwtPayload, @Query('filialId') filialId?: string, @Query('status') status?: StatusEntrega) {
    return this.entregas.list({ filialId: resolverFilialLeitura(user, filialId), status });
  }

  /**
   * Busca de entregas baixadas p/ a consulta de comprovante (financeiro).
   * `termo` casa nome/telefone/matrícula; cupom e numero são filtros extras.
   * Declarado ANTES de :id pra não ser capturado pela rota param.
   */
  /** GRID (padrão workspace): todas as entregas com filtros; ordenação no cliente. */
  @Get('grid')
  grid(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: StatusEntrega,
    @Query('termo') termo?: string,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
    @Query('filialId') filialId?: string,
  ) {
    return this.entregas.grid({ filialId: resolverFilialLeitura(user, filialId), status, termo, de, ate });
  }

  @Get('baixadas')
  baixadas(
    @CurrentUser() user: JwtPayload,
    @Query('termo') termo?: string,
    @Query('cupom') cupom?: string,
    @Query('numero') numero?: string,
    @Query('filialId') filialId?: string,
  ) {
    return this.entregas.buscarBaixadas({
      termo,
      cupom,
      numero: numero ? Number(numero) : undefined,
      filialId: resolverFilialLeitura(user, filialId),
    });
  }

  @Get(':id')
  obter(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.entregas.findOne(id, user);
  }

  /** Edição (grid): só PENDENTE fora de viagem. REGISTRADOR_ENTREGA (caixa) inclui. */
  @Patch(':id')
  @Roles('REGISTRADOR_ENTREGA', 'OPERADOR_ENTREGA', 'GESTOR_ENTREGA')
  atualizar(@Param('id') id: string, @Body() dto: UpdateEntregaDto, @CurrentUser() user: JwtPayload) {
    return this.entregas.update(id, dto, user.filialId);
  }

  /** Identificação do operador (login PADRAO): matrícula+senha do portal RH.
   *  SEMPRE 200 {valida, motivo, nome} — o front cacheia a sessão. */
  @Post('operador/validar')
  @Roles('REGISTRADOR_ENTREGA', 'OPERADOR_ENTREGA', 'GESTOR_ENTREGA')
  validarOperador(@Body() dto: ValidarOperadorDto) {
    return this.entregas.validarOperador(dto.matricula, dto.senha);
  }

  /** Nova tentativa: NÃO ENTREGUE volta pra fila (PENDENTE) p/ nova viagem. */
  @Post(':id/nova-tentativa')
  novaTentativa(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.entregas.novaTentativa(id, user.filialId);
  }

  /** Cancelamento local (só PENDENTE). */
  @Post(':id/cancelar')
  cancelar(
    @Param('id') id: string,
    @Body() dto: CancelarEntregaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.entregas.cancelar(id, dto.motivo, user.sub, user.filialId);
  }

  /**
   * Baixa de entrega no campo (Fase 1b). multipart/form-data: campo `prova`
   * (foto/assinatura, opcional) + campos da baixa. A prova vai pro cofre
   * isolado. Quem dá baixa é o entregador (app) ou o operador (web).
   */
  @Post(':id/baixar')
  @Roles('ENTREGADOR', 'OPERADOR_ENTREGA', 'GESTOR_ENTREGA')
  // Aceita FOTO e ASSINATURA juntas (as duas são permitidas; ≥1 obrigatória no
  // service). `prova` é o campo LEGADO (fila offline gravada antes da mudança).
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'foto', maxCount: 1 },
    { name: 'assinatura', maxCount: 1 },
    { name: 'prova', maxCount: 1 },
  ], { limits: { fileSize: 15 * 1024 * 1024 } }))
  baixar(
    @Param('id') id: string,
    @Body() dto: BaixarEntregaDto,
    @CurrentUser() user: JwtPayload,
    @UploadedFiles() files?: { foto?: Express.Multer.File[]; assinatura?: Express.Multer.File[]; prova?: Express.Multer.File[] },
  ) {
    const toBin = (f?: Express.Multer.File): ProvaBinaria | undefined =>
      f ? { buffer: f.buffer, mimetype: f.mimetype, size: f.size } : undefined;
    const foto = toBin(files?.foto?.[0]);
    const assinatura = toBin(files?.assinatura?.[0]);
    // Legado: o campo `prova` + tipoProva do app antigo (fila offline).
    const legado = toBin(files?.prova?.[0]);
    return this.entregas.baixar(id, dto, {
      foto: foto ?? (legado && dto.tipoProva !== 'ASSINATURA' ? legado : undefined),
      assinatura: assinatura ?? (legado && dto.tipoProva === 'ASSINATURA' ? legado : undefined),
    }, user);
  }
}
