import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as express from 'express';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { ContratoService } from './contrato.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GestaoTiRole } from '../common/decorators/gestao-ti-role.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { CreateContratoDto } from './dto/create-contrato.dto';
import { UpdateContratoDto, UpdateStatusContratoDto } from './dto/update-contrato.dto';
import { CreateParcelaDto } from './dto/create-parcela.dto';
import { UpdateParcelaDto, PagarParcelaDto } from './dto/update-parcela.dto';
import { ConfigurarRateioTemplateDto, SimularRateioDto, ConfigurarRateioDto, GerarRateioParcelaDto } from './dto/rateio.dto';
import { RenovarContratoDto } from './dto/renovar-contrato.dto';
import { CreateNaturezaDto, UpdateNaturezaDto } from './dto/create-natureza.dto';
import { CreateTipoContratoDto, UpdateTipoContratoDto } from './dto/create-tipo-contrato.dto';
import { CreateFornecedorDto, UpdateFornecedorDto } from './dto/create-fornecedor.dto';
import { CreateProdutoDto, UpdateProdutoDto } from './dto/create-produto.dto';

const UPLOADS_DIR = path.resolve('./uploads/contratos');

@Controller('contratos')
@UseGuards(JwtAuthGuard, GestaoTiGuard, RolesGuard)
export class ContratoController {
  constructor(private readonly service: ContratoService) {}

  // --- Naturezas ---

  @Get('naturezas')
  findAllNaturezas(@Query('status') status?: string) {
    return this.service.findAllNaturezas(status);
  }

  @Post('naturezas')
  @Roles('ADMIN', 'GESTOR_TI')
  createNatureza(@Body() dto: CreateNaturezaDto) {
    return this.service.createNatureza(dto);
  }

  @Patch('naturezas/:id')
  @Roles('ADMIN', 'GESTOR_TI')
  updateNatureza(@Param('id') id: string, @Body() dto: UpdateNaturezaDto) {
    return this.service.updateNatureza(id, dto);
  }

  @Delete('naturezas/:id')
  @Roles('ADMIN', 'GESTOR_TI')
  removeNatureza(@Param('id') id: string) {
    return this.service.removeNatureza(id);
  }

  // --- Tipos de Contrato ---

  @Get('tipos-contrato')
  findAllTiposContrato(@Query('status') status?: string) {
    return this.service.findAllTiposContrato(status);
  }

  @Post('tipos-contrato')
  @Roles('ADMIN', 'GESTOR_TI')
  createTipoContrato(@Body() dto: CreateTipoContratoDto) {
    return this.service.createTipoContrato(dto);
  }

  @Patch('tipos-contrato/:id')
  @Roles('ADMIN', 'GESTOR_TI')
  updateTipoContrato(@Param('id') id: string, @Body() dto: UpdateTipoContratoDto) {
    return this.service.updateTipoContrato(id, dto);
  }

  @Delete('tipos-contrato/:id')
  @Roles('ADMIN', 'GESTOR_TI')
  removeTipoContrato(@Param('id') id: string) {
    return this.service.removeTipoContrato(id);
  }

  // --- Fornecedores ---

  @Get('fornecedores')
  findAllFornecedores(@Query('status') status?: string) {
    return this.service.findAllFornecedores(status);
  }

  @Post('fornecedores')
  @Roles('ADMIN', 'GESTOR_TI')
  createFornecedor(@Body() dto: CreateFornecedorDto) {
    return this.service.createFornecedor(dto);
  }

  @Patch('fornecedores/:id')
  @Roles('ADMIN', 'GESTOR_TI')
  updateFornecedor(@Param('id') id: string, @Body() dto: UpdateFornecedorDto) {
    return this.service.updateFornecedor(id, dto);
  }

  @Delete('fornecedores/:id')
  @Roles('ADMIN', 'GESTOR_TI')
  removeFornecedor(@Param('id') id: string) {
    return this.service.removeFornecedor(id);
  }

  // --- Produtos ---

  @Get('produtos')
  findAllProdutos(@Query('status') status?: string) {
    return this.service.findAllProdutos(status);
  }

  @Post('produtos')
  @Roles('ADMIN', 'GESTOR_TI')
  createProduto(@Body() dto: CreateProdutoDto) {
    return this.service.createProduto(dto);
  }

  @Patch('produtos/:id')
  @Roles('ADMIN', 'GESTOR_TI')
  updateProduto(@Param('id') id: string, @Body() dto: UpdateProdutoDto) {
    return this.service.updateProduto(id, dto);
  }

  @Delete('produtos/:id')
  @Roles('ADMIN', 'GESTOR_TI')
  removeProduto(@Param('id') id: string) {
    return this.service.removeProduto(id);
  }

  // --- Contratos ---

  @Get('acesso')
  verificarAcesso(@CurrentUser() user: JwtPayload, @GestaoTiRole() role: string) {
    return this.service.verificarAcessoContratos(user.sub, role).then(temAcesso => ({ temAcesso }));
  }

  @Get()
  findAll(
    @Query('tipoContratoId') tipoContratoId?: string,
    @Query('status') status?: string,
    @Query('softwareId') softwareId?: string,
    @Query('fornecedor') fornecedor?: string,
    @Query('vencendoEm') vencendoEm?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @CurrentUser() user?: JwtPayload,
    @GestaoTiRole() role?: string,
  ) {
    return this.service.findAll({
      tipoContratoId,
      status,
      softwareId,
      fornecedor,
      vencendoEm: vencendoEm ? parseInt(vencendoEm, 10) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    }, user?.sub, role);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload, @GestaoTiRole() role: string) {
    return this.service.findOneWithPermission(id, user.sub, role);
  }

  @Post()
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  create(@Body() dto: CreateContratoDto, @CurrentUser() user: JwtPayload, @GestaoTiRole() role: string) {
    return this.service.create(dto, user.sub, role);
  }

  @Patch(':id')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateContratoDto,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.update(id, dto, user.sub, role);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  alterarStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusContratoDto,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.alterarStatus(id, dto.status, user.sub, role);
  }

  @Post(':id/renovar')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  renovar(
    @Param('id') id: string,
    @Body() dto: RenovarContratoDto,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.renovar(id, dto, user.sub, role);
  }

  // --- Parcelas ---

  @Get(':id/parcelas')
  listarParcelas(@Param('id') id: string) {
    return this.service.listarParcelas(id);
  }

  @Post(':id/parcelas')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  criarParcela(
    @Param('id') id: string,
    @Body() dto: CreateParcelaDto,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.criarParcela(id, dto, user.sub, role);
  }

  @Patch(':id/parcelas/:pid')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  atualizarParcela(
    @Param('id') id: string,
    @Param('pid') pid: string,
    @Body() dto: UpdateParcelaDto,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.atualizarParcela(id, pid, dto, user.sub, role);
  }

  @Post(':id/parcelas/:pid/pagar')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  pagarParcela(
    @Param('id') id: string,
    @Param('pid') pid: string,
    @Body() dto: PagarParcelaDto,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.pagarParcela(id, pid, dto, user.sub, role);
  }

  @Post(':id/parcelas/:pid/estornar')
  @Roles('ADMIN', 'GESTOR_TI')
  estornarParcela(
    @Param('id') id: string,
    @Param('pid') pid: string,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.estornarParcela(id, pid, user.sub, role);
  }

  @Post(':id/parcelas/:pid/cancelar')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  cancelarParcela(
    @Param('id') id: string,
    @Param('pid') pid: string,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.cancelarParcela(id, pid, user.sub, role);
  }

  // --- Rateio Template ---

  @Get(':id/rateio-template')
  obterRateioTemplate(@Param('id') id: string) {
    return this.service.obterRateioTemplate(id);
  }

  @Post(':id/rateio-template')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  configurarRateioTemplate(
    @Param('id') id: string,
    @Body() dto: ConfigurarRateioTemplateDto,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.configurarRateioTemplate(id, dto, user.sub, role);
  }

  @Post(':id/rateio-template/simular')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  simularRateioTemplate(@Param('id') id: string, @Body() dto: SimularRateioDto) {
    return this.service.simularRateioTemplate(id, dto);
  }

  // --- Rateio por Parcela ---

  @Get(':id/parcelas/:pid/rateio')
  obterRateioParcela(@Param('id') id: string, @Param('pid') pid: string) {
    return this.service.obterRateioParcela(id, pid);
  }

  @Post(':id/parcelas/:pid/rateio')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  configurarRateioParcela(
    @Param('id') id: string,
    @Param('pid') pid: string,
    @Body() dto: ConfigurarRateioDto,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.configurarRateioParcela(id, pid, dto, user.sub, role);
  }

  @Post(':id/parcelas/:pid/rateio/gerar')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  gerarRateioParcela(
    @Param('id') id: string,
    @Param('pid') pid: string,
    @Body() dto: GerarRateioParcelaDto,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.gerarRateioParcela(id, pid, dto, user.sub, role);
  }

  @Post(':id/parcelas/:pid/rateio/copiar-pendentes')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  copiarRateioParaPendentes(
    @Param('id') id: string,
    @Param('pid') pid: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.copiarRateioParaPendentes(id, pid, user.sub);
  }

  // --- Rateio Projeto ---

  @Get(':id/parcelas/:pid/rateio-projeto')
  obterRateioProjeto(@Param('id') id: string, @Param('pid') pid: string) {
    return this.service.obterRateioProjeto(id, pid);
  }

  @Post(':id/parcelas/:pid/rateio-projeto')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  configurarRateioProjeto(
    @Param('id') id: string,
    @Param('pid') pid: string,
    @Body('itens') itens: { projetoId: string; percentual?: number; valorCalculado: number }[],
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.configurarRateioProjeto(id, pid, itens, user.sub, role);
  }

  @Delete(':id/parcelas/:pid/rateio-projeto')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  removerRateioProjeto(
    @Param('id') id: string,
    @Param('pid') pid: string,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.removerRateioProjeto(id, pid, user.sub, role);
  }

  // --- Anexos ---

  @Get(':id/anexos')
  listarAnexos(@Param('id') id: string) {
    return this.service.listarAnexos(id);
  }

  @Post(':id/anexos')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
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
      cb(null, true);
    },
  }))
  uploadAnexo(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Arquivo obrigatorio');
    return this.service.uploadAnexo(id, file);
  }

  @Get(':id/anexos/:aid/download')
  async downloadAnexo(
    @Param('id') id: string,
    @Param('aid') aid: string,
    @Query('inline') inline: string,
    @Res() res: express.Response,
  ) {
    const { anexo, filePath } = await this.service.downloadAnexo(id, aid);
    // Protecao contra path traversal
    const normalizedPath = path.resolve(filePath);
    if (!normalizedPath.startsWith(path.resolve(UPLOADS_DIR))) {
      throw new BadRequestException('Caminho de arquivo invalido');
    }
    const inlineMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'application/pdf', 'text/plain', 'text/csv'];
    const canInline = inline === '1' && inlineMimes.includes(anexo.mimeType);
    res.setHeader('Content-Type', anexo.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `${canInline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(anexo.nomeOriginal)}"`);
    res.sendFile(normalizedPath);
  }

  @Delete(':id/anexos/:aid')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  excluirAnexo(
    @Param('id') id: string,
    @Param('aid') aid: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.excluirAnexo(id, aid, user.sub);
  }

  // --- Renovacoes ---

  @Get(':id/renovacoes')
  listarRenovacoes(@Param('id') id: string) {
    return this.service.listarRenovacoes(id);
  }

  // --- Licencas ---

  @Post(':id/licencas')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  vincularLicenca(
    @Param('id') id: string,
    @Body('licencaId') licencaId: string,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.vincularLicenca(id, licencaId, user.sub, role);
  }

  @Delete(':id/licencas/:licId')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  desvincularLicenca(
    @Param('id') id: string,
    @Param('licId') licId: string,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.desvincularLicenca(id, licId, user.sub, role);
  }
}
