import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, Res, UseGuards, UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as express from 'express';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { ChamadoService } from './chamado.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { GestaoTiRole } from '../common/decorators/gestao-ti-role.decorator.js';
import { CreateChamadoDto } from './dto/create-chamado.dto.js';
import { TransferirEquipeDto, TransferirTecnicoDto } from './dto/transferir-chamado.dto.js';
import { ComentarioChamadoDto } from './dto/comentario-chamado.dto.js';
import { ResolverChamadoDto, ReabrirChamadoDto, CsatDto } from './dto/resolver-chamado.dto.js';
import { UpdateRegistroTempoChamadoDto } from './dto/update-registro-tempo-chamado.dto.js';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';
import { StatusChamado, Visibilidade } from '@prisma/client';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'chamados');
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

@Controller('chamados')
@UseGuards(JwtAuthGuard, GestaoTiGuard, RolesGuard)
export class ChamadoController {
  constructor(private readonly service: ChamadoService) {}

  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
    @Query('status') status?: StatusChamado,
    @Query('equipeId') equipeId?: string,
    @Query('visibilidade') visibilidade?: Visibilidade,
    @Query('meusChamados') meusChamados?: string,
    @Query('projetoId') projetoId?: string,
    @Query('filialId') filialId?: string,
    @Query('departamentoId') departamentoId?: string,
    @Query('pendentesAvaliacao') pendentesAvaliacao?: string,
  ) {
    return this.service.findAll(user, role, {
      status,
      equipeId,
      visibilidade,
      meusChamados: meusChamados === 'true',
      projetoId,
      filialId,
      departamentoId,
      pendentesAvaliacao: pendentesAvaliacao === 'true',
    });
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.findOne(id, user, role);
  }

  @Post()
  create(
    @Body() dto: CreateChamadoDto,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
    @Req() req: express.Request,
  ) {
    if (!dto.ipMaquina) {
      const forwarded = req.headers['x-forwarded-for'];
      const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress;
      if (ip) dto.ipMaquina = ip.replace('::ffff:', '');
    }
    return this.service.create(dto, user, role);
  }

  @Post(':id/assumir')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'DESENVOLVEDOR')
  assumir(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.assumir(id, user);
  }

  @Post(':id/transferir-equipe')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'DESENVOLVEDOR')
  transferirEquipe(
    @Param('id') id: string,
    @Body() dto: TransferirEquipeDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.transferirEquipe(id, dto, user);
  }

  @Post(':id/transferir-tecnico')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO')
  transferirTecnico(
    @Param('id') id: string,
    @Body() dto: TransferirTecnicoDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.transferirTecnico(id, dto, user);
  }

  @Post(':id/comentar')
  comentar(
    @Param('id') id: string,
    @Body() dto: ComentarioChamadoDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.comentar(id, dto, user);
  }

  @Patch(':id/resolver')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'DESENVOLVEDOR')
  resolver(
    @Param('id') id: string,
    @Body() dto: ResolverChamadoDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.resolver(id, dto, user);
  }

  @Patch(':id/fechar')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'DESENVOLVEDOR')
  fechar(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.fechar(id, user);
  }

  @Post(':id/reabrir')
  reabrir(
    @Param('id') id: string,
    @Body() dto: ReabrirChamadoDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.reabrir(id, dto, user);
  }

  @Patch(':id/cancelar')
  @Roles('ADMIN', 'GESTOR_TI')
  cancelar(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.cancelar(id, user);
  }

  @Post(':id/avaliar')
  avaliar(
    @Param('id') id: string,
    @Body() dto: CsatDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.avaliar(id, dto, user);
  }

  // === Anexos ===

  @Get(':id/anexos')
  listAnexos(@Param('id') id: string) {
    return this.service.listAnexos(id);
  }

  @Post(':id/anexos')
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
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO')
  removeAnexo(@Param('id') id: string, @Param('anexoId') anexoId: string) {
    return this.service.removeAnexo(id, anexoId);
  }

  // === Colaboradores ===

  @Get(':id/colaboradores')
  listarColaboradores(@Param('id') id: string) {
    return this.service.listarColaboradores(id);
  }

  @Post(':id/colaboradores')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'DESENVOLVEDOR')
  adicionarColaborador(@Param('id') id: string, @Body('usuarioId') usuarioId: string) {
    return this.service.adicionarColaborador(id, usuarioId);
  }

  @Delete(':id/colaboradores/:colaboradorId')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO', 'DESENVOLVEDOR')
  removerColaborador(@Param('id') id: string, @Param('colaboradorId') colaboradorId: string) {
    return this.service.removerColaborador(id, colaboradorId);
  }

  // === Registro de Tempo ===

  @Get(':id/registros-tempo')
  listarRegistrosTempo(@Param('id') id: string) {
    return this.service.listarRegistrosTempo(id);
  }

  @Post(':id/registros-tempo/iniciar')
  iniciarTempo(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body('usuarioId') usuarioId?: string) {
    return this.service.iniciarTempoChamado(id, usuarioId || user.sub);
  }

  @Post(':id/registros-tempo/encerrar')
  encerrarTempo(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body('usuarioId') usuarioId?: string) {
    return this.service.encerrarTempoChamado(id, usuarioId || user.sub);
  }

  @Patch(':id/registros-tempo/:registroId')
  ajustarRegistroTempo(@Param('id') id: string, @Param('registroId') registroId: string, @Body() dto: UpdateRegistroTempoChamadoDto) {
    return this.service.ajustarRegistroTempoChamado(id, registroId, dto);
  }

  @Delete(':id/registros-tempo/:registroId')
  removerRegistroTempo(@Param('id') id: string, @Param('registroId') registroId: string) {
    return this.service.removerRegistroTempoChamado(id, registroId);
  }
}
