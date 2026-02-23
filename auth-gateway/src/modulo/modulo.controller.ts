import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ModuloService } from './modulo.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/v1/core/modulos')
@UseGuards(JwtAuthGuard)
export class ModuloController {
  constructor(private readonly moduloService: ModuloService) {}

  @Get()
  findAll() {
    return this.moduloService.findAll();
  }

  @Get(':id/roles')
  findRoles(@Param('id') id: string) {
    return this.moduloService.findRoles(id);
  }
}
