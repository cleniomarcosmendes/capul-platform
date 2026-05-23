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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import * as express from 'express';
import { CompraService } from './compra.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GestaoTiRole } from '../common/decorators/gestao-ti-role.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { isAnexoPermitido } from '../common/constants/anexo-mime.constant';
import { createUploadConfig } from '../common/helpers/multer-upload.helper.js';
import { FuncionalidadeGuard } from '../common/guards/funcionalidade.guard.js';
import { RequiresFuncionalidade } from '../common/decorators/requires-funcionalidade.decorator.js';
import { CreateTipoProdutoDto, UpdateTipoProdutoDto } from './dto/create-tipo-produto.dto';
import { CreateTipoProjetoDto, UpdateTipoProjetoDto } from './dto/create-tipo-projeto.dto';
import { CreateNotaFiscalDto, UpdateNotaFiscalDto, ValidarChaveNfeDto } from './dto/create-nota-fiscal.dto';

const NF_UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'notas-fiscais');
if (!fs.existsSync(NF_UPLOADS_DIR)) {
  fs.mkdirSync(NF_UPLOADS_DIR, { recursive: true });
}

/**
 * Extrai o token Bearer do header Authorization. Usado quando o Compras
 * precisa propagar o JWT do usuário para chamar o módulo Fiscal (vínculo
 * de chave NF-e). O JwtAuthGuard já garante que o token é válido aqui.
 */
function extrairJwt(req: express.Request): string {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    throw new BadRequestException('Header Authorization Bearer ausente');
  }
  return auth.slice('Bearer '.length).trim();
}

@Controller('compras')
@UseGuards(JwtAuthGuard, GestaoTiGuard, RolesGuard, FuncionalidadeGuard)
@RequiresFuncionalidade('NOTA_FISCAL')
export class CompraController {
  constructor(private readonly service: CompraService) {}

  // --- Tipos de Produto ---

  @Get('tipos-produto')
  findAllTiposProduto(@Query('status') status?: string) {
    return this.service.findAllTiposProduto(status);
  }

  @Post('tipos-produto')
  @Roles('ADMIN', 'GESTOR')
  createTipoProduto(@Body() dto: CreateTipoProdutoDto) {
    return this.service.createTipoProduto(dto);
  }

  @Patch('tipos-produto/:id')
  @Roles('ADMIN', 'GESTOR')
  updateTipoProduto(@Param('id') id: string, @Body() dto: UpdateTipoProdutoDto) {
    return this.service.updateTipoProduto(id, dto);
  }

  @Delete('tipos-produto/:id')
  @Roles('ADMIN', 'GESTOR')
  removeTipoProduto(@Param('id') id: string) {
    return this.service.removeTipoProduto(id);
  }

  // --- Tipos de Projeto ---

  @Get('tipos-projeto')
  findAllTiposProjeto(@Query('status') status?: string) {
    return this.service.findAllTiposProjeto(status);
  }

  @Post('tipos-projeto')
  @Roles('ADMIN', 'GESTOR')
  createTipoProjeto(@Body() dto: CreateTipoProjetoDto) {
    return this.service.createTipoProjeto(dto);
  }

  @Patch('tipos-projeto/:id')
  @Roles('ADMIN', 'GESTOR')
  updateTipoProjeto(@Param('id') id: string, @Body() dto: UpdateTipoProjetoDto) {
    return this.service.updateTipoProjeto(id, dto);
  }

  @Delete('tipos-projeto/:id')
  @Roles('ADMIN', 'GESTOR')
  removeTipoProjeto(@Param('id') id: string) {
    return this.service.removeTipoProjeto(id);
  }

  // --- Notas Fiscais ---

  @Get('notas-fiscais')
  findAllNotasFiscais(
    @Query('fornecedorId') fornecedorId?: string,
    @Query('status') status?: string,
    @Query('centroCustoId') centroCustoId?: string,
    @Query('projetoId') projetoId?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('equipeId') equipeId?: string,
    @CurrentUser() user?: JwtPayload,
    @GestaoTiRole() role?: string,
  ) {
    return this.service.findAllNotasFiscais(
      { fornecedorId, status, centroCustoId, projetoId, dataInicio, dataFim, equipeId },
      user?.filialId,
      user?.sub,
      role,
      user,
    );
  }

  @Get('notas-fiscais/equipes-disponiveis')
  findEquipesParaCompras(
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.findEquipesParaCompras(user.sub, role);
  }

  @Get('notas-fiscais/por-projeto/:projetoId')
  findNotasFiscaisByProjeto(@Param('projetoId') projetoId: string) {
    return this.service.findNotasFiscaisByProjeto(projetoId);
  }

  @Get('notas-fiscais/:id')
  findOneNotaFiscal(@Param('id') id: string) {
    return this.service.findOneNotaFiscal(id);
  }

  @Post('notas-fiscais/validar-chave')
  @Roles('ADMIN', 'GESTOR', 'SUPORTE')
  validarChaveNotaFiscal(
    @Body() dto: ValidarChaveNfeDto,
    @Req() req: express.Request,
  ) {
    const jwt = extrairJwt(req);
    return this.service.validarChaveNotaFiscal(dto.chave, jwt);
  }

  @Post('notas-fiscais')
  @Roles('ADMIN', 'GESTOR', 'SUPORTE')
  createNotaFiscal(
    @Body() dto: CreateNotaFiscalDto,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
    @Req() req: express.Request,
  ) {
    const jwt = dto.chaveNfe ? extrairJwt(req) : undefined;
    return this.service.createNotaFiscal(dto, user.sub, user.filialId, role, jwt, user);
  }

  @Patch('notas-fiscais/:id')
  @Roles('ADMIN', 'GESTOR', 'SUPORTE')
  updateNotaFiscal(
    @Param('id') id: string,
    @Body() dto: UpdateNotaFiscalDto,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
    @Req() req: express.Request,
  ) {
    const jwt = dto.chaveNfe !== undefined ? extrairJwt(req) : undefined;
    return this.service.updateNotaFiscal(id, dto, user.sub, role, jwt);
  }

  @Delete('notas-fiscais/:id')
  @Roles('ADMIN', 'GESTOR')
  removeNotaFiscal(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.removeNotaFiscal(id, user.sub, role);
  }

  @Post('notas-fiscais/:id/duplicar')
  @Roles('ADMIN', 'GESTOR', 'SUPORTE')
  duplicarNotaFiscal(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.duplicarNotaFiscal(id, user.sub, user.filialId, role);
  }

  // --- Anexos de Notas Fiscais ---

  @Get('notas-fiscais/:id/anexos')
  listAnexosNF(@Param('id') id: string) {
    return this.service.listAnexosNF(id);
  }

  @Post('notas-fiscais/:id/anexos')
  @Roles('ADMIN', 'GESTOR', 'SUPORTE')
  // Auditoria 10/05/2026 #DT3-M2 — Multer config compartilhado (ver multer-upload.helper.ts)
  @UseInterceptors(FileInterceptor('file', createUploadConfig({
    uploadsDir: NF_UPLOADS_DIR,
    loggerName: 'NotaFiscalUploads',
  })))
  addAnexoNF(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!file) throw new BadRequestException('Arquivo obrigatorio');
    return this.service.addAnexoNF(id, file, user.sub);
  }

  @Get('notas-fiscais/:id/anexos/:anexoId/download')
  async downloadAnexoNF(
    @Param('id') id: string,
    @Param('anexoId') anexoId: string,
    @Query('inline') inline: string,
    @Res() res: express.Response,
  ) {
    const { filePath, anexo } = await this.service.getAnexoFileNF(id, anexoId);
    const normalizedPath = path.resolve(filePath);
    if (!normalizedPath.startsWith(path.resolve(NF_UPLOADS_DIR))) {
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

  @Delete('notas-fiscais/:id/anexos/:anexoId')
  @Roles('ADMIN', 'GESTOR', 'SUPORTE')
  removeAnexoNF(@Param('id') id: string, @Param('anexoId') anexoId: string) {
    return this.service.removeAnexoNF(id, anexoId);
  }
}
