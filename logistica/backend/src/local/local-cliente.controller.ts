import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { LocalClienteService } from './local-cliente.service.js';
import { CriarLocalClienteHttpDto } from './dto.js';

// Locais geolocalizados do cliente — usados tanto pela VISITA do supervisor quanto pela
// PARADA de saída de veículo (as duas alimentam a mesma consolidação). Quem registra
// dado de campo alcança: operador/gestor de entrega, frota, coordenador e supervisor.
// ADMIN passa sempre (guard global).
@Controller('local')
@Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA', 'REGISTRADOR_FROTA', 'COORDENADOR', 'SUPERVISOR', 'SUPERVISOR_FROTA')
export class LocalClienteController {
  constructor(private readonly svc: LocalClienteService) {}

  /** Locais de um cliente (por matrícula SA1), com a coordenada consolidada de cada um. */
  @Get('cliente/:matricula')
  porCliente(@Param('matricula') matricula: string, @CurrentUser() user: JwtPayload) {
    return this.svc.listarPorCliente(matricula, user);
  }

  @Get(':id')
  obter(@Param('id') id: string) {
    return this.svc.obter(id);
  }

  /** Cria (ou reaproveita, pela chave cliente+tipo+nome) um local do cliente. */
  @Post()
  criar(@Body() dto: CriarLocalClienteHttpDto, @CurrentUser() user: JwtPayload) {
    return this.svc.criar(dto, user);
  }

  /** Recalcula a localização consolidada (manual — normalmente é automático após cada
   *  marcação). Restrito a gestores/admin. */
  @Post(':id/consolidar')
  @Roles('GESTOR_FROTA', 'SUPERVISOR_FROTA')
  consolidar(@Param('id') id: string) {
    return this.svc.consolidar(id);
  }
}
