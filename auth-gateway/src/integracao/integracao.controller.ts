import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, ParseEnumPipe } from '@nestjs/common';
import { ModuloConsumidor } from '@prisma/client';
import { IntegracaoService } from './integracao.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConfiguradorAdminGuard } from '../presenca/configurador-admin.guard';
import {
  CreateIntegracaoDto,
  UpdateIntegracaoDto,
  CreateEndpointDto,
  UpdateEndpointDto,
  TestarEndpointDto,
  TrocarAmbienteModuloDto,
} from './dto/integracao.dto';

/**
 * ⭐ ADMIN do Configurador — não basta estar autenticado.
 *
 * Achado do /security-review de 15/08 (High): este controller tinha só
 * `JwtAuthGuard`, e o auth-gateway não tem RolesGuard global (`app.module.ts` só
 * registra throttler + JwtAuthGuard). Como `findAll`/`findByCodigo` usam
 * `include: { endpoints }` sem `select`, a resposta carregava `authConfig` — a
 * credencial de PRODUÇÃO do Protheus, em texto puro. Qualquer conta da plataforma
 * (um ENTREGADOR pelo app, um caixa, um OPERATOR do inventário) fazia
 * `GET /api/v1/core/integracoes` (exposto pelo nginx em `/api/v1/core/`) e a lia.
 * O lado de escrita era pior: `PATCH /endpoints/:id` sem checagem permitia
 * REPONTAR a URL da integração para um host de atacante — e aí todos os backends
 * passariam a enviar a credencial para lá.
 *
 * ⚠️ Isto NÃO quebra os módulos: gestão-TI, logística e fiscal resolvem os
 * endpoints por `/api/v1/internal/integracoes` (controller `@Public()`, que o
 * nginx bloqueia com `deny all`). Quem consome `/core/` é só o SPA do Configurador.
 */
@Controller('api/v1/core/integracoes')
@UseGuards(JwtAuthGuard, ConfiguradorAdminGuard)
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

  @Patch(':id/endpoints/:endpointId/ativar')
  ativarEndpoint(@Param('id') id: string, @Param('endpointId') endpointId: string) {
    return this.integracaoService.ativarEndpoint(id, endpointId);
  }

  @Post(':id/modulos/:modulo/trocar-ambiente')
  trocarAmbienteModulo(
    @Param('id') id: string,
    @Param('modulo', new ParseEnumPipe(ModuloConsumidor)) modulo: ModuloConsumidor,
    @Body() dto: TrocarAmbienteModuloDto,
  ) {
    return this.integracaoService.trocarAmbienteModulo(id, modulo, dto.ambiente);
  }
}
