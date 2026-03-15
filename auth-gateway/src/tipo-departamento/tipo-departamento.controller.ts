import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { TipoDepartamentoService } from './tipo-departamento.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateTipoDepartamentoDto, UpdateTipoDepartamentoDto } from './dto/tipo-departamento.dto';

@Controller('api/v1/core/tipos-departamento')
@UseGuards(JwtAuthGuard)
export class TipoDepartamentoController {
  constructor(private readonly service: TipoDepartamentoService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  create(@Body() dto: CreateTipoDepartamentoDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTipoDepartamentoDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
