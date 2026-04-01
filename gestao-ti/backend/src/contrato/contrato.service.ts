import { Injectable } from '@nestjs/common';
import { StatusContrato } from '@prisma/client';
import { ContratoCoreService } from './services/contrato-core.service.js';
import { ContratoParcelaService } from './services/contrato-parcela.service.js';
import { ContratoRateioService } from './services/contrato-rateio.service.js';
import { ContratoConfigService } from './services/contrato-config.service.js';
import { ContratoAnexoService } from './services/contrato-anexo.service.js';
import { CreateContratoDto } from './dto/create-contrato.dto';
import { UpdateContratoDto } from './dto/update-contrato.dto';
import { CreateParcelaDto } from './dto/create-parcela.dto';
import { UpdateParcelaDto } from './dto/update-parcela.dto';
import { PagarParcelaDto } from './dto/update-parcela.dto';
import { ConfigurarRateioTemplateDto, SimularRateioDto, GerarRateioParcelaDto, ConfigurarRateioDto } from './dto/rateio.dto';
import { RenovarContratoDto } from './dto/renovar-contrato.dto';
import { CreateNaturezaDto, UpdateNaturezaDto } from './dto/create-natureza.dto';
import { CreateTipoContratoDto, UpdateTipoContratoDto } from './dto/create-tipo-contrato.dto';
import { CreateFornecedorDto, UpdateFornecedorDto } from './dto/create-fornecedor.dto';
import { CreateProdutoDto, UpdateProdutoDto } from './dto/create-produto.dto';

@Injectable()
export class ContratoService {
  constructor(
    private readonly core: ContratoCoreService,
    private readonly parcela: ContratoParcelaService,
    private readonly rateio: ContratoRateioService,
    private readonly config: ContratoConfigService,
    private readonly anexo: ContratoAnexoService,
  ) {}

  // --- Core ---

  async verificarAcessoContratos(usuarioId: string, role: string): Promise<boolean> {
    return this.core.verificarAcessoContratos(usuarioId, role);
  }

  async findAll(filters: {
    tipoContratoId?: string;
    status?: string;
    softwareId?: string;
    fornecedor?: string;
    vencendoEm?: number;
  }, usuarioId?: string, role?: string) {
    return this.core.findAll(filters, usuarioId, role);
  }

  async findOneWithPermission(id: string, usuarioId: string, role: string) {
    return this.core.findOneWithPermission(id, usuarioId, role);
  }

  async findOne(id: string) {
    return this.core.findOne(id);
  }

  async create(dto: CreateContratoDto, usuarioId: string, role: string = 'ADMIN') {
    return this.core.create(dto, usuarioId, role);
  }

  async update(id: string, dto: UpdateContratoDto, usuarioId: string, role: string = 'ADMIN') {
    return this.core.update(id, dto, usuarioId, role);
  }

  async alterarStatus(id: string, novoStatus: StatusContrato, usuarioId: string, role: string = 'ADMIN') {
    return this.core.alterarStatus(id, novoStatus, usuarioId, role);
  }

  async renovar(id: string, dto: RenovarContratoDto, usuarioId: string, role: string = 'ADMIN') {
    return this.core.renovar(id, dto, usuarioId, role);
  }

  // --- Parcelas ---

  async listarParcelas(contratoId: string) {
    return this.parcela.listarParcelas(contratoId);
  }

  async criarParcela(contratoId: string, dto: CreateParcelaDto, usuarioId: string, role: string = 'ADMIN') {
    return this.parcela.criarParcela(contratoId, dto, usuarioId, role);
  }

  async atualizarParcela(contratoId: string, parcelaId: string, dto: UpdateParcelaDto, usuarioId: string, role: string = 'ADMIN') {
    return this.parcela.atualizarParcela(contratoId, parcelaId, dto, usuarioId, role);
  }

  async pagarParcela(contratoId: string, parcelaId: string, dto: PagarParcelaDto, usuarioId: string, role: string = 'ADMIN') {
    return this.parcela.pagarParcela(contratoId, parcelaId, dto, usuarioId, role);
  }

  async cancelarParcela(contratoId: string, parcelaId: string, usuarioId: string, role: string = 'ADMIN') {
    return this.parcela.cancelarParcela(contratoId, parcelaId, usuarioId, role);
  }

  // --- Rateio ---

  async obterRateioTemplate(contratoId: string) {
    return this.rateio.obterRateioTemplate(contratoId);
  }

  async simularRateioTemplate(contratoId: string, dto: SimularRateioDto) {
    return this.rateio.simularRateioTemplate(contratoId, dto);
  }

  async configurarRateioTemplate(contratoId: string, dto: ConfigurarRateioTemplateDto, usuarioId: string, role: string = 'ADMIN') {
    return this.rateio.configurarRateioTemplate(contratoId, dto, usuarioId, role);
  }

  async obterRateioParcela(contratoId: string, parcelaId: string) {
    return this.rateio.obterRateioParcela(contratoId, parcelaId);
  }

  async gerarRateioParcela(contratoId: string, parcelaId: string, dto: GerarRateioParcelaDto, usuarioId: string, role: string = 'ADMIN') {
    return this.rateio.gerarRateioParcela(contratoId, parcelaId, dto, usuarioId, role);
  }

  async configurarRateioParcela(contratoId: string, parcelaId: string, dto: ConfigurarRateioDto, usuarioId: string, role: string = 'ADMIN') {
    return this.rateio.configurarRateioParcela(contratoId, parcelaId, dto, usuarioId, role);
  }

  async copiarRateioParaPendentes(contratoId: string, parcelaId: string, usuarioId: string) {
    return this.rateio.copiarRateioParaPendentes(contratoId, parcelaId, usuarioId);
  }

  // --- Config (Naturezas, Tipos, Fornecedores, Produtos) ---

  async findAllNaturezas(status?: string) {
    return this.config.findAllNaturezas(status);
  }

  async createNatureza(dto: CreateNaturezaDto) {
    return this.config.createNatureza(dto);
  }

  async updateNatureza(id: string, dto: UpdateNaturezaDto) {
    return this.config.updateNatureza(id, dto);
  }

  async removeNatureza(id: string) {
    return this.config.removeNatureza(id);
  }

  async findAllTiposContrato(status?: string) {
    return this.config.findAllTiposContrato(status);
  }

  async createTipoContrato(dto: CreateTipoContratoDto) {
    return this.config.createTipoContrato(dto);
  }

  async updateTipoContrato(id: string, dto: UpdateTipoContratoDto) {
    return this.config.updateTipoContrato(id, dto);
  }

  async removeTipoContrato(id: string) {
    return this.config.removeTipoContrato(id);
  }

  async findAllFornecedores(status?: string) {
    return this.config.findAllFornecedores(status);
  }

  async createFornecedor(dto: CreateFornecedorDto) {
    return this.config.createFornecedor(dto);
  }

  async updateFornecedor(id: string, dto: UpdateFornecedorDto) {
    return this.config.updateFornecedor(id, dto);
  }

  async removeFornecedor(id: string) {
    return this.config.removeFornecedor(id);
  }

  async findAllProdutos(status?: string) {
    return this.config.findAllProdutos(status);
  }

  async createProduto(dto: CreateProdutoDto) {
    return this.config.createProduto(dto);
  }

  async updateProduto(id: string, dto: UpdateProdutoDto) {
    return this.config.updateProduto(id, dto);
  }

  async removeProduto(id: string) {
    return this.config.removeProduto(id);
  }

  // --- Anexos, Renovacoes, Licencas ---

  async listarAnexos(contratoId: string) {
    return this.anexo.listarAnexos(contratoId);
  }

  async uploadAnexo(contratoId: string, file: Express.Multer.File) {
    return this.anexo.uploadAnexo(contratoId, file);
  }

  async downloadAnexo(contratoId: string, anexoId: string) {
    return this.anexo.downloadAnexo(contratoId, anexoId);
  }

  async excluirAnexo(contratoId: string, anexoId: string, usuarioId: string) {
    return this.anexo.excluirAnexo(contratoId, anexoId, usuarioId);
  }

  async listarRenovacoes(contratoId: string) {
    return this.anexo.listarRenovacoes(contratoId);
  }

  async vincularLicenca(contratoId: string, licencaId: string, usuarioId: string, role: string = 'ADMIN') {
    return this.anexo.vincularLicenca(contratoId, licencaId, usuarioId, role);
  }

  async desvincularLicenca(contratoId: string, licencaId: string, usuarioId: string, role: string = 'ADMIN') {
    return this.anexo.desvincularLicenca(contratoId, licencaId, usuarioId, role);
  }
}
