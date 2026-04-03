import { Injectable } from '@nestjs/common';
import { CompraConfigService } from './services/compra-config.service.js';
import { CompraNotaFiscalService } from './services/compra-nota-fiscal.service.js';
import { CreateTipoProdutoDto, UpdateTipoProdutoDto } from './dto/create-tipo-produto.dto.js';
import { CreateTipoProjetoDto, UpdateTipoProjetoDto } from './dto/create-tipo-projeto.dto.js';
import { CreateNotaFiscalDto, UpdateNotaFiscalDto } from './dto/create-nota-fiscal.dto.js';

@Injectable()
export class CompraService {
  constructor(
    private readonly configService: CompraConfigService,
    private readonly notaFiscalService: CompraNotaFiscalService,
  ) {}

  // --- Tipos de Produto ---

  findAllTiposProduto(status?: string) {
    return this.configService.findAllTiposProduto(status);
  }

  createTipoProduto(dto: CreateTipoProdutoDto) {
    return this.configService.createTipoProduto(dto);
  }

  updateTipoProduto(id: string, dto: UpdateTipoProdutoDto) {
    return this.configService.updateTipoProduto(id, dto);
  }

  removeTipoProduto(id: string) {
    return this.configService.removeTipoProduto(id);
  }

  // --- Tipos de Projeto ---

  findAllTiposProjeto(status?: string) {
    return this.configService.findAllTiposProjeto(status);
  }

  createTipoProjeto(dto: CreateTipoProjetoDto) {
    return this.configService.createTipoProjeto(dto);
  }

  updateTipoProjeto(id: string, dto: UpdateTipoProjetoDto) {
    return this.configService.updateTipoProjeto(id, dto);
  }

  removeTipoProjeto(id: string) {
    return this.configService.removeTipoProjeto(id);
  }

  // --- Notas Fiscais ---

  findAllNotasFiscais(filters: {
    fornecedorId?: string;
    status?: string;
    departamentoId?: string;
    projetoId?: string;
    dataInicio?: string;
    dataFim?: string;
  }, filialId?: string) {
    return this.notaFiscalService.findAll(filters, filialId);
  }

  findOneNotaFiscal(id: string) {
    return this.notaFiscalService.findOne(id);
  }

  findNotasFiscaisByProjeto(projetoId: string) {
    return this.notaFiscalService.findByProjeto(projetoId);
  }

  createNotaFiscal(dto: CreateNotaFiscalDto, userId: string, filialId: string) {
    return this.notaFiscalService.create(dto, userId, filialId);
  }

  updateNotaFiscal(id: string, dto: UpdateNotaFiscalDto) {
    return this.notaFiscalService.update(id, dto);
  }

  removeNotaFiscal(id: string) {
    return this.notaFiscalService.remove(id);
  }

  duplicarNotaFiscal(id: string, userId: string, filialId: string) {
    return this.notaFiscalService.duplicar(id, userId, filialId);
  }
}
