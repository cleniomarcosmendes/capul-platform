import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  UseFilters,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as express from 'express';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { ParadaService } from './parada.service';
import { ParadaAnexoService } from './parada-anexo.service';
import { UploadEaccesFilter } from './filters/upload-eacces.filter';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { CreateParadaDto } from './dto/create-parada.dto';
import { UpdateParadaDto } from './dto/update-parada.dto';
import { FinalizarParadaDto } from './dto/finalizar-parada.dto';
import { CreateMotivoParadaDto } from './dto/create-motivo-parada.dto';
import { UpdateMotivoParadaDto } from './dto/update-motivo-parada.dto';

// Whitelist de MIME types aceitos em upload — sem application/octet-stream
// (permitiria upload de qualquer binario, inclusive executaveis renomeados).
const ALLOWED_MIMES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
  'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
];

@Controller('paradas')
@UseGuards(JwtAuthGuard, GestaoTiGuard, RolesGuard)
export class ParadaController {
  constructor(
    private readonly service: ParadaService,
    private readonly anexoService: ParadaAnexoService,
  ) {}

  // === Motivos de Parada ===

  @Get('motivos')
  findAllMotivos() {
    return this.service.findAllMotivos();
  }

  @Post('motivos')
  @Roles('ADMIN', 'GESTOR_TI')
  createMotivo(@Body() dto: CreateMotivoParadaDto) {
    return this.service.createMotivo(dto);
  }

  @Patch('motivos/:motivoId')
  @Roles('ADMIN', 'GESTOR_TI')
  updateMotivo(@Param('motivoId') id: string, @Body() dto: UpdateMotivoParadaDto) {
    return this.service.updateMotivo(id, dto);
  }

  @Delete('motivos/:motivoId')
  @Roles('ADMIN', 'GESTOR_TI')
  removeMotivo(@Param('motivoId') id: string) {
    return this.service.removeMotivo(id);
  }

  // === Paradas ===

  @Get()
  findAll(
    @Query('softwareId') softwareId?: string,
    @Query('moduloId') moduloId?: string,
    @Query('filialId') filialId?: string,
    @Query('tipo') tipo?: string,
    @Query('impacto') impacto?: string,
    @Query('status') status?: string,
    @Query('motivoParadaId') motivoParadaId?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.findAll({
      softwareId,
      moduloId,
      filialId,
      tipo,
      impacto,
      status,
      motivoParadaId,
      dataInicio,
      dataFim,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  create(@Body() dto: CreateParadaDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }

  @Patch(':id')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  update(@Param('id') id: string, @Body() dto: UpdateParadaDto, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, dto, user.sub);
  }

  @Post(':id/finalizar')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  finalizar(
    @Param('id') id: string,
    @Body() dto: FinalizarParadaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.finalizar(id, dto, user.sub);
  }

  @Post(':id/cancelar')
  @Roles('ADMIN', 'GESTOR_TI')
  cancelar(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.cancelar(id, user.sub);
  }

  /**
   * Reabre parada FINALIZADA → EM_ANDAMENTO. Apenas ADMIN/GESTOR_TI —
   * não cabe ao operador comum. CANCELADA não reabre (terminal).
   */
  @Post(':id/reabrir')
  @Roles('ADMIN', 'GESTOR_TI')
  reabrir(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.reabrir(id, user.sub);
  }

  @Post(':id/chamados')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  vincularChamado(
    @Param('id') id: string,
    @Body() body: { chamadoId: string },
  ) {
    return this.service.vincularChamado(id, body.chamadoId);
  }

  @Delete(':id/chamados/:chamadoId')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  desvincularChamado(
    @Param('id') id: string,
    @Param('chamadoId') chamadoId: string,
  ) {
    return this.service.desvincularChamado(id, chamadoId);
  }

  @Get(':id/colaboradores')
  listarColaboradores(@Param('id') id: string) {
    return this.service.listarColaboradores(id);
  }

  @Post(':id/colaboradores')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  adicionarColaborador(
    @Param('id') id: string,
    @Body('usuarioId') usuarioId: string,
  ) {
    return this.service.adicionarColaborador(id, usuarioId);
  }

  @Delete(':id/colaboradores/:colaboradorId')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  removerColaborador(
    @Param('id') id: string,
    @Param('colaboradorId') colaboradorId: string,
  ) {
    return this.service.removerColaborador(id, colaboradorId);
  }

  // === Anexos ===

  @Get(':id/anexos')
  listarAnexos(@Param('id') id: string) {
    return this.anexoService.listAnexos(id);
  }

  @Post(':id/anexos')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  @UseFilters(UploadEaccesFilter)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: ParadaAnexoService.getUploadsDir(),
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname);
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIMES.includes(file.mimetype)) {
          return cb(new BadRequestException('Tipo de arquivo nao permitido'), false);
        }
        cb(null, true);
      },
    }),
  )
  addAnexo(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
    @Body('descricao') descricao?: string,
  ) {
    if (!file) throw new BadRequestException('Arquivo nao enviado');
    return this.anexoService.addAnexo(id, file, user.sub, descricao);
  }

  @Get(':id/anexos/:anexoId/download')
  async downloadAnexo(
    @Param('id') id: string,
    @Param('anexoId') anexoId: string,
    @Query('inline') inline: string,
    @Res() res: express.Response,
  ) {
    const { filePath, anexo } = await this.anexoService.getAnexoFile(id, anexoId);
    const safePath = path.resolve(filePath);
    if (!safePath.startsWith(path.resolve(ParadaAnexoService.getUploadsDir()))) {
      throw new BadRequestException('Caminho de arquivo invalido');
    }
    const inlineMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'application/pdf', 'text/plain', 'text/csv'];
    const canInline = inline === '1' && inlineMimes.includes(anexo.mimeType);
    res.setHeader('Content-Type', anexo.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `${canInline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(anexo.nomeOriginal)}"`);
    fs.createReadStream(filePath).pipe(res);
  }

  @Delete(':id/anexos/:anexoId')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  removeAnexo(
    @Param('id') id: string,
    @Param('anexoId') anexoId: string,
  ) {
    return this.anexoService.removeAnexo(id, anexoId);
  }
}
