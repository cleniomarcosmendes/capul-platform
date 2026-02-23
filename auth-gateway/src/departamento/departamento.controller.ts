import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { DepartamentoService } from './departamento.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateDepartamentoDto, UpdateDepartamentoDto } from './dto/create-departamento.dto';

@Controller('api/v1/core/departamentos')
@UseGuards(JwtAuthGuard)
export class DepartamentoController {
  constructor(private readonly departamentoService: DepartamentoService) {}

  @Get()
  findAll(@Query('filialId') filialId?: string) {
    return this.departamentoService.findAll(filialId);
  }

  @Post()
  create(@Body() dto: CreateDepartamentoDto) {
    return this.departamentoService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDepartamentoDto) {
    return this.departamentoService.update(id, dto);
  }
}
