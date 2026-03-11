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

const ALLOWED_MIMES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
  'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
];

@Controller('conhecimento')
@UseGuards(JwtAuthGuard, GestaoTiGuard, RolesGuard)
export class ConhecimentoController {
  constructor(private readonly service: ConhecimentoService) {}

  @Get()
  findAll(
    @Query('categoria') categoria?: string,
    @Query('status') status?: string,
    @Query('softwareId') softwareId?: string,
    @Query('equipeTiId') equipeTiId?: string,
    @Query('search') search?: string,
    @GestaoTiRole() role?: string,
  ) {
    return this.service.findAll({ categoria, status, softwareId, equipeTiId, search, role });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'DESENVOLVEDOR', 'FINANCEIRO')
  create(@Body() dto: CreateArtigoDto, @CurrentUser('sub') autorId: string) {
    return this.service.create(dto, autorId);
  }

  @Patch(':id')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'DESENVOLVEDOR', 'FINANCEIRO')
  update(@Param('id') id: string, @Body() dto: UpdateArtigoDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'DESENVOLVEDOR', 'FINANCEIRO')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusArtigoDto) {
    return this.service.updateStatus(id, dto.status);
  }

  @Delete(':id')
  @Roles('ADMIN', 'GESTOR_TI')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  // === Anexos ===

  @Get(':id/anexos')
  listAnexos(@Param('id') id: string) {
    return this.service.listAnexos(id);
  }

  @Post(':id/anexos')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'DESENVOLVEDOR', 'FINANCEIRO')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: UPLOADS_DIR,
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
  }))
  addAnexo(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
    @Body('descricao') descricao?: string,
  ) {
    if (!file) throw new BadRequestException('Arquivo obrigatorio');
    return this.service.addAnexo(id, file, user.sub, descricao);
  }

  @Get(':id/anexos/:anexoId/download')
  async downloadAnexo(
    @Param('id') id: string,
    @Param('anexoId') anexoId: string,
    @Res() res: express.Response,
  ) {
    const { filePath, anexo } = await this.service.getAnexoFile(id, anexoId);
    res.setHeader('Content-Type', anexo.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(anexo.nomeOriginal)}"`);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }

  @Delete(':id/anexos/:anexoId')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'FINANCEIRO')
  removeAnexo(@Param('id') id: string, @Param('anexoId') anexoId: string) {
    return this.service.removeAnexo(id, anexoId);
  }
}
