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
import { ParadaService } from './parada.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { CreateParadaDto } from './dto/create-parada.dto';
import { UpdateParadaDto } from './dto/update-parada.dto';
import { FinalizarParadaDto } from './dto/finalizar-parada.dto';

@Controller('paradas')
@UseGuards(JwtAuthGuard, GestaoTiGuard, RolesGuard)
export class ParadaController {
  constructor(private readonly service: ParadaService) {}

  @Get()
  findAll(
    @Query('softwareId') softwareId?: string,
    @Query('moduloId') moduloId?: string,
    @Query('filialId') filialId?: string,
    @Query('tipo') tipo?: string,
    @Query('impacto') impacto?: string,
    @Query('status') status?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
  ) {
    return this.service.findAll({
      softwareId,
      moduloId,
      filialId,
      tipo,
      impacto,
      status,
      dataInicio,
      dataFim,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO')
  create(@Body() dto: CreateParadaDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }

  @Patch(':id')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO')
  update(@Param('id') id: string, @Body() dto: UpdateParadaDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/finalizar')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO')
  finalizar(
    @Param('id') id: string,
    @Body() dto: FinalizarParadaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.finalizar(id, dto, user.sub);
  }

  @Post(':id/cancelar')
  @Roles('ADMIN', 'GESTOR_TI')
  cancelar(@Param('id') id: string) {
    return this.service.cancelar(id);
  }

  @Post(':id/chamados')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO')
  vincularChamado(
    @Param('id') id: string,
    @Body() body: { chamadoId: string },
  ) {
    return this.service.vincularChamado(id, body.chamadoId);
  }

  @Delete(':id/chamados/:chamadoId')
  @Roles('ADMIN', 'GESTOR_TI', 'TECNICO')
  desvincularChamado(
    @Param('id') id: string,
    @Param('chamadoId') chamadoId: string,
  ) {
    return this.service.desvincularChamado(id, chamadoId);
  }
}
