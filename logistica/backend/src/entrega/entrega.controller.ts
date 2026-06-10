import { Body, Controller, Get, Param, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StatusEntrega } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { assertMesmaFilial, resolverFilialLeitura } from '../common/filial-scope.js';
import { EntregaService, type ProvaBinaria } from './entrega.service.js';
import { BaixarEntregaDto, CancelarEntregaDto, CreateEntregaDto } from './dto.js';

@Controller('entregas')
@Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA')
export class EntregaController {
  constructor(private readonly entregas: EntregaService) {}

  @Post()
  criar(@Body() dto: CreateEntregaDto, @CurrentUser() user: JwtPayload) {
    assertMesmaFilial(user, dto.filialId);
    return this.entregas.create(dto, user.sub);
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
  @UseInterceptors(FileInterceptor('prova', { limits: { fileSize: 15 * 1024 * 1024 } }))
  baixar(
    @Param('id') id: string,
    @Body() dto: BaixarEntregaDto,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() prova?: Express.Multer.File,
  ) {
    const binario: ProvaBinaria | undefined = prova
      ? { buffer: prova.buffer, mimetype: prova.mimetype, size: prova.size }
      : undefined;
    return this.entregas.baixar(id, dto, binario, user);
  }
}
