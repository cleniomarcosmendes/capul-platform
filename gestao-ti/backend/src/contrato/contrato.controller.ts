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

  // --- Contratos ---

  @Get()
  findAll(
    @Query('tipoContratoId') tipoContratoId?: string,
    @Query('status') status?: string,
    @Query('softwareId') softwareId?: string,
    @Query('fornecedor') fornecedor?: string,
    @Query('vencendoEm') vencendoEm?: string,
  ) {
    return this.service.findAll({
      tipoContratoId,
      status,
      softwareId,
      fornecedor,
      vencendoEm: vencendoEm ? parseInt(vencendoEm, 10) : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'GESTOR_TI', 'FINANCEIRO')
  create(@Body() dto: CreateContratoDto, @CurrentUser() user: JwtPayload, @GestaoTiRole() role: string) {
    return this.service.create(dto, user.sub, role);
  }

  @Patch(':id')
  @Roles('ADMIN', 'GESTOR_TI', 'FINANCEIRO')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateContratoDto,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.update(id, dto, user.sub, role);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'GESTOR_TI', 'FINANCEIRO')
  alterarStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusContratoDto,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.alterarStatus(id, dto.status, user.sub, role);
  }

  @Post(':id/renovar')
  @Roles('ADMIN', 'GESTOR_TI', 'FINANCEIRO')
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
  @Roles('ADMIN', 'GESTOR_TI', 'FINANCEIRO')
  criarParcela(
    @Param('id') id: string,
    @Body() dto: CreateParcelaDto,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.criarParcela(id, dto, user.sub, role);
  }

  @Patch(':id/parcelas/:pid')
  @Roles('ADMIN', 'GESTOR_TI', 'FINANCEIRO')
  atualizarParcela(
    @Param('id') id: string,
    @Param('pid') pid: string,
    @Body() dto: UpdateParcelaDto,
  ) {
    return this.service.atualizarParcela(id, pid, dto);
  }

  @Post(':id/parcelas/:pid/pagar')
  @Roles('ADMIN', 'GESTOR_TI', 'FINANCEIRO')
  pagarParcela(
    @Param('id') id: string,
    @Param('pid') pid: string,
    @Body() dto: PagarParcelaDto,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.pagarParcela(id, pid, dto, user.sub, role);
  }

  @Post(':id/parcelas/:pid/cancelar')
  @Roles('ADMIN', 'GESTOR_TI', 'FINANCEIRO')
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
  @Roles('ADMIN', 'GESTOR_TI', 'FINANCEIRO')
  configurarRateioTemplate(
    @Param('id') id: string,
    @Body() dto: ConfigurarRateioTemplateDto,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.configurarRateioTemplate(id, dto, user.sub, role);
  }

  @Post(':id/rateio-template/simular')
  @Roles('ADMIN', 'GESTOR_TI', 'FINANCEIRO')
  simularRateioTemplate(@Param('id') id: string, @Body() dto: SimularRateioDto) {
    return this.service.simularRateioTemplate(id, dto);
  }

  // --- Rateio por Parcela ---

  @Get(':id/parcelas/:pid/rateio')
  obterRateioParcela(@Param('id') id: string, @Param('pid') pid: string) {
    return this.service.obterRateioParcela(id, pid);
  }

  @Post(':id/parcelas/:pid/rateio')
  @Roles('ADMIN', 'GESTOR_TI', 'FINANCEIRO')
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
  @Roles('ADMIN', 'GESTOR_TI', 'FINANCEIRO')
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
  @Roles('ADMIN', 'GESTOR_TI', 'FINANCEIRO')
  copiarRateioParaPendentes(
    @Param('id') id: string,
    @Param('pid') pid: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.copiarRateioParaPendentes(id, pid, user.sub);
  }

  // --- Anexos ---

  @Get(':id/anexos')
  listarAnexos(@Param('id') id: string) {
    return this.service.listarAnexos(id);
  }

  @Post(':id/anexos')
  @Roles('ADMIN', 'GESTOR_TI', 'FINANCEIRO')
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
    @Res() res: express.Response,
  ) {
    const { anexo, filePath } = await this.service.downloadAnexo(id, aid);
    res.setHeader('Content-Type', anexo.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(anexo.nomeOriginal)}"`);
    res.sendFile(filePath);
  }

  @Delete(':id/anexos/:aid')
  @Roles('ADMIN', 'GESTOR_TI', 'FINANCEIRO')
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
  @Roles('ADMIN', 'GESTOR_TI', 'FINANCEIRO')
  vincularLicenca(
    @Param('id') id: string,
    @Body('licencaId') licencaId: string,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.vincularLicenca(id, licencaId, user.sub, role);
  }

  @Delete(':id/licencas/:licId')
  @Roles('ADMIN', 'GESTOR_TI', 'FINANCEIRO')
  desvincularLicenca(
    @Param('id') id: string,
    @Param('licId') licId: string,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.desvincularLicenca(id, licId, user.sub, role);
  }
}
