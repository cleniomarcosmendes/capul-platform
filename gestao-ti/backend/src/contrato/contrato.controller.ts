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
import { ContratoService } from './contrato.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { CreateContratoDto } from './dto/create-contrato.dto';
import { UpdateContratoDto, UpdateStatusContratoDto } from './dto/update-contrato.dto';
import { CreateParcelaDto } from './dto/create-parcela.dto';
import { UpdateParcelaDto, PagarParcelaDto } from './dto/update-parcela.dto';
import { ConfigurarRateioDto, SimularRateioDto } from './dto/rateio.dto';

@Controller('contratos')
@UseGuards(JwtAuthGuard, GestaoTiGuard, RolesGuard)
export class ContratoController {
  constructor(private readonly service: ContratoService) {}

  @Get()
  findAll(
    @Query('tipo') tipo?: string,
    @Query('status') status?: string,
    @Query('softwareId') softwareId?: string,
    @Query('fornecedor') fornecedor?: string,
    @Query('vencendoEm') vencendoEm?: string,
  ) {
    return this.service.findAll({
      tipo,
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
  @Roles('ADMIN', 'GESTOR_TI')
  create(@Body() dto: CreateContratoDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }

  @Patch(':id')
  @Roles('ADMIN', 'GESTOR_TI')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateContratoDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(id, dto, user.sub);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'GESTOR_TI')
  alterarStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusContratoDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.alterarStatus(id, dto.status, user.sub);
  }

  @Post(':id/renovar')
  @Roles('ADMIN', 'GESTOR_TI')
  renovar(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.renovar(id, user.sub);
  }

  // --- Parcelas ---

  @Get(':id/parcelas')
  listarParcelas(@Param('id') id: string) {
    return this.service.listarParcelas(id);
  }

  @Post(':id/parcelas')
  @Roles('ADMIN', 'GESTOR_TI')
  criarParcela(
    @Param('id') id: string,
    @Body() dto: CreateParcelaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.criarParcela(id, dto, user.sub);
  }

  @Patch(':id/parcelas/:pid')
  @Roles('ADMIN', 'GESTOR_TI')
  atualizarParcela(
    @Param('id') id: string,
    @Param('pid') pid: string,
    @Body() dto: UpdateParcelaDto,
  ) {
    return this.service.atualizarParcela(id, pid, dto);
  }

  @Post(':id/parcelas/:pid/pagar')
  @Roles('ADMIN', 'GESTOR_TI')
  pagarParcela(
    @Param('id') id: string,
    @Param('pid') pid: string,
    @Body() dto: PagarParcelaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.pagarParcela(id, pid, dto, user.sub);
  }

  @Post(':id/parcelas/:pid/cancelar')
  @Roles('ADMIN', 'GESTOR_TI')
  cancelarParcela(
    @Param('id') id: string,
    @Param('pid') pid: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.cancelarParcela(id, pid, user.sub);
  }

  // --- Rateio ---

  @Get(':id/rateio')
  obterRateio(@Param('id') id: string) {
    return this.service.obterRateio(id);
  }

  @Post(':id/rateio/simular')
  @Roles('ADMIN', 'GESTOR_TI')
  simularRateio(@Param('id') id: string, @Body() dto: SimularRateioDto) {
    return this.service.simularRateio(id, dto);
  }

  @Post(':id/rateio')
  @Roles('ADMIN', 'GESTOR_TI')
  configurarRateio(
    @Param('id') id: string,
    @Body() dto: ConfigurarRateioDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.configurarRateio(id, dto, user.sub);
  }

  // --- Licencas ---

  @Post(':id/licencas')
  @Roles('ADMIN', 'GESTOR_TI')
  vincularLicenca(
    @Param('id') id: string,
    @Body('licencaId') licencaId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.vincularLicenca(id, licencaId, user.sub);
  }

  @Delete(':id/licencas/:licId')
  @Roles('ADMIN', 'GESTOR_TI')
  desvincularLicenca(
    @Param('id') id: string,
    @Param('licId') licId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.desvincularLicenca(id, licId, user.sub);
  }
}
