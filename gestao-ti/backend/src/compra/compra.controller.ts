import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CompraService } from './compra.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GestaoTiRole } from '../common/decorators/gestao-ti-role.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { CreateTipoProdutoDto, UpdateTipoProdutoDto } from './dto/create-tipo-produto.dto';
import { CreateTipoProjetoDto, UpdateTipoProjetoDto } from './dto/create-tipo-projeto.dto';
import { CreateNotaFiscalDto, UpdateNotaFiscalDto } from './dto/create-nota-fiscal.dto';

@Controller('compras')
@UseGuards(JwtAuthGuard, GestaoTiGuard, RolesGuard)
export class CompraController {
  constructor(private readonly service: CompraService) {}

  // --- Tipos de Produto ---

  @Get('tipos-produto')
  findAllTiposProduto(@Query('status') status?: string) {
    return this.service.findAllTiposProduto(status);
  }

  @Post('tipos-produto')
  @Roles('ADMIN', 'GESTOR_TI')
  createTipoProduto(@Body() dto: CreateTipoProdutoDto) {
    return this.service.createTipoProduto(dto);
  }

  @Patch('tipos-produto/:id')
  @Roles('ADMIN', 'GESTOR_TI')
  updateTipoProduto(@Param('id') id: string, @Body() dto: UpdateTipoProdutoDto) {
    return this.service.updateTipoProduto(id, dto);
  }

  @Delete('tipos-produto/:id')
  @Roles('ADMIN', 'GESTOR_TI')
  removeTipoProduto(@Param('id') id: string) {
    return this.service.removeTipoProduto(id);
  }

  // --- Tipos de Projeto ---

  @Get('tipos-projeto')
  findAllTiposProjeto(@Query('status') status?: string) {
    return this.service.findAllTiposProjeto(status);
  }

  @Post('tipos-projeto')
  @Roles('ADMIN', 'GESTOR_TI')
  createTipoProjeto(@Body() dto: CreateTipoProjetoDto) {
    return this.service.createTipoProjeto(dto);
  }

  @Patch('tipos-projeto/:id')
  @Roles('ADMIN', 'GESTOR_TI')
  updateTipoProjeto(@Param('id') id: string, @Body() dto: UpdateTipoProjetoDto) {
    return this.service.updateTipoProjeto(id, dto);
  }

  @Delete('tipos-projeto/:id')
  @Roles('ADMIN', 'GESTOR_TI')
  removeTipoProjeto(@Param('id') id: string) {
    return this.service.removeTipoProjeto(id);
  }

  // --- Notas Fiscais ---

  @Get('notas-fiscais')
  findAllNotasFiscais(
    @Query('fornecedorId') fornecedorId?: string,
    @Query('status') status?: string,
    @Query('departamentoId') departamentoId?: string,
    @Query('projetoId') projetoId?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('equipeId') equipeId?: string,
    @CurrentUser() user?: JwtPayload,
    @GestaoTiRole() role?: string,
  ) {
    return this.service.findAllNotasFiscais(
      { fornecedorId, status, departamentoId, projetoId, dataInicio, dataFim, equipeId },
      user?.filialId,
      user?.sub,
      role,
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

  @Post('notas-fiscais')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  createNotaFiscal(
    @Body() dto: CreateNotaFiscalDto,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.createNotaFiscal(dto, user.sub, user.filialId, role);
  }

  @Patch('notas-fiscais/:id')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  updateNotaFiscal(
    @Param('id') id: string,
    @Body() dto: UpdateNotaFiscalDto,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.updateNotaFiscal(id, dto, user.sub, role);
  }

  @Delete('notas-fiscais/:id')
  @Roles('ADMIN', 'GESTOR_TI')
  removeNotaFiscal(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.removeNotaFiscal(id, user.sub, role);
  }

  @Post('notas-fiscais/:id/duplicar')
  @Roles('ADMIN', 'GESTOR_TI', 'SUPORTE_TI')
  duplicarNotaFiscal(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @GestaoTiRole() role: string,
  ) {
    return this.service.duplicarNotaFiscal(id, user.sub, user.filialId, role);
  }
}
