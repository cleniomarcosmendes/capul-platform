import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { IntegracaoService } from './integracao.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CreateIntegracaoDto,
  UpdateIntegracaoDto,
  CreateEndpointDto,
  UpdateEndpointDto,
  TestarEndpointDto,
} from './dto/integracao.dto';

@Controller('api/v1/core/integracoes')
@UseGuards(JwtAuthGuard)
export class IntegracaoController {
  constructor(private readonly integracaoService: IntegracaoService) {}

  // --- Rotas estaticas PRIMEIRO (antes de :id) ---

  @Get()
  findAll() {
    return this.integracaoService.findAll();
  }

  @Post()
  create(@Body() dto: CreateIntegracaoDto) {
    return this.integracaoService.create(dto);
  }

  @Post('testar-conexao')
  testarConexao(@Body() dto: TestarEndpointDto) {
    return this.integracaoService.testarConexao(dto);
  }

  @Get('codigo/:codigo')
  findByCodigo(@Param('codigo') codigo: string) {
    return this.integracaoService.findByCodigo(codigo);
  }

  @Get('codigo/:codigo/endpoints-ativos')
  getEndpointsAtivos(@Param('codigo') codigo: string) {
    return this.integracaoService.getEndpointsAtivos(codigo);
  }

  @Patch('endpoints/:endpointId')
  updateEndpoint(@Param('endpointId') endpointId: string, @Body() dto: UpdateEndpointDto) {
    return this.integracaoService.updateEndpoint(endpointId, dto);
  }

  @Delete('endpoints/:endpointId')
  removeEndpoint(@Param('endpointId') endpointId: string) {
    return this.integracaoService.removeEndpoint(endpointId);
  }

  // --- Rotas parametrizadas por ultimo ---

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.integracaoService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateIntegracaoDto) {
    return this.integracaoService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.integracaoService.remove(id);
  }

  @Post(':id/endpoints')
  addEndpoint(@Param('id') id: string, @Body() dto: CreateEndpointDto) {
    return this.integracaoService.addEndpoint(id, dto);
  }
}
