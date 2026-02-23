import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { CentroCustoService } from './centro-custo.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateCentroCustoDto, UpdateCentroCustoDto } from './dto/create-centro-custo.dto';

@Controller('api/v1/core/centros-custo')
@UseGuards(JwtAuthGuard)
export class CentroCustoController {
  constructor(private readonly centroCustoService: CentroCustoService) {}

  @Get()
  findAll(@Query('filialId') filialId?: string) {
    return this.centroCustoService.findAll(filialId);
  }

  @Post()
  create(@Body() dto: CreateCentroCustoDto) {
    return this.centroCustoService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCentroCustoDto) {
    return this.centroCustoService.update(id, dto);
  }
}
