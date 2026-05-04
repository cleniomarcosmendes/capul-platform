import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, Res, UseGuards, UseInterceptors, UploadedFile, BadRequestException, InternalServerErrorException, Logger,
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
import { UpdateChamadoHeaderDto } from './dto/update-chamado-header.dto.js';
import { TransferirEquipeDto, TransferirTecnicoDto } from './dto/transferir-chamado.dto.js';
import { ComentarioChamadoDto } from './dto/comentario-chamado.dto.js';
import { ResolverChamadoDto, ReabrirChamadoDto, CsatDto } from './dto/resolver-chamado.dto.js';
import { UpdateRegistroTempoChamadoDto } from './dto/update-registro-tempo-chamado.dto.js';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';
import { StatusChamado, Visibilidade } from '@prisma/client';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'chamados');
const uploadsLogger = new Logger('ChamadoUploads');

// Tenta garantir o diretório de uploads no startup. Se falhar (ex.: bind mount
// com owner errado em produção), NÃO crasha o app — só loga claramente. O fix
// real é em runtime na destination function abaixo, que dá mensagem clara ao
// usuário com o comando de chown a ser executado pelo admin.
try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    uploadsLogger.log(`✅ Diretório de uploads criado: ${UPLOADS_DIR}`);
  }
} catch (err: unknown) {
  const e = err as NodeJS.ErrnoException;
  uploadsLogger.error(
    `❌ Falha ao criar diretório de uploads ${UPLOADS_DIR} ` +
    `(code=${e.code || 'unknown'}). ` +
    `Admin: docker compose exec -u root gestao-ti-backend sh -c ` +
    `'mkdir -p ${UPLOADS_DIR} && chown -R appuser:appgroup ${UPLOADS_DIR}'`
  );
}

// Whitelist de MIME types aceitos em upload de anexos.
// NAO incluir 'application/octet-stream' aqui — permitiria upload de qualquer
// binario (ex: .exe renomeado para .pdf). Em caso de tipos legitimos que
// chegam como octet-stream (alguns navegadores/browsers antigos), considerar
// validacao cruzada por extensao do nome do arquivo.
const ALLOWED_MIMES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
  'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
  'application/x-pkcs12', 'application/pkcs12',
];

@Controller('chamados')
@UseGuards(JwtAuthGuard, GestaoTiGuard, RolesGuard)
export class ChamadoController {
  constructor(private readonly service: ChamadoService) {}

  @Get('client-ip')
  getClientIp(@Req() req: express.Request) {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress;
    return { ip: ip ? ip.replace('::ffff:', '') : null };
  }

  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
    @Query('status') status?: string,
    @Query('equipeId') equipeId?: string,
    @Query('visibilidade') visibilidade?: Visibilidade,
    @Query('meusChamados') meusChamados?: string,
    @Query('projetoId') projetoId?: string,
    @Query('filialId') filialId?: string,
    @Query('departamentoId') departamentoId?: string,
    @Query('pendentesAvaliacao') pendentesAvaliacao?: string,
    @Query('search') search?: string,
    @Query('tecnicoId') tecnicoId?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
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
      search,
      tecnicoId,
      dataInicio,
      dataFim,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
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
  ) {
    // IP da maquina deve ser informado pelo usuario, nao capturado automaticamente
    // (captura automatica retorna IP do Docker/proxy ao inves do IP real)
    return this.service.create(dto, user, role);
  }

  @Patch(':id/cabecalho')
  updateHeader(
    @Param('id') id: string,
    @Body() dto: UpdateChamadoHeaderDto,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.updateHeader(id, dto, user, role);
  }

  @Post(':id/assumir')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  assumir(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.assumir(id, user);
  }

  @Post(':id/transferir-equipe')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  transferirEquipe(
    @Param('id') id: string,
    @Body() dto: TransferirEquipeDto,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.transferirEquipe(id, dto, user, role);
  }

  @Post(':id/transferir-tecnico')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  transferirTecnico(
    @Param('id') id: string,
    @Body() dto: TransferirTecnicoDto,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.transferirTecnico(id, dto, user, role);
  }

  @Post(':id/comentar')
  comentar(
    @Param('id') id: string,
    @Body() dto: ComentarioChamadoDto,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.comentar(id, dto, user, role);
  }

  @Patch(':id/comentarios/:historicoId')
  editarComentario(
    @Param('id') id: string,
    @Param('historicoId') historicoId: string,
    @Body() body: { descricao: string },
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.editarComentario(id, historicoId, body.descricao, user, role);
  }

  @Patch(':id/resolver')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  resolver(
    @Param('id') id: string,
    @Body() dto: ResolverChamadoDto,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.resolver(id, dto, user, role);
  }

  @Patch(':id/fechar')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  fechar(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.fechar(id, user, role);
  }

  @Post(':id/reabrir')
  reabrir(
    @Param('id') id: string,
    @Body() dto: ReabrirChamadoDto,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.reabrir(id, dto, user, role);
  }

  @Patch(':id/cancelar')
  @Roles('ADMIN', 'GESTOR_TI')
  cancelar(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.cancelar(id, user, role);
  }

  @Delete(':id')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  excluir(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.excluir(id, user, role);
  }

  @Patch(':id/vincular-projeto')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  vincularProjeto(
    @Param('id') id: string,
    @Body('projetoId') projetoId: string,
  ) {
    return this.service.vincularProjeto(id, projetoId);
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
      // Destination como função (não string) — permite re-checar permissão/existência
      // a cada upload e devolver mensagem clara em vez de erro 500 silencioso.
      // Lição do bug do Fiscal/certs: bind mounts em produção podem ter owner errado
      // após recriação de container — usuário precisa ver o comando exato pra corrigir.
      destination: (_req, _file, cb) => {
        // 1) Garantir que o diretório existe
        try {
          if (!fs.existsSync(UPLOADS_DIR)) {
            fs.mkdirSync(UPLOADS_DIR, { recursive: true });
          }
        } catch (err: unknown) {
          const e = err as NodeJS.ErrnoException;
          uploadsLogger.error(`Falha ao criar ${UPLOADS_DIR}: ${e.code} ${e.message}`);
          return cb(new InternalServerErrorException(
            `Diretório de upload não pôde ser criado (${e.code || 'erro'}). ` +
            `Admin: docker compose exec -u root gestao-ti-backend sh -c ` +
            `'mkdir -p ${UPLOADS_DIR} && chown -R appuser:appgroup ${UPLOADS_DIR}'`
          ), '');
        }

        // 2) Checar permissão de escrita
        fs.access(UPLOADS_DIR, fs.constants.W_OK, (err) => {
          if (err) {
            const e = err as NodeJS.ErrnoException;
            uploadsLogger.error(`Sem permissão de escrita em ${UPLOADS_DIR}: ${e.code}`);
            return cb(new InternalServerErrorException(
              `Sem permissão de escrita no diretório de uploads (${e.code}). ` +
              `Admin: docker compose exec -u root gestao-ti-backend sh -c ` +
              `'chown -R appuser:appgroup ${UPLOADS_DIR}'`
            ), '');
          }
          cb(null, UPLOADS_DIR);
        });
      },
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
    @Query('inline') inline: string,
    @Res() res: express.Response,
  ) {
    const { filePath, anexo } = await this.service.getAnexoFile(id, anexoId);

    // Protecao contra path traversal
    const normalizedPath = path.resolve(filePath);
    const uploadsDir = path.resolve(UPLOADS_DIR);
    if (!normalizedPath.startsWith(uploadsDir)) {
      throw new BadRequestException('Caminho de arquivo invalido');
    }

    // Validar MIME type contra whitelist
    const mimeType = ALLOWED_MIMES.includes(anexo.mimeType)
      ? anexo.mimeType
      : 'application/octet-stream';

    // Tipos que podem ser visualizados inline no browser
    const inlineMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'application/pdf', 'text/plain', 'text/csv'];
    const canInline = inline === '1' && inlineMimes.includes(mimeType);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `${canInline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(anexo.nomeOriginal)}"`);
    const stream = fs.createReadStream(normalizedPath);
    stream.on('error', () => {
      if (!res.headersSent) res.status(404).send('Arquivo nao encontrado');
    });
    stream.pipe(res);
  }

  @Delete(':id/anexos/:anexoId')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  removeAnexo(@Param('id') id: string, @Param('anexoId') anexoId: string) {
    return this.service.removeAnexo(id, anexoId);
  }

  // === Colaboradores ===

  @Get(':id/colaboradores')
  listarColaboradores(@Param('id') id: string) {
    return this.service.listarColaboradores(id);
  }

  @Post(':id/colaboradores')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  adicionarColaborador(
    @Param('id') id: string,
    @Body('usuarioId') usuarioId: string,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.adicionarColaborador(id, usuarioId, user, role);
  }

  @Delete(':id/colaboradores/:colaboradorId')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  removerColaborador(
    @Param('id') id: string,
    @Param('colaboradorId') colaboradorId: string,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.removerColaborador(id, colaboradorId, user, role);
  }

  // === Registro de Tempo ===

  @Get(':id/registros-tempo')
  listarRegistrosTempo(@Param('id') id: string) {
    return this.service.listarRegistrosTempo(id);
  }

  @Post(':id/registros-tempo/iniciar')
  iniciarTempo(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
    @Body('usuarioId') usuarioId?: string,
  ) {
    return this.service.iniciarTempoChamado(id, usuarioId || user.sub, role);
  }

  @Post(':id/registros-tempo/encerrar')
  encerrarTempo(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body('usuarioId') usuarioId?: string) {
    return this.service.encerrarTempoChamado(id, usuarioId || user.sub);
  }

  @Patch(':id/registros-tempo/:registroId')
  ajustarRegistroTempo(
    @Param('id') id: string,
    @Param('registroId') registroId: string,
    @Body() dto: UpdateRegistroTempoChamadoDto,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.ajustarRegistroTempoChamado(id, registroId, dto, user.sub, role);
  }

  @Delete(':id/registros-tempo/:registroId')
  removerRegistroTempo(
    @Param('id') id: string,
    @Param('registroId') registroId: string,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.removerRegistroTempoChamado(id, registroId, user.sub, role);
  }
}
