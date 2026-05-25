import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, Res, UseGuards, UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import * as express from 'express';
import { ConhecimentoService } from './conhecimento.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { CreateArtigoDto } from './dto/create-artigo.dto.js';
import { UpdateArtigoDto, UpdateStatusArtigoDto } from './dto/update-artigo.dto.js';
import { GestaoTiRole } from '../common/decorators/gestao-ti-role.decorator.js';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'conhecimento');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Whitelist centralizada — common/constants/anexo-mime.constant.ts (06/05/2026).
import { isAnexoPermitido } from '../common/constants/anexo-mime.constant';
import { createUploadConfig } from '../common/helpers/multer-upload.helper.js';
import { FuncionalidadeGuard } from '../common/guards/funcionalidade.guard.js';
import { RequiresFuncionalidade } from '../common/decorators/requires-funcionalidade.decorator.js';

@Controller('conhecimento')
@UseGuards(JwtAuthGuard, GestaoTiGuard, RolesGuard, FuncionalidadeGuard)
@RequiresFuncionalidade('EQUIPE')
export class ConhecimentoController {
  constructor(private readonly service: ConhecimentoService) {}

  @Get()
  findAll(
    @Query('categoria') categoria?: string,
    @Query('status') status?: string,
    @Query('softwareId') softwareId?: string,
    @Query('equipeTiId') equipeTiId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @GestaoTiRole() role?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.service.findAll({
      categoria,
      status,
      softwareId,
      equipeTiId,
      search,
      role,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      user,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'GESTOR', 'SUPORTE')
  create(@Body() dto: CreateArtigoDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub, user);
  }

  @Patch(':id')
  @Roles('ADMIN', 'GESTOR', 'SUPORTE')
  update(@Param('id') id: string, @Body() dto: UpdateArtigoDto, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, dto, user);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'GESTOR', 'SUPORTE')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusArtigoDto, @CurrentUser() user: JwtPayload) {
    return this.service.updateStatus(id, dto.status, user);
  }

  @Delete(':id')
  @Roles('ADMIN', 'GESTOR', 'SUPORTE')
  delete(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.delete(id, user);
  }

  // === Anexos ===

  @Get(':id/anexos')
  listAnexos(@Param('id') id: string) {
    return this.service.listAnexos(id);
  }

  @Post(':id/anexos')
  @Roles('ADMIN', 'GESTOR', 'SUPORTE')
  // Auditoria 10/05/2026 #DT3-M2 — Multer config compartilhado (ver multer-upload.helper.ts)
  @UseInterceptors(FileInterceptor('file', createUploadConfig({
    uploadsDir: UPLOADS_DIR,
    loggerName: 'ConhecimentoUploads',
  })))
  addAnexo(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
    @Body('descricao') descricao?: string,
  ) {
    if (!file) throw new BadRequestException('Arquivo obrigatorio');
    return this.service.addAnexo(id, file, user.sub, descricao, user);
  }

  @Get(':id/anexos/:anexoId/download')
  async downloadAnexo(
    @Param('id') id: string,
    @Param('anexoId') anexoId: string,
    @Query('inline') inline: string,
    @Res() res: express.Response,
  ) {
    const { filePath, anexo } = await this.service.getAnexoFile(id, anexoId);
    // Protecao contra path traversal
    const normalizedPath = path.resolve(filePath);
    if (!normalizedPath.startsWith(path.resolve(UPLOADS_DIR))) {
      throw new BadRequestException('Caminho de arquivo invalido');
    }
    const inlineMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'application/pdf', 'text/plain', 'text/csv'];
    const canInline = inline === '1' && inlineMimes.includes(anexo.mimeType);
    res.setHeader('Content-Type', anexo.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `${canInline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(anexo.nomeOriginal)}"`);
    const stream = fs.createReadStream(normalizedPath);
    stream.on('error', () => { if (!res.headersSent) res.status(404).send('Arquivo nao encontrado'); });
    stream.pipe(res);
  }

  @Delete(':id/anexos/:anexoId')
  @Roles('ADMIN', 'GESTOR', 'SUPORTE')
  removeAnexo(@Param('id') id: string, @Param('anexoId') anexoId: string, @CurrentUser() user: JwtPayload) {
    return this.service.removeAnexo(id, anexoId, user);
  }
}
